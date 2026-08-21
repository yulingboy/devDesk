import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { NodeState, NodeTask } from '@shared/domain'
import { Tabs } from '@/components/ui/tabs'
import { CachePanel } from './components/CachePanel'
import { PackagePanel } from './components/PackagePanel'
import { RegistryPanel } from './components/RegistryPanel'
import { AvailableVersionsPanel, type ReleaseChannel } from './components/AvailableVersionsPanel'
import { EnvironmentPathsPanel } from './components/EnvironmentPathsPanel'
import { InstalledVersionsPanel } from './components/InstalledVersionsPanel'
import { NodeSummaryHeader } from './components/NodeSummaryHeader'
import { NodeTaskPanel } from './components/NodeTaskPanel'
import { NodeDownloadSourceDrawer } from './components/NodeDownloadSourceDrawer'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { useNodeEnvironmentPaths } from './hooks/useNodeEnvironmentPaths'
import { useNodeReleases } from './hooks/useNodeReleases'
import { useAsyncAction } from '@/hooks/useAsyncAction'

export function NodePage(): React.JSX.Element {
  const [state, setState] = useState<NodeState | null>(null)
  const [tasks, setTasks] = useState<NodeTask[]>([])
  const [activeTab, setActiveTab] = useState('available')
  const [activeEnvironmentTab, setActiveEnvironmentTab] = useState('paths')
  const [cacheLoading, setCacheLoading] = useState(false)
  const [versionAction, setVersionAction] = useState('')
  const [downloadSourceOpen, setDownloadSourceOpen] = useState(false)
  const cacheScanRequested = useRef(false)
  const initialLoadRequested = useRef(false)
  const [loading, setLoading] = useState(true)
  const { report } = usePageFeedback('Node 操作失败', { keepStatus: false })
  const { run } = useAsyncAction(report)
  const {
    keyword,
    setKeyword,
    channel,
    setChannel,
    page: releasePage,
    setPage: setReleasePage,
    pageCount: releasePageCount,
    total: releaseTotal,
    visibleReleases,
    loading: releasesLoading,
    refresh: refreshReleases
  } = useNodeReleases(report)
  const {
    paths: environmentPaths,
    loading: environmentLoading,
    refresh: loadEnvironmentPaths
  } = useNodeEnvironmentPaths(
    activeTab === 'environment' && activeEnvironmentTab === 'paths',
    report
  )
  const load = useCallback(
    (notify = false): void => {
      setLoading(true)
      void window.api?.node
        .getState(notify)
        .then((value) => {
          setState(value)
          setTasks(value.tasks)
          if (notify) toast.success('Node 状态已刷新')
        })
        .catch(report)
        .finally(() => setLoading(false))
    },
    [report]
  )
  useEffect(() => {
    if (initialLoadRequested.current) return
    initialLoadRequested.current = true
    load()
  }, [load, report])
  useEffect(() => {
    return window.api?.node.onTaskUpdated((value) => {
      setState(value)
      setTasks(value.tasks)
    })
  }, [])
  /** 缓存目录统计可能耗时较长，仅在用户打开缓存页签后按需执行。 */
  const scanCaches = useCallback(
    (notify = false): void => {
      setCacheLoading(true)
      void window.api?.node
        .scanCaches()
        .then((value) => {
          setState(value)
          if (notify) toast.success('缓存占用已重新统计')
        })
        .catch(report)
        .finally(() => {
          cacheScanRequested.current = false
          setCacheLoading(false)
        })
    },
    [report]
  )
  useEffect(() => {
    if (
      activeTab === 'environment' &&
      activeEnvironmentTab === 'caches' &&
      !state?.caches.length &&
      !cacheLoading &&
      !cacheScanRequested.current
    ) {
      cacheScanRequested.current = true
      void Promise.resolve().then(() => scanCaches())
    }
  }, [activeEnvironmentTab, activeTab, cacheLoading, scanCaches, state?.caches.length])
  const install = (version: string): void => {
    if (versionAction) return
    setVersionAction(`install:${version}`)
    toast.info(`正在安装 Node ${version}...`)
    void window.api?.node
      .install({ version })
      .then((value) => {
        setState(value)
        setTasks(value.tasks)
        toast.success('Node 安装任务已完成')
      })
      .catch(report)
      .finally(() => setVersionAction(''))
  }

  /** 切换和设置默认都需要回写完整状态，避免按钮成功后徽标仍停留在旧快照。 */
  const changeVersion = (version: string, setDefault: boolean): void => {
    const actionId = `${setDefault ? 'default' : 'switch'}:${version}`
    if (versionAction) return
    setVersionAction(actionId)
    void window.api?.node
      .switch(version, setDefault)
      .then((value) => {
        setState(value)
        setTasks(value.tasks)
        toast.success(
          setDefault ? `已将 Node ${version} 设为默认版本` : `工作台已切换到 Node ${version}`
        )
      })
      .catch(report)
      .finally(() => setVersionAction(''))
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden p-3">
      <NodeSummaryHeader loading={loading} onRefresh={() => load(true)} state={state} />
      <Tabs
        className="min-h-0 flex-1"
        contentClassName="overflow-hidden"
        fill
        items={[
          {
            value: 'available',
            label: '可安装版本',
            content: (
              <AvailableVersionsPanel
                channel={channel as ReleaseChannel}
                keyword={keyword}
                onChannelChange={(value) => {
                  setChannel(value)
                  setReleasePage(1)
                }}
                onInstall={install}
                onConfigureSource={() => setDownloadSourceOpen(true)}
                onKeywordChange={(value) => {
                  setKeyword(value)
                  setReleasePage(1)
                }}
                onPageChange={setReleasePage}
                onRefresh={refreshReleases}
                releasePage={releasePage}
                releasePageCount={releasePageCount}
                releaseTotal={releaseTotal}
                releasesLoading={releasesLoading}
                state={state}
                versionAction={versionAction}
                visibleReleases={visibleReleases}
              />
            )
          },
          {
            value: 'installed',
            label: '已安装版本',
            content: (
              <InstalledVersionsPanel
                loading={loading}
                onChangeVersion={changeVersion}
                onRefresh={() => load(true)}
                onRemove={(item) => {
                  void run(
                    `node-remove:${item.version}`,
                    () => window.api!.node.remove(item.version),
                    { success: `Node ${item.version} 已删除` }
                  ).then((value) => {
                    if (value) {
                      setState(value)
                      setTasks(value.tasks)
                    }
                  })
                }}
                state={state}
                versionAction={versionAction}
              />
            )
          },
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
                className="h-full"
                fill
                items={[
                  {
                    value: 'paths',
                    label: '运行时路径',
                    content: (
                      <EnvironmentPathsPanel
                        loading={environmentLoading}
                        onRefresh={loadEnvironmentPaths}
                        paths={environmentPaths}
                      />
                    )
                  },
                  {
                    value: 'caches',
                    label: '缓存占用',
                    content: (
                      <CachePanel
                        loading={cacheLoading}
                        onScan={() => scanCaches(true)}
                        onState={setState}
                        report={report}
                        state={state}
                      />
                    )
                  },
                  {
                    value: 'tasks',
                    label: '安装任务',
                    content: (
                      <NodeTaskPanel
                        onState={(value) => {
                          setState(value)
                          setTasks(value.tasks)
                        }}
                        state={state}
                        tasks={tasks}
                      />
                    )
                  }
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
      {downloadSourceOpen && (
        <NodeDownloadSourceDrawer
          onClose={() => setDownloadSourceOpen(false)}
          onSaved={refreshReleases}
          open
        />
      )}
    </div>
  )
}
