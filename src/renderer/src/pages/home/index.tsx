import { useEffect, useState } from 'react'
import type { RuntimeInfo } from '@shared/types'
import type { SystemOverviewSnapshot } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { EnvironmentPanel } from '@/components/EnvironmentPanel'
import { OverviewCards } from '@/components/OverviewCards'
import { QuickStart } from '@/components/QuickStart'
import { rendererLogger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function HomePage(): React.JSX.Element {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const [snapshot, setSnapshot] = useState<SystemOverviewSnapshot | null>(null)
  const [counts, setCounts] = useState({ workspaces: 0, identities: 0, keys: 0 })
  const hasDesktopRuntime = Boolean(window.api)

  // 首页只读取一次主进程运行时信息，失败时保留可用的浏览器预览状态。
  useEffect(() => {
    void window.api?.app
      .getRuntimeInfo()
      .then(setRuntimeInfo)
      .catch((error: unknown) => {
        rendererLogger.error('运行时信息读取失败', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
  }, [])
  useEffect(() => {
    if (!window.api) return
    void Promise.all([
      window.api.workspaces.list(),
      window.api.git.getState(),
      window.api.ssh.list()
    ])
      .then(([workspaces, git, keys]) =>
        setCounts({
          workspaces: workspaces.length,
          identities: git.identities.length,
          keys: keys.length
        })
      )
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    if (!window.api) return
    void window.api.overview
      .getSnapshot()
      .then(setSnapshot)
      .catch(() => undefined)
    return window.api.overview.onUpdated(setSnapshot)
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <section aria-labelledby="overview-heading">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-[#929599]">
              概览
            </p>
            <h2
              className="text-2xl font-semibold tracking-tight text-[#202123]"
              id="overview-heading"
            >
              下午好，欢迎回来
            </h2>
            <p className="mt-2 text-sm text-[#777b80]">环境服务已就绪，可以开始工作。</p>
          </div>
          <Badge variant="success">运行正常</Badge>
        </div>
        <OverviewCards counts={counts} snapshot={snapshot} />
      </section>

      <section className="mt-6 grid grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] gap-5">
        <EnvironmentPanel runtimeInfo={runtimeInfo} hasDesktopRuntime={hasDesktopRuntime} />
        <QuickStart />
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>设备状态</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
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
          <CardContent className="space-y-2">
            {snapshot?.networks.map((network) => (
              <div
                className="flex justify-between text-sm"
                key={`${network.name}-${network.address}`}
              >
                <span className="text-[#777b80]">{network.name}</span>
                <span className="font-mono text-xs">{network.address}</span>
              </div>
            ))}
            {!snapshot?.networks.length && (
              <p className="text-sm text-[#85878a]">暂无有效网络接口</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-xs text-[#85878a]">{label}</p>
      <p className="mt-1 truncate font-medium" title={value}>
        {value}
      </p>
    </div>
  )
}
