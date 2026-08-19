import { useState } from 'react'
import { Database, Info, RotateCcw, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { AboutPanel } from './components/AboutPanel'
import { AdvancedSettingsPanel } from './components/AdvancedSettingsPanel'
import { DataSettingsPanel } from './components/DataSettingsPanel'
import { GeneralSettingsPanel } from './components/GeneralSettingsPanel'
import { SettingsPane } from './components/SettingsPane'
import { SettingsToolbar } from './components/SettingsToolbar'
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
              <RotateCcw />
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
      settings={page.draft}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/70">
      <SettingsToolbar
        dirty={page.dirty}
        onDiscard={page.discard}
        onReset={() => page.reset()}
        onSave={() => void run('save', page.save)}
        pending={Boolean(pending)}
      />
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
