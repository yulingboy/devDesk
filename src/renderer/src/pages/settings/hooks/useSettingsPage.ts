import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AppSettings, DataStats, LogStats } from '@shared/domain'
import type { RuntimeInfo } from '@shared/types'
import { rendererLogger } from '@/lib/logger'

type ResourceErrors = Partial<
  Record<'settings' | 'data' | 'runtime' | 'logs' | 'operation', string>
>

/** 分别加载设置与辅助资源，辅助信息失败不会阻止用户修改基础设置。 */
export function useSettingsPage(): {
  persisted: AppSettings | null
  draft: AppSettings | null
  dataStats: DataStats | null
  logStats: LogStats | null
  runtime: RuntimeInfo | null
  errors: ResourceErrors
  loading: boolean
  dirty: boolean
  setDraft: React.Dispatch<React.SetStateAction<AppSettings | null>>
  acceptSettings: (value: AppSettings) => void
  discard: () => void
  save: () => Promise<void>
  reset: () => Promise<void>
  refreshStats: () => Promise<void>
  report: (error: unknown) => void
  retry: () => void
} {
  const [persisted, setPersisted] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [dataStats, setDataStats] = useState<DataStats | null>(null)
  const [logStats, setLogStats] = useState<LogStats | null>(null)
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)
  const [errors, setErrors] = useState<ResourceErrors>({})
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)

  const report = useCallback((error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setErrors((current) => ({ ...current, operation: message }))
    toast.error(message)
    rendererLogger.error('设置操作失败', { error: message })
  }, [])

  const load = useCallback((): void => {
    const id = ++requestId.current
    void Promise.allSettled([
      window.api!.settings.get(),
      window.api!.settings.dataStats(),
      window.api!.app.getRuntimeInfo(),
      window.api!.settings.logStats()
    ]).then((results) => {
      if (id !== requestId.current) return
      const [settingsResult, dataResult, runtimeResult, logsResult] = results
      const nextErrors: ResourceErrors = {}
      if (settingsResult.status === 'fulfilled') {
        setPersisted(settingsResult.value)
        setDraft(settingsResult.value)
      } else nextErrors.settings = settingsResult.reason?.message ?? '设置读取失败'
      if (dataResult.status === 'fulfilled') setDataStats(dataResult.value)
      else nextErrors.data = dataResult.reason?.message ?? '数据统计读取失败'
      if (runtimeResult.status === 'fulfilled') setRuntime(runtimeResult.value)
      else nextErrors.runtime = runtimeResult.reason?.message ?? '运行时信息读取失败'
      if (logsResult.status === 'fulfilled') setLogStats(logsResult.value)
      else nextErrors.logs = logsResult.reason?.message ?? '日志信息读取失败'
      setErrors(nextErrors)
      setLoading(false)
    })
  }, [])

  useEffect(load, [load])

  const acceptSettings = useCallback((value: AppSettings): void => {
    setPersisted(value)
    setDraft(value)
    setErrors((current) => ({ ...current, operation: undefined }))
  }, [])

  const save = useCallback(async (): Promise<void> => {
    if (!draft) return
    try {
      acceptSettings(await window.api!.settings.save(draft))
      toast.success('设置已保存')
    } catch (error) {
      report(error)
    }
  }, [acceptSettings, draft, report])

  const reset = useCallback(async (): Promise<void> => {
    try {
      acceptSettings(await window.api!.settings.reset())
      toast.success('设置已恢复默认值')
    } catch (error) {
      report(error)
    }
  }, [acceptSettings, report])

  const refreshStats = useCallback(async (): Promise<void> => {
    const [dataResult, logsResult] = await Promise.allSettled([
      window.api!.settings.dataStats(),
      window.api!.settings.logStats()
    ])
    if (dataResult.status === 'fulfilled') setDataStats(dataResult.value)
    if (logsResult.status === 'fulfilled') setLogStats(logsResult.value)
  }, [])

  const retry = useCallback((): void => {
    setLoading(true)
    load()
  }, [load])

  return {
    persisted,
    draft,
    dataStats,
    logStats,
    runtime,
    errors,
    loading,
    dirty: Boolean(draft && persisted && JSON.stringify(draft) !== JSON.stringify(persisted)),
    setDraft,
    acceptSettings,
    discard: () => setDraft(persisted),
    save,
    reset,
    refreshStats,
    report,
    retry
  }
}
