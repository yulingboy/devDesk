import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

interface AsyncActionOptions<T> {
  success?: string | ((value: T) => string)
}

/**
 * 管理页面内短时异步操作的进行状态。
 *
 * 相同 key 在执行期间会被忽略，避免用户连续点击导致 IPC 重复写入。
 */
export function useAsyncAction(onError: (error: unknown) => void): {
  isPending: (key?: string) => boolean
  run: <T>(
    key: string,
    action: () => Promise<T>,
    options?: AsyncActionOptions<T>
  ) => Promise<T | undefined>
} {
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set())
  const pendingRef = useRef<Set<string>>(new Set())

  const isPending = useCallback(
    (key?: string) => (key ? pendingKeys.has(key) : pendingKeys.size > 0),
    [pendingKeys]
  )

  const run = useCallback(
    async <T>(
      key: string,
      action: () => Promise<T>,
      options?: AsyncActionOptions<T>
    ): Promise<T | undefined> => {
      if (pendingRef.current.has(key)) return undefined
      pendingRef.current.add(key)
      setPendingKeys((current) => new Set(current).add(key))
      try {
        const value = await action()
        const successMessage =
          typeof options?.success === 'function' ? options.success(value) : options?.success
        if (successMessage) toast.success(successMessage)
        return value
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
