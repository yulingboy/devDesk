import { useEffect, useState } from 'react'
import type { RuntimeInfo } from '@shared/types'
import type { NodeState, SystemOverviewSnapshot, Workspace } from '@shared/domain'
import { Link } from 'react-router-dom'
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
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [setupStatus, setSetupStatus] = useState({
    sshReady: false,
    gitReady: false,
    workspaceReady: false,
    nodeReady: false
  })
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const hasDesktopRuntime = Boolean(window.api)

  useEffect(() => {
    if (!window.api) {
      window.setTimeout(() => setLoading(false), 0)
      return
    }
    const unsubscribe = window.api.overview.onUpdated(setSnapshot)
    void Promise.all([window.api.app.getRuntimeInfo(), window.api.overview.getSnapshot()])
      .then(([runtime, overview]) => {
        setRuntimeInfo(runtime)
        setSnapshot(overview)
      })
      .catch((error: unknown) => {
        rendererLogger.error('运行时信息读取失败', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
      .finally(() => setLoading(false))
    // 工作区是首页的核心数据，不等待可能较慢的 SSH 扫描才展示项目状态。
    void window.api.workspaces
      .list()
      .then((workspaceList) => {
        setWorkspaces(workspaceList)
        setSetupStatus((current) => ({ ...current, workspaceReady: workspaceList.length > 0 }))
      })
      .catch((error: unknown) => {
        rendererLogger.warn('首页工作区状态读取失败', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
    // 辅助环境检测单独完成，单项失败不会影响项目概览。
    void Promise.allSettled([
      window.api.ssh.list(),
      window.api.git.getState(),
      window.api.node.getState()
    ]).then(([keysResult, gitResult, nodeResult]) => {
      const keys = keysResult.status === 'fulfilled' ? keysResult.value : []
      const git = gitResult.status === 'fulfilled' ? gitResult.value : null
      const node = nodeResult.status === 'fulfilled' ? nodeResult.value : null
      setSetupStatus((current) => ({
        ...current,
        sshReady: keys.length > 0,
        gitReady: Boolean(git?.identities.length),
        nodeReady: node ? isNodeReady(node) : false
      }))
      const failedChecks = [keysResult, gitResult, nodeResult].filter(
        (result) => result.status === 'rejected'
      )
      if (failedChecks.length) {
        rendererLogger.warn('部分快速开始状态读取失败', { failedCount: failedChecks.length })
      }
    })
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
                开发工作台
              </Badge>
              <h2 className="text-base font-semibold text-slate-800" id="overview-heading">
                {greeting}，开始处理项目
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                从工作区进入项目，检查环境、安装依赖并运行开发脚本。
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span>{dateText}</span>
                <span>·</span>
                <span>{workspaces.length} 个工作区</span>
                <span>·</span>
                <span>
                  {workspaces.reduce((total, workspace) => total + workspace.projects.length, 0)}{' '}
                  个项目
                </span>
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
          <OverviewCards snapshot={snapshot} />
        </section>

        <ProjectOverview workspaces={workspaces} />

        <section className="grid gap-2.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          <EnvironmentPanel runtimeInfo={runtimeInfo} hasDesktopRuntime={hasDesktopRuntime} />
          <QuickStart status={setupStatus} />
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

function isNodeReady(state: NodeState): boolean {
  return Boolean(state.currentVersion || state.installed.length || state.packageManagerVersion)
}

function ProjectOverview({ workspaces }: { workspaces: Workspace[] }): React.JSX.Element {
  const projects = workspaces
    .flatMap((workspace) =>
      workspace.projects.map((project) => ({ ...project, workspaceName: workspace.name }))
    )
    .sort((left, right) => (right.lastScannedAt ?? '').localeCompare(left.lastScannedAt ?? ''))
    .slice(0, 6)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b border-slate-100">
        <div>
          <CardTitle>项目工作台</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">最近扫描的项目及其运行准备状态</p>
        </div>
        <Badge variant="secondary">{projects.length} 个项目</Badge>
      </CardHeader>
      <CardContent className="p-2">
        {projects.length ? (
          <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                className="block min-w-0 rounded-md px-2.5 py-2 hover:bg-slate-50"
                key={project.id}
                to="/workspaces"
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-slate-700">
                    {project.name}
                  </span>
                  {project.dependencyState === 'ready' ? (
                    <Badge variant="success">就绪</Badge>
                  ) : project.hasPackageJson ? (
                    <Badge variant="outline">待安装依赖</Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-400">
                  {project.workspaceName} · {project.packageManager || project.branch || '本地项目'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-2.5 py-4 text-xs text-slate-500">
            尚未扫描项目。前往工作区添加目录后，即可在这里看到项目状态。
          </div>
        )}
      </CardContent>
    </Card>
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
