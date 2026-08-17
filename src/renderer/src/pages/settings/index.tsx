import { useState } from 'react'
import {
  Activity,
  Database,
  Info,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Undo2
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { ConfirmAction } from '@/components/ConfirmAction'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { AboutPanel } from './components/AboutPanel'
import { AdvancedSettingsPanel } from './components/AdvancedSettingsPanel'
import { DataSettingsPanel } from './components/DataSettingsPanel'
import { EnvironmentCheckPanel } from './components/EnvironmentCheckPanel'
import { GeneralSettingsPanel } from './components/GeneralSettingsPanel'
import { SettingsPane } from './components/SettingsPane'
import { useSettingsPage } from './hooks/useSettingsPage'

export function SettingsPage(): React.JSX.Element {
  const page = useSettingsPage()
  const [activeTab, setActiveTab] = useState('general')
  const [pending, setPending] = useState<string>()

  if (page.loading) return <PageLoadingSkeleton />
  if (!page.draft || !page.persisted) {
    return (
      <div className="h-full p-3">
        <Alert variant="destructive">
          <ShieldAlert size={16} />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{page.errors.settings ?? '设置读取失败，请重试。'}</span>
            <Button onClick={page.retry} size="sm" variant="secondary">
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const run = async (key: string, operation: () => Promise<void>): Promise<void> => {
    if (pending) return
    setPending(key)
    try {
      await operation()
    } catch (error) {
      page.report(error)
    } finally {
      setPending(undefined)
    }
  }

  const dataPanel = (
    <DataSettingsPanel
      busy={pending === 'data'}
      error={page.errors.data}
      onClear={() =>
        void run('data', async () => {
          page.acceptSettings(await window.api!.settings.clearBusinessData())
          await page.refreshStats()
          toast.success('工作台数据已清空')
        })
      }
      onCopy={() =>
        void run('data', async () => {
          await navigator.clipboard.writeText(
            JSON.stringify(await window.api!.settings.export(), null, 2)
          )
          toast.success('数据快照已复制')
        })
      }
      onExport={() =>
        void run('data', async () => {
          const result = await window.api!.settings.exportFile()
          if (!result.cancelled) toast.success('备份文件已导出')
        })
      }
      onImport={() =>
        void run('data', async () => {
          const result = await window.api!.settings.importFile()
          if (!result.cancelled && result.value) {
            page.acceptSettings(result.value)
            await page.refreshStats()
            toast.success('备份数据已恢复')
          }
        })
      }
      onMigrate={() =>
        void run('data', async () => {
          const result = await window.api!.settings.changeDataDirectory()
          if (!result.cancelled && result.value) {
            page.acceptSettings(result.value)
            await page.refreshStats()
            toast.success('数据目录已迁移')
          }
        })
      }
      onOpen={() => void run('data', () => window.api!.settings.openData())}
      settings={page.draft}
      stats={page.dataStats}
    />
  )

  const advancedPanel = (
    <AdvancedSettingsPanel
      developerToolsActive={page.persisted.advanced.developerTools}
      logStats={page.logStats}
      onChange={(value) => page.setDraft(value)}
      onClearLogs={() =>
        void run('logs', async () => {
          await window.api!.settings.clearLogArchives()
          await page.refreshStats()
          toast.success('旧日志已清理')
        })
      }
      onOpenDeveloperTools={() => void window.api!.settings.openDeveloperTools().catch(page.report)}
      onOpenLogs={() => void window.api!.settings.openLogs().catch(page.report)}
      settings={page.draft}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/70">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)]">
          <Settings2 />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900">系统设置</div>
          <div className="truncate text-[11px] text-slate-500">
            管理应用行为、本地数据和开发环境
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={
              page.dirty
                ? 'mr-1 flex items-center gap-1.5 text-[11px] text-amber-600'
                : 'mr-1 flex items-center gap-1.5 text-[11px] text-slate-500'
            }
          >
            <span
              className={
                page.dirty
                  ? 'size-1.5 rounded-full bg-amber-500'
                  : 'size-1.5 rounded-full bg-emerald-500'
              }
            />
            {page.dirty ? '有未保存的修改' : '设置已同步'}
          </span>
          <Button disabled={!page.dirty || Boolean(pending)} onClick={page.discard} variant="ghost">
            <Undo2 />
            撤销
          </Button>
          <ConfirmAction
            description="恢复桌面行为和高级设置的默认值，不会删除业务数据。"
            onConfirm={() => page.reset()}
            title="恢复默认设置？"
          >
            <Button disabled={Boolean(pending)} variant="secondary">
              <RotateCcw />
              重置
            </Button>
          </ConfirmAction>
          <Button
            disabled={!page.dirty || Boolean(pending)}
            onClick={() => void run('save', page.save)}
            variant="success"
          >
            {pending === 'save' ? <Spinner /> : <Save />}保存
          </Button>
        </div>
      </div>
      {page.errors.operation && (
        <Alert className="m-3 mb-0 shrink-0" variant="destructive">
          <AlertDescription>{page.errors.operation}</AlertDescription>
        </Alert>
      )}
      <Tabs
        className="min-h-0 flex-1 gap-0"
        contentClassName="dashboard-scroll bg-slate-50/70 px-6 py-5"
        fill
        items={[
          {
            value: 'general',
            label: '通用设置',
            icon: <SlidersHorizontal />,
            content: (
              <SettingsPane description="设置 DevDesk 启动和关闭时的默认行为。" title="通用设置">
                <GeneralSettingsPanel
                  onChange={(value) => page.setDraft(value)}
                  settings={page.draft}
                />
              </SettingsPane>
            )
          },
          {
            value: 'data',
            label: '数据管理',
            icon: <Database />,
            content: (
              <SettingsPane description="查看存储占用，管理数据位置与备份。" title="数据管理">
                {dataPanel}
              </SettingsPane>
            )
          },
          {
            value: 'advanced',
            label: '高级设置',
            icon: <SlidersHorizontal />,
            content: (
              <SettingsPane description="管理诊断日志和本地调试能力。" title="高级设置">
                {advancedPanel}
              </SettingsPane>
            )
          },
          {
            value: 'environment',
            label: '环境检测',
            icon: <Activity />,
            content: (
              <SettingsPane
                className="max-w-5xl"
                description="按技术栈检查本机开发工具的安装和运行状态。"
                title="环境检测"
              >
                <EnvironmentCheckPanel report={page.report} />
              </SettingsPane>
            )
          },
          {
            value: 'about',
            label: '关于',
            icon: <Info />,
            content: (
              <SettingsPane description="查看应用版本、运行时与构建信息。" title="关于 DevDesk">
                <AboutPanel error={page.errors.runtime} runtime={page.runtime} />
              </SettingsPane>
            )
          }
        ]}
        listClassName="h-11 shrink-0 gap-1 bg-white px-5"
        onValueChange={setActiveTab}
        triggerClassName="h-11 gap-2 px-3 text-xs"
        value={activeTab}
      />
    </div>
  )
}
