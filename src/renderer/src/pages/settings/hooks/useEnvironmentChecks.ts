import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EnvironmentCheck, EnvironmentTool } from '@shared/domain'

/** 管理环境检测快照及其异步操作，展示组件只负责分组和状态呈现。 */
export function useEnvironmentChecks(report: (error: unknown) => void): {
  checks: EnvironmentCheck[]
  tools: EnvironmentTool[]
  checkedAt: string | undefined
  running: boolean
  stopping: boolean
  pendingTool: string | undefined
  checkMap: Map<string, EnvironmentCheck>
  summary: { passed: number; issues: number; unchecked: number }
  run: () => void
  retry: (id: string) => void
  stop: () => void
  install: (id: string) => Promise<void>
} {
  const [checks, setChecks] = useState<EnvironmentCheck[]>([])
  const [tools, setTools] = useState<EnvironmentTool[]>([])
  const [checkedAt, setCheckedAt] = useState<string>()
  const [running, setRunning] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [pendingTool, setPendingTool] = useState<string>()
  const initialLoadStarted = useRef(false)

  useEffect(() => {
    const unsubscribe = window.api!.settings.onEnvironmentCheckUpdated(setChecks)
    if (initialLoadStarted.current) return unsubscribe
    initialLoadStarted.current = true
    void Promise.allSettled([
      window.api!.settings.environmentTools(),
      window.api!.settings.environmentCheckSnapshot()
    ]).then(([toolsResult, snapshotResult]) => {
      if (toolsResult.status === 'fulfilled') setTools(toolsResult.value)
      else report(toolsResult.reason)
      if (snapshotResult.status === 'fulfilled' && snapshotResult.value) {
        setChecks(snapshotResult.value.checks)
        setCheckedAt(snapshotResult.value.checkedAt)
      }
    })
    return unsubscribe
  }, [report])

  const replaceCheck = useCallback((result: EnvironmentCheck): void => {
    setChecks((current) => {
      const index = current.findIndex((item) => item.id === result.id)
      if (index < 0) return [...current, result]
      const next = [...current]
      next[index] = result
      return next
    })
    setCheckedAt(result.checkedAt)
  }, [])

  const run = useCallback((): void => {
    setRunning(true)
    void window
      .api!.settings.environmentCheck()
      .then((value) => {
        setChecks(value)
        setCheckedAt(new Date().toISOString())
      })
      .catch(report)
      .finally(() => {
        setRunning(false)
        setStopping(false)
      })
  }, [report])

  const retry = useCallback(
    (id: string): void => {
      setPendingTool(id)
      void window
        .api!.settings.environmentCheckTool(id)
        .then(replaceCheck)
        .catch(report)
        .finally(() => setPendingTool(undefined))
    },
    [report, replaceCheck]
  )

  const stop = useCallback((): void => {
    setStopping(true)
    void window.api!.settings.stopEnvironmentCheck().catch((error) => {
      setStopping(false)
      report(error)
    })
  }, [report])

  const install = useCallback(
    async (id: string): Promise<void> => {
      setPendingTool(id)
      await window
        .api!.settings.installEnvironmentTool(id)
        .then(replaceCheck)
        .catch(report)
        .finally(() => setPendingTool(undefined))
    },
    [report, replaceCheck]
  )

  const checkMap = useMemo(() => new Map(checks.map((item) => [item.id, item])), [checks])
  const summary = useMemo(() => {
    const passed = checks.filter((item) => item.status === 'passed').length
    return {
      passed,
      issues: checks.length - passed,
      unchecked: Math.max(tools.length - checks.length, 0)
    }
  }, [checks, tools.length])

  return {
    checks,
    tools,
    checkedAt,
    running,
    stopping,
    pendingTool,
    checkMap,
    summary,
    run,
    retry,
    stop,
    install
  }
}
