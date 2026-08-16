import { useEffect, useState } from 'react'
import type { RuntimeInfo } from '@shared/types'
import type { SystemOverviewSnapshot } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { EnvironmentPanel } from '@/components/EnvironmentPanel'
import { OverviewCards } from '@/components/OverviewCards'
import { QuickStart } from '@/components/QuickStart'
import { rendererLogger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'

export function HomePage(): React.JSX.Element {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const [snapshot, setSnapshot] = useState<SystemOverviewSnapshot | null>(null)
  const [counts, setCounts] = useState<{ workspaces: number; identities: number; keys: number }>()
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const hasDesktopRuntime = Boolean(window.api)

  useEffect(() => {
    if (!window.api) {
      window.setTimeout(() => setLoading(false), 0)
      return
    }
    const unsubscribe = window.api.overview.onUpdated(setSnapshot)
    void Promise.all([
      window.api.app.getRuntimeInfo(),
      window.api.workspaces.list(),
      window.api.git.getState(),
      window.api.ssh.list(),
      window.api.overview.getSnapshot()
    ])
      .then(([runtime, workspaces, git, keys, overview]) => {
        setRuntimeInfo(runtime)
        setCounts({
          workspaces: workspaces.length,
          identities: git.identities.length,
          keys: keys.length
        })
        setSnapshot(overview)
      })
      .catch((error: unknown) => {
        rendererLogger.error('运行时信息读取失败', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
      .finally(() => setLoading(false))
    return unsubscribe
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const hour = currentTime.getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好'
  const timeText = currentTime.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const dateText = currentTime.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full overflow-auto bg-slate-50/40 p-3">
      <div className="flex flex-col gap-2.5">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <Badge className="mb-1.5 gap-1.5" variant="success">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                电脑状态面板
              </Badge>
              <h2 className="text-base font-semibold text-slate-800" id="overview-heading">
                {greeting}，开发者
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                查看当前设备状态、开发环境、磁盘与网络信息。
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span>{dateText}</span>
                <span>·</span>
                <span>{snapshot?.hostname || '设备信息读取中'}</span>
                <span>·</span>
                <span>状态由主进程后台自动采样</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-medium tabular-nums text-slate-700">
                {timeText}
              </div>
              <Badge className="mt-3" variant="success">
                运行正常
              </Badge>
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="overview-heading">
          <OverviewCards counts={counts} snapshot={snapshot} />
        </section>

        <section className="grid gap-2.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          <EnvironmentPanel runtimeInfo={runtimeInfo} hasDesktopRuntime={hasDesktopRuntime} />
          <QuickStart />
        </section>
        <section className="grid gap-2.5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>设备状态</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              <Info label="主机名" value={snapshot?.hostname ?? '读取中'} />
              <Info label="用户" value={snapshot?.username ?? '读取中'} />
              <Info
                label="CPU"
                value={snapshot ? `${snapshot.cpu.model} · ${snapshot.cpu.cores} 核` : '读取中'}
              />
              <Info
                label="内存"
                value={snapshot ? `${snapshot.memory.usedPercent}% 已使用` : '读取中'}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>网络接口</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {snapshot?.networks.map((network) => (
                <div
                  className="flex justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs"
                  key={`${network.name}-${network.address}`}
                >
                  <span className="text-slate-500">{network.name}</span>
                  <span className="font-mono text-xs text-slate-700">{network.address}</span>
                </div>
              ))}
              {!snapshot?.networks.length && (
                <Empty className="min-h-20 py-3">
                  <EmptyTitle>暂无有效网络接口</EmptyTitle>
                  <EmptyDescription>网络信息会在后台采样完成后显示。</EmptyDescription>
                </Empty>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="mt-1 truncate font-medium text-slate-700">{value}</p>
        </TooltipTrigger>
        <TooltipContent>{value}</TooltipContent>
      </Tooltip>
    </div>
  )
}
