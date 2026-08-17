import { useCallback, useEffect, useRef, useState } from 'react'
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

  const refresh = useCallback((): void => {
    initialRequestStarted.current = true
    setLoading(true)
    void window.api?.node
      .environmentPaths()
      .then(setPaths)
      .catch(report)
      .finally(() => setLoading(false))
  }, [report])

  useEffect(() => {
    if (!enabled || initialRequestStarted.current) return
    void Promise.resolve().then(refresh)
  }, [enabled, refresh])

  return { paths, loading, refresh }
}
