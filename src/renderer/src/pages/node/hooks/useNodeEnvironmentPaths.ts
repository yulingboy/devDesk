import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { NodeEnvironmentPath } from '@shared/domain'

/** 环境路径只在对应页签首次打开时读取，避免拖慢 Node 页面首屏。 */
export function useNodeEnvironmentPaths(
  enabled: boolean,
  report: (error: unknown) => void
): {
  paths: NodeEnvironmentPath[]
  loading: boolean
  refresh: () => void
} {
  const [paths, setPaths] = useState<NodeEnvironmentPath[]>([])
  const [loading, setLoading] = useState(false)
  const initialRequestStarted = useRef(false)

  const load = useCallback(
    (notify = false): void => {
      initialRequestStarted.current = true
      setLoading(true)
      void window.api?.node
        .environmentPaths()
        .then((value) => {
          setPaths(value)
          if (notify) toast.success('运行时路径已刷新')
        })
        .catch(report)
        .finally(() => setLoading(false))
    },
    [report]
  )

  useEffect(() => {
    if (!enabled || initialRequestStarted.current) return
    void Promise.resolve().then(() => load())
  }, [enabled, load])

  const refresh = useCallback((): void => load(true), [load])

  return { paths, loading, refresh }
}
