import { useCallback, useEffect, useRef, useState } from 'react'
import type { GlobalPackage, NodeState } from '@shared/domain'

/** 管理全局包读取、过期检查和按 Node 版本自动刷新，面板只负责业务操作展示。 */
export function useGlobalPackages(
  state: NodeState | null,
  report: (error: unknown) => void
): {
  packages: GlobalPackage[]
  setPackages: React.Dispatch<React.SetStateAction<GlobalPackage[]>>
  keyword: string
  setKeyword: (value: string) => void
  loading: boolean
  checking: boolean
  load: () => void
  checkOutdated: () => void
} {
  const [packages, setPackages] = useState<GlobalPackage[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const autoLoadKey = useRef('')

  const load = useCallback(
    (query = keyword): void => {
      setLoading(true)
      void window.api?.node
        .packages(query)
        .then(setPackages)
        .catch(report)
        .finally(() => setLoading(false))
    },
    [keyword, report]
  )

  useEffect(() => {
    if (!state?.packageManagerVersion) return
    const key = `${state.currentVersion}:${state.packageManager}:${state.packageManagerVersion}`
    if (autoLoadKey.current === key) return
    autoLoadKey.current = key
    setPackages([])
    load('')
  }, [load, state?.currentVersion, state?.packageManager, state?.packageManagerVersion])

  const checkOutdated = useCallback((): void => {
    setChecking(true)
    void window.api?.node
      .checkOutdated()
      .then(setPackages)
      .catch(report)
      .finally(() => setChecking(false))
  }, [report])

  const refresh = useCallback((): void => load(), [load])

  return {
    packages,
    setPackages,
    keyword,
    setKeyword,
    loading,
    checking,
    load: refresh,
    checkOutdated
  }
}
