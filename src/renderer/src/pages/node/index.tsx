import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw, Trash2 } from 'lucide-react'
import type { NodeRelease, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { rendererLogger } from '@/lib/logger'
import { CachePanel } from './components/CachePanel'
import { PackagePanel } from './components/PackagePanel'
import { RegistryPanel } from './components/RegistryPanel'
import { PageHeader } from '@/components/PageHeader'

export function NodePage(): React.JSX.Element {
  const [state, setState] = useState<NodeState | null>(null)
  const [releases, setReleases] = useState<NodeRelease[]>([])
  const [keyword, setKeyword] = useState('')
  const [channel, setChannel] = useState<'all' | 'lts' | 'current'>('all')
  const [status, setStatus] = useState('')
  const report = useCallback((error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    rendererLogger.error('Node 操作失败', { error: message })
  }, [])
  const load = useCallback((): void => {
    void window.api?.node.getState().then(setState).catch(report)
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
    setStatus(`正在安装 Node ${version}...`)
    void window.api?.node
      .install({ version })
      .then((value) => {
        setState(value)
        setStatus('Node 安装任务已完成')
      })
      .catch(report)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader title="Node 管理" subtitle="管理版本、镜像、包管理器、全局包与缓存" />
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['当前版本', state?.currentVersion || '--'],
          ['默认版本', state?.defaultVersion || '--'],
          ['包管理器', state ? `${state.packageManager} ${state.packageManagerVersion}` : '--'],
          ['镜像', state?.registry || '--']
        ].map(([label, value]) => (
          <Card className="p-4" key={label}>
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-2 truncate text-sm font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>已安装版本</CardTitle>
            <CardDescription>当前版本不能直接删除，切换后再清理旧版本。</CardDescription>
          </div>
          <Button onClick={load} size="icon" title="刷新状态" variant="ghost">
            <RefreshCw size={16} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {state?.installed.map((install) => (
            <div
              className="flex items-center gap-3 rounded-md border border-slate-100 p-3"
              key={install.version}
            >
              <p className="font-mono text-sm">v{install.version}</p>
              {install.isCurrent && <Badge variant="success">当前</Badge>}
              {install.isDefault && <Badge variant="secondary">默认</Badge>}
              <span className="flex-1 text-xs text-slate-400">{install.path}</span>
              <Button
                onClick={() =>
                  void window.api?.node
                    .switch(install.version, true)
                    .then((value) => {
                      setState(value)
                      setStatus(`已切换到 Node ${install.version}`)
                    })
                    .catch(report)
                }
                size="sm"
                variant="ghost"
              >
                切换并设为默认
              </Button>
              <Button
                disabled={install.isCurrent}
                onClick={() => {
                  if (window.confirm(`删除 Node ${install.version}？`))
                    void window.api?.node.remove(install.version).then(setState).catch(report)
                }}
                size="icon"
                title="删除版本"
                variant="ghost"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          {!state?.installed.length && (
            <p className="py-6 text-center text-sm text-slate-400">
              尚未发现 nvm 管理的 Node 版本。
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>可安装版本</CardTitle>
          <CardDescription>版本索引来自 Node.js 官方源，支持 LTS 和 Current 筛选。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索版本，例如 22"
              value={keyword}
            />
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              onChange={(event) => setChannel(event.target.value as typeof channel)}
              value={channel}
            >
              <option value="all">全部</option>
              <option value="lts">LTS</option>
              <option value="current">Current</option>
            </select>
            <Button onClick={refreshReleases} size="icon" title="刷新版本" variant="secondary">
              <RefreshCw size={15} />
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {releases.slice(0, 20).map((release) => (
              <div
                className="flex items-center gap-3 rounded-md border border-slate-100 px-3 py-2"
                key={release.version}
              >
                <span className="font-mono text-sm">{release.version}</span>
                {release.lts && <Badge variant="success">{release.lts}</Badge>}
                <span className="flex-1" />
                <Button
                  onClick={() => install(release.version.replace(/^v/, ''))}
                  size="sm"
                  variant="secondary"
                >
                  <Download size={14} />
                  安装
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">{status}</p>
        </CardContent>
      </Card>
      <RegistryPanel onState={setState} report={report} state={state} />
      <PackagePanel onState={setState} report={report} state={state} />
      <CachePanel onState={setState} report={report} state={state} />
      <Card>
        <CardHeader>
          <CardTitle>安装任务</CardTitle>
          <CardDescription>任务状态和日志会持久化，失败后仍可查看原因。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {state?.tasks
            .slice()
            .reverse()
            .map((task) => (
              <details className="rounded-md border border-slate-100 p-3" key={task.id}>
                <summary className="flex cursor-pointer items-center gap-3 text-sm">
                  <span className="font-mono">Node {task.version}</span>
                  <Badge variant={task.status === 'completed' ? 'success' : 'secondary'}>
                    {task.message}
                  </Badge>
                  <span className="ml-auto text-xs text-slate-400">{task.progress}%</span>
                </summary>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  {task.logs.join('\n') || '暂无日志'}
                </pre>
              </details>
            ))}
          {!state?.tasks.length && (
            <p className="py-5 text-center text-sm text-slate-400">暂无 Node 安装任务。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
