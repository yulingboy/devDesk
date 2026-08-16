import { useCallback, useRef, useState } from 'react'

/**
 * 管理页面内短时异步操作的进行状态。
 *
 * 相同 key 在执行期间会被忽略，避免用户连续点击导致 IPC 重复写入。
 */
export function useAsyncAction(onError: (error: unknown) => void): {
  isPending: (key?: string) => boolean
  run: <T>(key: string, action: () => Promise<T>) => Promise<T | undefined>
} {
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set())
  const pendingRef = useRef<Set<string>>(new Set())

  const isPending = useCallback(
    (key?: string) => (key ? pendingKeys.has(key) : pendingKeys.size > 0),
    [pendingKeys]
  )

  const run = useCallback(
    async <T>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
      if (pendingRef.current.has(key)) return undefined
      pendingRef.current.add(key)
      setPendingKeys((current) => new Set(current).add(key))
      try {
        return await action()
      } catch (error) {
        onError(error)
        return undefined
      } finally {
        pendingRef.current.delete(key)
        setPendingKeys((current) => {
          const next = new Set(current)
          next.delete(key)
          return next
        })
      }
    },
    [onError]
  )

  return { isPending, run }
}
