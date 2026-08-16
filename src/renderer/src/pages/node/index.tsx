import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, RefreshCw, Trash2 } from 'lucide-react'
import type { NodeRelease, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import { rendererLogger } from '@/lib/logger'
import { ConfirmAction } from '@/components/ConfirmAction'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { TooltipButton } from '@/components/TooltipButton'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CachePanel } from './components/CachePanel'
import { PackagePanel } from './components/PackagePanel'
import { RegistryPanel } from './components/RegistryPanel'

export function NodePage(): React.JSX.Element {
  const [state, setState] = useState<NodeState | null>(null)
  const [releases, setReleases] = useState<NodeRelease[]>([])
  const [keyword, setKeyword] = useState('')
  const [channel, setChannel] = useState<'all' | 'lts' | 'current'>('all')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const report = useCallback((error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    toast.error(message)
    rendererLogger.error('Node 操作失败', { error: message })
  }, [])
  const load = useCallback((): void => {
    void window.api?.node
      .getState()
      .then(setState)
      .catch(report)
      .finally(() => setLoading(false))
  }, [report])
  useEffect(() => {
    load()
    void window.api?.node.releases({ channel: 'all' }).then(setReleases).catch(report)
    return window.api?.node.onTaskUpdated(setState)
  }, [load, report])
  const refreshReleases = (): void => {
    void window.api?.node.releases({ keyword, channel }).then(setReleases).catch(report)
  }
  const install = (version: string): void => {
    toast.info(`正在安装 Node ${version}...`)
    void window.api?.node
      .install({ version })
      .then((value) => {
        setState(value)
        toast.success('Node 安装任务已完成')
      })
      .catch(report)
  }

  const installedPanel = (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>已安装版本</CardTitle>
          <CardDescription>当前版本不能直接删除，切换后再清理旧版本。</CardDescription>
        </div>
        <TooltipButton onClick={load} size="icon" tooltip="刷新状态" variant="ghost">
          <RefreshCw size={15} />
        </TooltipButton>
      </CardHeader>
      <CardContent className="space-y-2">
        {state?.installed.map((item) => (
          <div
            className="flex items-center gap-2 rounded-md border border-slate-100 p-2.5"
            key={item.version}
          >
            <p className="font-mono text-xs">v{item.version}</p>
            {item.isCurrent && <Badge variant="success">当前</Badge>}
            {item.isDefault && <Badge variant="secondary">默认</Badge>}
            <span className="flex-1 truncate text-[11px] text-slate-400">{item.path}</span>
            <Button
              onClick={() =>
                void window.api?.node
                  .switch(item.version, true)
                  .then((value) => {
                    setState(value)
                    toast.success(`已切换到 Node ${item.version}`)
                  })
                  .catch(report)
              }
              size="sm"
              variant="ghost"
            >
              切换并设为默认
            </Button>
            <ConfirmAction
              description={`将删除本机 nvm 管理的 Node ${item.version}。当前使用中的版本不能删除。`}
              onConfirm={() =>
                void window.api?.node.remove(item.version).then(setState).catch(report)
              }
              title="删除 Node 版本？"
              triggerTooltip="删除版本"
            >
              <Button aria-label="删除版本" disabled={item.isCurrent} size="icon" variant="ghost">
                <Trash2 size={14} />
              </Button>
            </ConfirmAction>
          </div>
        ))}
        {!state?.installed.length && (
          <Empty>
            <EmptyTitle>尚未发现 Node 版本</EmptyTitle>
            <EmptyDescription>安装版本后会显示在这里。</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  )

  const releasesPanel = (
    <Card>
      <CardHeader>
        <CardTitle>可安装版本</CardTitle>
        <CardDescription>版本索引来自 Node.js 官方源，支持 LTS 和 Current 筛选。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索版本，例如 22"
            value={keyword}
          />
          <Select onValueChange={(value) => setChannel(value as typeof channel)} value={channel}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="lts">LTS</SelectItem>
              <SelectItem value="current">Current</SelectItem>
            </SelectContent>
          </Select>
          <TooltipButton
            onClick={refreshReleases}
            size="icon"
            tooltip="刷新版本"
            variant="secondary"
          >
            <RefreshCw size={14} />
          </TooltipButton>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {releases.slice(0, 20).map((release) => (
            <div
              className="flex items-center gap-2 rounded-md border border-slate-100 px-2.5 py-2"
              key={release.version}
            >
              <span className="font-mono text-xs">{release.version}</span>
              {release.lts && <Badge variant="success">{release.lts}</Badge>}
              <span className="flex-1" />
              <Button
                onClick={() => install(release.version.replace(/^v/, ''))}
                size="sm"
                variant="secondary"
              >
                <Download size={13} />
                安装
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">{status}</p>
      </CardContent>
    </Card>
  )

  const environmentPanel = (
    <Card>
      <CardHeader>
        <CardTitle>环境信息</CardTitle>
        <CardDescription>当前 Node、包管理器和镜像的真实状态。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {[
          ['Node 路径', state?.nodePath],
          ['当前版本', state?.currentVersion],
          ['默认版本', state?.defaultVersion],
          ['nvm', state?.nvmAvailable ? '可用' : '不可用'],
          ['nrm', state?.nrmAvailable ? '可用' : '不可用'],
          ['镜像', state?.registry],
          ['默认包管理器', state ? `${state.packageManager} ${state.packageManagerVersion}` : '--']
        ].map(([label, value]) => (
          <div className="rounded-md border border-slate-100 p-2.5" key={label}>
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className="mt-1 truncate text-xs font-medium">{value || '--'}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )

  const taskPanel = (
    <Card>
      <CardHeader>
        <CardTitle>安装任务</CardTitle>
        <CardDescription>任务状态和日志会持久化，失败后仍可查看原因。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Accordion className="space-y-2" type="multiple">
          {state?.tasks
            .slice()
            .reverse()
            .map((task) => (
              <AccordionItem key={task.id} value={task.id}>
                <AccordionTrigger>
                  <span className="font-mono">Node {task.version}</span>
                  <Badge variant={task.status === 'completed' ? 'success' : 'secondary'}>
                    {task.message}
                  </Badge>
                  <span className="ml-auto mr-2 text-[11px] text-slate-400">{task.progress}%</span>
                </AccordionTrigger>
                <AccordionContent>
                  <Progress className="mb-2" value={task.progress} />
                  <ScrollArea className="max-h-40 rounded-md bg-slate-50">
                    <pre className="whitespace-pre-wrap p-2 text-[11px] text-slate-600">
                      {task.logs.join('\n') || '暂无日志'}
                    </pre>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            ))}
        </Accordion>
        {!state?.tasks.length && (
          <Empty>
            <EmptyTitle>暂无 Node 安装任务</EmptyTitle>
            <EmptyDescription>安装或切换版本后，任务记录会显示在这里。</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  )

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ['当前版本', state?.currentVersion || '--'],
          ['默认版本', state?.defaultVersion || '--'],
          ['包管理器', state ? `${state.packageManager} ${state.packageManagerVersion}` : '--'],
          ['镜像', state?.registry || '--']
        ].map(([label, value]) => (
          <Card className="p-3" key={label}>
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className="mt-1 truncate text-xs font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <Tabs
        items={[
          { value: 'available', label: '可安装版本', content: releasesPanel },
          { value: 'installed', label: '已安装版本', content: installedPanel },
          {
            value: 'registry',
            label: 'nrm 镜像',
            content: <RegistryPanel onState={setState} report={report} state={state} />
          },
          {
            value: 'managers',
            label: '包管理器',
            content: (
              <PackagePanel onState={setState} report={report} section="managers" state={state} />
            )
          },
          {
            value: 'packages',
            label: '全局包',
            content: (
              <PackagePanel onState={setState} report={report} section="packages" state={state} />
            )
          },
          {
            value: 'environment',
            label: '环境信息',
            content: (
              <div className="space-y-3">
                {environmentPanel}
                <CachePanel onState={setState} report={report} state={state} />
                {taskPanel}
              </div>
            )
          }
        ]}
      />
    </div>
  )
}
