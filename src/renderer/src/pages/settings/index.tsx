import { useEffect, useState } from 'react'
import { Code2, Database, FolderOpen, RotateCcw, Save, ShieldAlert } from 'lucide-react'
import type { AppSettings, DataStats, ThemeName } from '@shared/domain'
import type { RuntimeInfo } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rendererLogger } from '@/lib/logger'
import { applyTheme } from '@/lib/theme'
import { EnvironmentCheckPanel } from './components/EnvironmentCheckPanel'

const themeOptions: Array<{ value: ThemeName; label: string; color: string }> = [
  { value: 'light', label: '经典', color: '#202123' },
  { value: 'dark', label: '石墨', color: '#4f5b66' },
  { value: 'system', label: '跟随系统', color: '#8a8d91' },
  { value: 'blue', label: '蓝色', color: '#2563eb' },
  { value: 'green', label: '绿色', color: '#1f845a' },
  { value: 'orange', label: '橙色', color: '#c25a10' },
  { value: 'rose', label: '玫红', color: '#be3b63' },
  { value: 'violet', label: '紫色', color: '#7c4dcc' }
]

function formatBytes(value: number): string {
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 ** 2).toFixed(1)} MB`
}

export function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState('')
  const [dataStats, setDataStats] = useState<DataStats | null>(null)
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    rendererLogger.error('设置操作失败', { error: message })
  }
  useEffect(() => {
    void Promise.all([
      window.api?.settings.get(),
      window.api?.settings.dataStats(),
      window.api?.app.getRuntimeInfo()
    ])
      .then(([settingsValue, statsValue, runtimeValue]) => {
        if (settingsValue) setSettings(settingsValue)
        if (statsValue) setDataStats(statsValue)
        if (runtimeValue) setRuntime(runtimeValue)
      })
      .catch(report)
  }, [])
  if (!settings)
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-[#85878a]">正在读取设置...</div>
    )
  const save = (): void => {
    void window.api?.settings
      .save(settings)
      .then((value) => {
        setSettings(value)
        applyTheme(value.general.theme)
        setStatus('设置已保存')
      })
      .catch(report)
  }
  const reset = (): void => {
    if (window.confirm('恢复默认设置？'))
      void window.api?.settings
        .reset()
        .then((value) => {
          setSettings(value)
          applyTheme(value.general.theme)
          setStatus('设置已恢复默认值')
        })
        .catch(report)
  }
  const clear = (): void => {
    if (window.confirm('清空 Git、SSH、工作区、模板和 Hosts 业务数据？此操作不可撤销。'))
      void window.api?.settings
        .clearBusinessData()
        .then((value) => {
          setSettings(value)
          setStatus('业务数据已清空')
        })
        .catch(report)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-8 py-8">
      <Card>
        <CardHeader>
          <CardTitle>通用设置</CardTitle>
          <CardDescription>设置会保存到本机数据目录，并在下次启动时恢复。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>主题色</Label>
              <div className="grid grid-cols-4 gap-2">
                {themeOptions.map((theme) => (
                  <button
                    aria-label={`使用${theme.label}主题`}
                    className={`flex h-9 items-center gap-2 rounded-md border px-2 text-xs ${settings.general.theme === theme.value ? 'border-[#202123] bg-[#f2f2f0]' : 'border-[#d9dadb] bg-white'}`}
                    key={theme.value}
                    onClick={() => {
                      applyTheme(theme.value)
                      setSettings({
                        ...settings,
                        general: { ...settings.general, theme: theme.value }
                      })
                    }}
                    type="button"
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: theme.color }}
                    />
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={settings.general.launchAtLogin}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  general: { ...settings.general, launchAtLogin: event.target.checked }
                })
              }
              type="checkbox"
            />
            开机自启
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={settings.general.minimizeToTray}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  general: { ...settings.general, minimizeToTray: event.target.checked }
                })
              }
              type="checkbox"
            />
            关闭窗口时最小化到托盘
          </label>
          <div className="flex gap-2">
            <Button onClick={save} variant="success">
              <Save size={15} />
              保存设置
            </Button>
            <Button onClick={reset} variant="secondary">
              <RotateCcw size={15} />
              重置
            </Button>
          </div>
          <p className="text-xs text-[#777b80]">{status}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Node 设置</CardTitle>
          <CardDescription>
            版本索引、下载源、默认包管理器和 Registry 会被 Node 模块即时读取。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="node-index">版本索引</Label>
            <Input
              id="node-index"
              onChange={(event) =>
                setSettings({
                  ...settings,
                  node: { ...settings.node, indexUrl: event.target.value }
                })
              }
              value={settings.node.indexUrl}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-source">下载源</Label>
            <Input
              id="node-source"
              onChange={(event) =>
                setSettings({
                  ...settings,
                  node: { ...settings.node, downloadSource: event.target.value }
                })
              }
              value={settings.node.downloadSource}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-package-manager">默认包管理器</Label>
            <select
              className="h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm"
              id="node-package-manager"
              onChange={(event) =>
                setSettings({
                  ...settings,
                  node: { ...settings.node, packageManager: event.target.value }
                })
              }
              value={settings.node.packageManager}
            >
              {['npm', 'pnpm', 'yarn', 'bun'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-registry">默认 Registry</Label>
            <Input
              id="node-registry"
              onChange={(event) =>
                setSettings({
                  ...settings,
                  node: { ...settings.node, registry: event.target.value }
                })
              }
              value={settings.node.registry}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>数据管理</CardTitle>
          <CardDescription>当前目录和导入导出入口。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">
            <Database size={14} className="mr-1" />
            {settings.data.directory}
          </Badge>
          {dataStats && (
            <Badge variant="secondary">
              {formatBytes(dataStats.sizeBytes)} · {dataStats.fileCount} 个文件
            </Badge>
          )}
          {dataStats && (
            <Badge variant="secondary">
              {dataStats.gitIdentityCount} 个 Git 身份 · {dataStats.workspaceCount} 个工作区 ·{' '}
              {dataStats.sshKeyCount} 个 SSH 密钥
            </Badge>
          )}
          <Button
            onClick={() => void window.api?.settings.openData().catch(report)}
            variant="secondary"
          >
            <FolderOpen size={15} />
            打开数据目录
          </Button>
          <Button
            onClick={() =>
              void window.api?.settings
                .export()
                .then((data) =>
                  navigator.clipboard
                    .writeText(JSON.stringify(data, null, 2))
                    .then(() => setStatus('数据快照 JSON 已复制，可保存为备份文件'))
                )
                .catch(report)
            }
            variant="outline"
          >
            导出快照
          </Button>
          <Button
            onClick={() =>
              void window.api?.settings
                .exportFile()
                .then(() => setStatus('数据已导出'))
                .catch(report)
            }
            variant="outline"
          >
            导出文件
          </Button>
          <Button
            onClick={() =>
              void window.api?.settings
                .importFile()
                .then((value) => {
                  setSettings(value)
                  setStatus('数据已导入')
                })
                .catch(report)
            }
            variant="outline"
          >
            导入文件
          </Button>
          <Button onClick={clear} variant="outline">
            <ShieldAlert size={15} />
            清空业务数据
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>高级设置</CardTitle>
          <CardDescription>调整诊断日志，并按需打开受信任窗口的开发者工具。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="log-level">日志级别</Label>
              <select
                className="h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm"
                id="log-level"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    advanced: {
                      ...settings.advanced,
                      logLevel: event.target.value as AppSettings['advanced']['logLevel']
                    }
                  })
                }
                value={settings.advanced.logLevel}
              >
                {['debug', 'info', 'warn', 'error'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                checked={settings.advanced.developerTools}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    advanced: { ...settings.advanced, developerTools: event.target.checked }
                  })
                }
                type="checkbox"
              />
              允许打开开发者工具
            </label>
          </div>
          <Button
            disabled={!settings.advanced.developerTools}
            onClick={() => void window.api?.settings.openDeveloperTools().catch(report)}
            variant="secondary"
          >
            <Code2 size={15} />
            打开开发者工具
          </Button>
        </CardContent>
      </Card>
      <EnvironmentCheckPanel report={report} />
      <Card>
        <CardHeader>
          <CardTitle>关于</CardTitle>
          <CardDescription>开发工坊本地开发环境管理工具</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs text-[#85878a]">应用版本</p>
            <p className="mt-1 font-mono">{runtime?.appVersion || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-[#85878a]">Electron / Chrome</p>
            <p className="mt-1 font-mono">
              {runtime ? `${runtime.versions.electron} / ${runtime.versions.chrome}` : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#85878a]">Node / 架构</p>
            <p className="mt-1 font-mono">
              {runtime ? `${runtime.versions.node} / ${runtime.arch}` : '--'}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs text-[#85878a]">许可证</p>
            <p className="mt-1">MIT License · 构建日期 {new Date().toLocaleDateString('zh-CN')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
