import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2
} from 'lucide-react'
import type { NodeEnvironmentPath, NodeRelease, NodeState, NodeTask } from '@shared/domain'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { TooltipButton } from '@/components/TooltipButton'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { CachePanel } from './components/CachePanel'
import { PackagePanel } from './components/PackagePanel'
import { RegistryPanel } from './components/RegistryPanel'

export function NodePage(): React.JSX.Element {
  const [state, setState] = useState<NodeState | null>(null)
  const [releases, setReleases] = useState<NodeRelease[]>([])
  const [keyword, setKeyword] = useState('')
  const [channel, setChannel] = useState<'all' | 'lts' | 'current'>('all')
  const [releasePage, setReleasePage] = useState(1)
  const [status, setStatus] = useState('')
  const [environmentPaths, setEnvironmentPaths] = useState<NodeEnvironmentPath[]>([])
  const [tasks, setTasks] = useState<NodeTask[]>([])
  const [releasesLoading, setReleasesLoading] = useState(true)
  const [environmentLoading, setEnvironmentLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('available')
  const [activeEnvironmentTab, setActiveEnvironmentTab] = useState('paths')
  const [cacheLoading, setCacheLoading] = useState(false)
  const cacheScanRequested = useRef(false)
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
      .then((value) => {
        setState(value)
        setTasks(value.tasks)
      })
      .catch(report)
      .finally(() => setLoading(false))
  }, [report])
  useEffect(() => {
    load()
    void window.api?.node
      .releases({ channel: 'all' })
      .then(setReleases)
      .catch(report)
      .finally(() => setReleasesLoading(false))
    void window.api?.node
      .environmentPaths()
      .then(setEnvironmentPaths)
      .catch(report)
      .finally(() => setEnvironmentLoading(false))
    void window.api?.node.tasks().then(setTasks).catch(report)
    return window.api?.node.onTaskUpdated((value) => {
      setState(value)
      setTasks(value.tasks)
    })
  }, [load, report])
  const refreshReleases = (): void => {
    setReleasesLoading(true)
    void window.api?.node
      .releases({ channel: 'all', refresh: true })
      .then(setReleases)
      .catch(report)
      .finally(() => setReleasesLoading(false))
  }
  const filteredReleases = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return releases.filter((release) => {
      const matchesChannel =
        channel === 'all' || (channel === 'lts' ? Boolean(release.lts) : release.lts === false)
      const matchesKeyword =
        !normalized ||
        release.version.toLowerCase().includes(normalized) ||
        release.lts?.toString().toLowerCase().includes(normalized) ||
        release.npm?.toLowerCase().includes(normalized)
      return matchesChannel && matchesKeyword
    })
  }, [channel, keyword, releases])
  const releasePageSize = 25
  const releasePageCount = Math.max(1, Math.ceil(filteredReleases.length / releasePageSize))
  const visibleReleases = filteredReleases.slice(
    (Math.min(releasePage, releasePageCount) - 1) * releasePageSize,
    Math.min(releasePage, releasePageCount) * releasePageSize
  )
  /** 缓存目录统计可能耗时较长，仅在用户打开缓存页签后按需执行。 */
  const scanCaches = useCallback((): void => {
    setCacheLoading(true)
    void window.api?.node
      .scanCaches()
      .then(setState)
      .catch(report)
      .finally(() => {
        cacheScanRequested.current = false
        setCacheLoading(false)
      })
  }, [report])
  useEffect(() => {
    if (
      activeTab === 'environment' &&
      activeEnvironmentTab === 'caches' &&
      !state?.caches.length &&
      !cacheLoading &&
      !cacheScanRequested.current
    ) {
      cacheScanRequested.current = true
      void Promise.resolve().then(scanCaches)
    }
  }, [activeEnvironmentTab, activeTab, cacheLoading, scanCaches, state?.caches.length])
  const install = (version: string): void => {
    toast.info(`正在安装 Node ${version}...`)
    void window.api?.node
      .install({ version })
      .then((value) => {
        setState(value)
        setTasks(value.tasks)
        toast.success('Node 安装任务已完成')
      })
      .catch(report)
  }

  const installedPanel = (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>已安装版本</CardTitle>
          <CardDescription>
            “使用”会打开已启用该版本的新终端；当前版本不能直接删除。
          </CardDescription>
        </div>
        <TooltipButton onClick={load} size="icon" tooltip="刷新状态" variant="ghost">
          <RefreshCw size={15} />
        </TooltipButton>
      </CardHeader>
      <CardContent className="space-y-2">
        {state?.installed.map((item) => (
          <Item key={item.version}>
            <ItemContent className="flex min-w-0 flex-row items-center gap-2">
              <ItemTitle className="font-mono">v{item.version}</ItemTitle>
              {item.isCurrent && <Badge variant="success">当前</Badge>}
              {item.isDefault && <Badge variant="secondary">默认</Badge>}
              <ItemDescription className="flex-1">{item.path}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                disabled={!state?.capabilities?.canUseInTerminal}
                onClick={() =>
                  void window.api?.node
                    .useInTerminal(item.version)
                    .then(() => toast.success(`已在新终端中启用 Node ${item.version}`))
                    .catch(report)
                }
                size="sm"
                variant="ghost"
              >
                在终端中使用
              </Button>
              <Button
                disabled={item.isDefault || !state?.capabilities?.canSetDefault}
                onClick={() =>
                  void window.api?.node
                    .switch(item.version, true)
                    .then((value) => {
                      setState(value)
                      setTasks(value.tasks)
                      toast.success(`已将 Node ${item.version} 设为默认版本`)
                    })
                    .catch(report)
                }
                size="sm"
                variant="secondary"
              >
                设为默认
              </Button>
              <ConfirmAction
                description={`将删除本机 nvm 管理的 Node ${item.version}。当前使用中的版本不能删除。`}
                onConfirm={() =>
                  void window.api?.node.remove(item.version).then(setState).catch(report)
                }
                title="删除 Node 版本？"
                triggerTooltip="删除版本"
              >
                <Button
                  aria-label="删除版本"
                  disabled={item.isCurrent || !state?.capabilities?.canSwitch}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 size={14} />
                </Button>
              </ConfirmAction>
            </ItemActions>
          </Item>
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
            onChange={(event) => {
              setKeyword(event.target.value)
              setReleasePage(1)
            }}
            placeholder="搜索版本、LTS 或 npm"
            value={keyword}
          />
          <Select
            onValueChange={(value) => {
              setChannel(value as typeof channel)
              setReleasePage(1)
            }}
            value={channel}
          >
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
          {releasesLoading &&
            Array.from({ length: 8 }, (_, index) => (
              <div
                className="flex h-12 items-center justify-between border border-slate-100 px-3"
                key={index}
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          {!releasesLoading &&
            visibleReleases.map((release) => (
              <Item key={release.version}>
                <ItemContent className="flex flex-row items-center gap-2">
                  <ItemTitle className="font-mono">{release.version}</ItemTitle>
                  {release.lts && <Badge variant="success">{release.lts}</Badge>}
                  {release.security && <Badge variant="outline">安全更新</Badge>}
                  {state?.installed.some(
                    (item) => item.version === release.version.replace(/^v/, '')
                  ) && <Badge variant="outline">已安装</Badge>}
                  {!release.platformSupported && <Badge variant="secondary">当前平台不可用</Badge>}
                  <ItemDescription className="ml-auto">
                    {release.date || '--'} · npm {release.npm || '--'}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    disabled={
                      !release.platformSupported ||
                      !state?.capabilities?.canInstall ||
                      state?.installed.some(
                        (item) => item.version === release.version.replace(/^v/, '')
                      )
                    }
                    onClick={() => install(release.version.replace(/^v/, ''))}
                    size="sm"
                    variant="secondary"
                  >
                    <Download size={13} />
                    安装
                  </Button>
                </ItemActions>
              </Item>
            ))}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {status ||
              (releasesLoading
                ? '正在读取 Node 官方版本索引'
                : `共 ${filteredReleases.length} 个版本`)}
          </span>
          <div className="flex items-center gap-1">
            <TooltipButton
              disabled={releasePage <= 1}
              onClick={() => setReleasePage((page) => Math.max(1, page - 1))}
              size="icon"
              tooltip="上一页"
              variant="ghost"
            >
              <ChevronLeft size={14} />
            </TooltipButton>
            <span>
              {Math.min(releasePage, releasePageCount)} / {releasePageCount}
            </span>
            <TooltipButton
              disabled={releasePage >= releasePageCount}
              onClick={() => setReleasePage((page) => Math.min(releasePageCount, page + 1))}
              size="icon"
              tooltip="下一页"
              variant="ghost"
            >
              <ChevronRight size={14} />
            </TooltipButton>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const environmentPanel = (
    <Card>
      <CardHeader>
        <CardTitle>运行时路径</CardTitle>
        <CardDescription>路径快照用于定位 Node、nvm 和各包管理器的实际数据位置。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {environmentLoading &&
          Array.from({ length: 5 }, (_, index) => <Skeleton className="h-12 w-full" key={index} />)}
        {!environmentLoading &&
          environmentPaths.map((item) => (
            <Item className="px-1" key={item.name}>
              <ItemContent>
                <ItemTitle>{item.name}</ItemTitle>
                <ItemDescription className="font-mono" title={item.path}>
                  {item.path}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant={item.exists ? 'success' : 'outline'}>
                  {item.exists ? '存在' : '未找到'}
                </Badge>
                <TooltipButton
                  disabled={!item.exists}
                  onClick={() => void window.api?.node.openPath(item.path).catch(report)}
                  size="icon"
                  tooltip="打开目录"
                  variant="ghost"
                >
                  <FolderOpen size={14} />
                </TooltipButton>
              </ItemActions>
            </Item>
          ))}
        {!environmentLoading && !environmentPaths.length && (
          <Empty className="min-h-20 py-3">
            <EmptyTitle>未读取到环境路径</EmptyTitle>
            <EmptyDescription>请刷新 Node 状态后重试。</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  )

  const taskPanel = (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>安装任务</CardTitle>
          <CardDescription>
            任务状态和日志会持久化，失败任务可重试，历史可单独清理。
          </CardDescription>
        </div>
        <ConfirmAction
          description="将清理已完成、已失败和已取消的任务记录；正在执行的安装任务会保留。"
          onConfirm={() =>
            void window.api?.node
              .clearTasks()
              .then((value) => {
                setState(value)
                setTasks(value.tasks)
              })
              .catch(report)
          }
          title="清理任务历史？"
        >
          <Button size="sm" variant="ghost">
            <Trash2 size={14} />
            清理历史
          </Button>
        </ConfirmAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <Accordion className="space-y-2" type="multiple">
          {(tasks.length ? tasks : (state?.tasks ?? []))
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
                  <div className="mt-2 flex justify-end gap-1">
                    {['waiting', 'downloading', 'extracting'].includes(task.status) && (
                      <ConfirmAction
                        description={`将终止 Node ${task.version} 的安装任务，并清除未完成的安装文件。`}
                        onConfirm={() =>
                          void window.api?.node
                            .cancelTask(task.id)
                            .then((value) => {
                              setState(value)
                              setTasks(value.tasks)
                            })
                            .catch(report)
                        }
                        title="取消安装任务？"
                      >
                        <Button size="sm" variant="secondary">
                          <Square size={13} />
                          取消任务
                        </Button>
                      </ConfirmAction>
                    )}
                    {['failed', 'cancelled'].includes(task.status) && (
                      <Button
                        onClick={() =>
                          void window.api?.node
                            .retryTask(task.id)
                            .then((value) => {
                              setState(value)
                              setTasks(value.tasks)
                            })
                            .catch(report)
                        }
                        size="sm"
                        variant="secondary"
                      >
                        <RotateCcw size={13} />
                        重试
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
        </Accordion>
        {!tasks.length && !state?.tasks.length && (
          <Empty>
            <EmptyTitle>暂无 Node 安装任务</EmptyTitle>
            <EmptyDescription>安装或切换版本后，任务记录会显示在这里。</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  )

  if (loading) return <PageLoadingSkeleton />
  const warnings = [
    !state?.capabilities?.canInstall ? (state?.capabilities?.message ?? '') : '',
    !state?.packageManagerVersion
      ? `默认包管理器 ${state?.packageManager || ''} 不可用，全局包操作将被禁用。`
      : ''
  ].filter(Boolean)
  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden p-3">
      <section className="shrink-0 border-b border-slate-200 pb-2.5">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Node 管理</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              管理运行时版本、镜像、包管理器与全局包。
            </p>
          </div>
          <TooltipButton onClick={load} size="icon" tooltip="刷新 Node 状态" variant="ghost">
            <RefreshCw size={15} />
          </TooltipButton>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ['当前版本', state?.currentVersion || '--'],
            ['默认版本', state?.defaultVersion || '--'],
            [
              '包管理器',
              state ? `${state.packageManager} ${state.packageManagerVersion || '不可用'}` : '--'
            ],
            [
              '运行环境',
              `nvm ${state?.nvmAvailable ? '可用' : '不可用'} · nrm ${state?.nrmAvailable ? '可用' : '不可用'}`
            ]
          ].map(([label, value]) => (
            <div className="border border-slate-200 bg-white px-2.5 py-2" key={label}>
              <p className="text-[11px] text-slate-400">{label}</p>
              <p className="mt-1 truncate text-xs font-semibold">{value}</p>
            </div>
          ))}
        </div>
        {!!warnings.length && (
          <Alert className="mt-2" variant="warning">
            <AlertTriangle size={15} />
            <AlertDescription>{warnings.join(' ')}</AlertDescription>
          </Alert>
        )}
      </section>
      <Tabs
        className="min-h-0 flex-1"
        fill
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
              <Tabs
                items={[
                  { value: 'paths', label: '运行时路径', content: environmentPanel },
                  {
                    value: 'caches',
                    label: '缓存占用',
                    content: (
                      <CachePanel
                        loading={cacheLoading}
                        onScan={scanCaches}
                        onState={setState}
                        report={report}
                        state={state}
                      />
                    )
                  },
                  { value: 'tasks', label: '安装任务', content: taskPanel }
                ]}
                onValueChange={setActiveEnvironmentTab}
                value={activeEnvironmentTab}
              />
            )
          }
        ]}
        onValueChange={setActiveTab}
        value={activeTab}
      />
    </div>
  )
}
