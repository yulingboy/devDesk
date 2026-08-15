import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Code2, Database, FolderOpen, RotateCcw, Save, ShieldAlert } from 'lucide-react'
import type { AppSettings, DataStats, ThemeName } from '@shared/domain'
import type { RuntimeInfo } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs } from '@/components/ui/tabs'
import { rendererLogger } from '@/lib/logger'
import { applyTheme } from '@/lib/theme'
import { EnvironmentCheckPanel } from './components/EnvironmentCheckPanel'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'

const themeOptions: Array<{ value: ThemeName; label: string; color: string }> = [
  { value: 'blue', label: '蓝色', color: '#2563eb' },
  { value: 'purple', label: '紫色', color: '#9333ea' },
  { value: 'green', label: '绿色', color: '#16a34a' },
  { value: 'orange', label: '橙色', color: '#ea580c' },
  { value: 'rose', label: '玫红', color: '#e11d48' },
  { value: 'cyan', label: '青色', color: '#0891b2' },
  { value: 'indigo', label: '靛蓝', color: '#4f46e5' },
  { value: 'teal', label: '蓝绿', color: '#0d9488' }
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
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    toast.error(message)
    rendererLogger.error('设置操作失败', { error: message })
  }
  const load = (): void => {
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
      .finally(() => setLoading(false))
  }
  const retry = (): void => {
    setLoading(true)
    load()
  }
  useEffect(load, [])
  if (loading) return <PageLoadingSkeleton />
  if (!settings) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <Alert variant="destructive">
          <ShieldAlert size={16} />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{status || '设置读取失败，请重试。'}</span>
            <Button onClick={retry} size="sm" variant="secondary">
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  const save = (): void => {
    void window.api?.settings
      .save(settings)
      .then((value) => {
        setSettings(value)
        applyTheme(value.general.theme)
        setStatus('')
        toast.success('设置已保存')
      })
      .catch(report)
  }
  const reset = (): void => {
    void window.api?.settings
      .reset()
      .then((value) => {
        setSettings(value)
        applyTheme(value.general.theme)
        toast.success('设置已恢复默认值')
      })
      .catch(report)
  }
  const clear = (): void => {
    void window.api?.settings
      .clearBusinessData()
      .then((value) => {
        setSettings(value)
        toast.success('业务数据已清空')
        void window.api?.settings.dataStats().then(setDataStats)
      })
      .catch(report)
  }

  const general = (
    <Card>
      <CardHeader>
        <CardTitle>通用设置</CardTitle>
        <CardDescription>设置会保存到本机数据目录，并在下次启动时恢复。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>主题色</Label>
          <ToggleGroup
            className="grid grid-cols-4"
            onValueChange={(value) => {
              if (!value) return
              applyTheme(value as ThemeName)
              setSettings({
                ...settings,
                general: { ...settings.general, theme: value as ThemeName }
              })
            }}
            type="single"
            value={settings.general.theme}
          >
            {themeOptions.map((theme) => (
              <ToggleGroupItem
                aria-label={`使用${theme.label}主题`}
                key={theme.value}
                value={theme.value}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: theme.color }} />
                {theme.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={settings.general.launchAtLogin}
            onCheckedChange={(checked) =>
              setSettings({
                ...settings,
                general: { ...settings.general, launchAtLogin: checked }
              })
            }
          />
          开机自启
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={settings.general.minimizeToTray}
            onCheckedChange={(checked) =>
              setSettings({
                ...settings,
                general: { ...settings.general, minimizeToTray: checked }
              })
            }
          />
          关闭窗口时最小化到托盘
        </label>
        <div className="flex gap-2">
          <Button onClick={save} variant="success">
            <Save size={14} />
            保存设置
          </Button>
          <ConfirmAction
            description="将主题、启动行为和高级设置恢复为默认值，不会删除业务数据。"
            onConfirm={reset}
            title="恢复默认设置？"
          >
            <Button variant="secondary">
              <RotateCcw size={14} />
              重置
            </Button>
          </ConfirmAction>
        </div>
        {status && (
          <Alert variant="destructive">
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )

  const data = (
    <Card>
      <CardHeader>
        <CardTitle>数据管理</CardTitle>
        <CardDescription>当前目录和导入导出入口，统计来自真实业务存储。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          <Database size={13} className="mr-1" />
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
          <FolderOpen size={14} />
          打开数据目录
        </Button>
        <Button
          onClick={() =>
            void window.api?.settings
              .changeDataDirectory()
              .then((value) => {
                setSettings(value)
                toast.success('数据目录已迁移并切换')
                void window.api?.settings.dataStats().then(setDataStats)
              })
              .catch(report)
          }
          variant="secondary"
        >
          <FolderOpen size={14} />
          更改数据目录
        </Button>
        <Button
          onClick={() =>
            void window.api?.settings
              .export()
              .then((value) =>
                navigator.clipboard
                  .writeText(JSON.stringify(value, null, 2))
                  .then(() => toast.success('数据快照 JSON 已复制，可保存为备份文件'))
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
              .then(() => toast.success('数据已导出'))
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
                toast.success('数据已导入')
                void window.api?.settings.dataStats().then(setDataStats)
              })
              .catch(report)
          }
          variant="outline"
        >
          导入文件
        </Button>
        <ConfirmAction
          description="将清空 Git 身份、SSH 元数据、工作区、模板和 Hosts 业务数据，此操作不可撤销。"
          onConfirm={clear}
          title="清空全部业务数据？"
        >
          <Button variant="destructive">
            <ShieldAlert size={14} />
            清空业务数据
          </Button>
        </ConfirmAction>
      </CardContent>
    </Card>
  )

  const advanced = (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Node 设置</CardTitle>
          <CardDescription>版本索引、下载源、默认包管理器和 Registry。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ['node-index', '版本索引', 'indexUrl'],
            ['node-source', '下载源', 'downloadSource'],
            ['node-registry', '默认 Registry', 'registry']
          ].map(([id, label, key]) => (
            <div className="space-y-1.5" key={id}>
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    node: { ...settings.node, [key]: event.target.value }
                  })
                }
                value={settings.node[key as 'indexUrl' | 'downloadSource' | 'registry']}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="node-package-manager">默认包管理器</Label>
            <Select
              onValueChange={(value) =>
                setSettings({ ...settings, node: { ...settings.node, packageManager: value } })
              }
              value={settings.node.packageManager}
            >
              <SelectTrigger id="node-package-manager">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['npm', 'pnpm', 'yarn', 'bun'].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>高级设置</CardTitle>
          <CardDescription>调整诊断日志，并按需打开开发者工具。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="log-level">日志级别</Label>
              <Select
                onValueChange={(value) =>
                  setSettings({
                    ...settings,
                    advanced: {
                      ...settings.advanced,
                      logLevel: value as AppSettings['advanced']['logLevel']
                    }
                  })
                }
                value={settings.advanced.logLevel}
              >
                <SelectTrigger id="log-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['debug', 'info', 'warn', 'error'].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 self-end pb-1 text-xs">
              <Switch
                checked={settings.advanced.developerTools}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    advanced: { ...settings.advanced, developerTools: checked }
                  })
                }
              />
              允许打开开发者工具
            </label>
          </div>
          <Button
            disabled={!settings.advanced.developerTools}
            onClick={() => void window.api?.settings.openDeveloperTools().catch(report)}
            variant="secondary"
          >
            <Code2 size={14} />
            打开开发者工具
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const about = (
    <Card>
      <CardHeader>
        <CardTitle>关于</CardTitle>
        <CardDescription>开发工坊本地开发环境管理工具</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-xs md:grid-cols-3">
        <div>
          <p className="text-[11px] text-slate-400">应用版本</p>
          <p className="mt-1 font-mono">{runtime?.appVersion || '--'}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Electron / Chrome</p>
          <p className="mt-1 font-mono">
            {runtime ? `${runtime.versions.electron} / ${runtime.versions.chrome}` : '--'}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Node / 架构</p>
          <p className="mt-1 font-mono">
            {runtime ? `${runtime.versions.node} / ${runtime.arch}` : '--'}
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="text-[11px] text-slate-400">许可证</p>
          <p className="mt-1">MIT License · 构建日期 {new Date().toLocaleDateString('zh-CN')}</p>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4">
      <Tabs
        items={[
          { value: 'general', label: '通用', content: general },
          { value: 'data', label: '数据', content: data },
          { value: 'advanced', label: '高级', content: advanced },
          {
            value: 'environment',
            label: '环境检测',
            content: <EnvironmentCheckPanel report={report} />
          },
          { value: 'about', label: '关于', content: about }
        ]}
        value={activeTab}
        onValueChange={setActiveTab}
      />
    </div>
  )
}
