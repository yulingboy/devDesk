import { Clipboard, Database, Download, FolderOpen, Import, ShieldAlert } from 'lucide-react'
import type { AppSettings, DataStats } from '@shared/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmAction } from '@/components/ConfirmAction'
import { SettingsSection } from './SettingsSection'

const formatBytes = (value: number): string =>
  value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 ** 2).toFixed(1)} MB`

export function DataSettingsPanel({
  settings,
  stats,
  busy,
  error,
  onOpen,
  onMigrate,
  onCopy,
  onExport,
  onImport,
  onClear
}: {
  settings: AppSettings
  stats: DataStats | null
  busy: boolean
  error?: string
  onOpen: () => void
  onMigrate: () => void
  onCopy: () => void
  onExport: () => void
  onImport: () => void
  onClear: () => void
}): React.JSX.Element {
  return (
    <div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="overflow-hidden">
        <SettingsSection description="业务数据保存在本机；迁移前会校验目标目录。" title="数据位置">
          <div className="flex min-w-0 items-center gap-2 border-t border-slate-100 pt-2.5">
            <Database className="shrink-0 text-slate-400" />
            <code
              className="min-w-0 flex-1 truncate text-[11px] text-slate-600"
              title={settings.data.directory}
            >
              {settings.data.directory}
            </code>
            <Button disabled={busy} onClick={onOpen} size="sm" variant="ghost">
              <FolderOpen />
              打开
            </Button>
            <Button disabled={busy} onClick={onMigrate} size="sm" variant="secondary">
              迁移
            </Button>
          </div>
        </SettingsSection>
        <SettingsSection
          description="导入会覆盖当前业务数据，操作前会再次确认。"
          title="备份与恢复"
        >
          <div className="flex flex-wrap gap-1.5">
            <Button disabled={busy} onClick={onCopy} variant="outline">
              <Clipboard />
              复制快照
            </Button>
            <Button disabled={busy} onClick={onExport} variant="outline">
              <Download />
              导出文件
            </Button>
            <ConfirmAction
              description="导入会覆盖当前工作台数据，但不会切换当前数据目录。建议先导出备份。"
              onConfirm={onImport}
              title="从备份恢复数据？"
            >
              <Button disabled={busy} variant="outline">
                <Import />
                导入文件
              </Button>
            </ConfirmAction>
          </div>
        </SettingsSection>
        <SettingsSection
          description="最多扫描 20,000 个目录项，大型目录可能为近似值。"
          title="存储统计"
        >
          {stats ? (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                {formatBytes(stats.sizeBytes)} · {stats.fileCount} 个文件
              </Badge>
              <Badge variant="secondary">{stats.workspaceCount} 个工作区</Badge>
              <Badge variant="secondary">{stats.gitIdentityCount} 个 Git 身份</Badge>
              <Badge variant="secondary">{stats.sshKeyCount} 个 SSH 密钥</Badge>
              {stats.truncated && (
                <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                  统计已截断
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">统计信息暂不可用</p>
          )}
        </SettingsSection>
        <SettingsSection
          description="清空 Hosts、SSH 元数据、Git 身份、工作区和模板，不删除 Node 运行时及日志。"
          title="危险操作"
        >
          <ConfirmAction
            description="此操作不可撤销。Node 运行时、缓存和日志不会被删除。"
            onConfirm={onClear}
            title="清空工作台数据？"
          >
            <Button disabled={busy} variant="destructive">
              <ShieldAlert />
              清空工作台数据
            </Button>
          </ConfirmAction>
        </SettingsSection>
      </Card>
    </div>
  )
}
