import { Code2, FolderOpen, Trash2 } from 'lucide-react'
import type { AppSettings, LogStats } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { SettingsSection } from './SettingsSection'

const formatBytes = (value: number): string =>
  value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 ** 2).toFixed(1)} MB`

export function AdvancedSettingsPanel({
  settings,
  logStats,
  onChange,
  onClearLogs,
  developerToolsActive
}: {
  settings: AppSettings
  logStats: LogStats | null
  onChange: (value: AppSettings) => void
  onClearLogs: () => void
  developerToolsActive: boolean
}): React.JSX.Element {
  const { report } = usePageFeedback('设置工具操作失败', { keepStatus: false })

  return (
    <Card className="overflow-hidden">
      <SettingsSection description="调整写入本地诊断文件的日志阈值。" title="日志">
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field htmlFor="log-level" label="日志级别">
            <Select
              onValueChange={(logLevel) =>
                onChange({
                  ...settings,
                  advanced: {
                    ...settings.advanced,
                    logLevel: logLevel as AppSettings['advanced']['logLevel']
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
          </Field>
          <div className="self-end text-[11px] text-slate-500">
            {logStats
              ? `${logStats.fileCount} 个文件 · ${formatBytes(logStats.sizeBytes)}`
              : '日志统计不可用'}
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <Button
            onClick={() => void window.api?.settings.openLogs().catch(report)}
            variant="secondary"
          >
            <FolderOpen size={14} />
            打开日志目录
          </Button>
          <ConfirmAction
            description="只清理轮转和归档日志，当前 main.log 会保留。"
            onConfirm={onClearLogs}
            title="清理旧日志？"
          >
            <Button variant="outline">
              <Trash2 size={14} />
              清理旧日志
            </Button>
          </ConfirmAction>
        </div>
      </SettingsSection>
      <SettingsSection description="仅用于本地调试，普通使用无需开启。" title="开发者工具">
        <Label className="flex max-w-xl items-center justify-between gap-4 border-y border-slate-100 py-3">
          <span className="text-xs text-slate-700">允许打开开发者工具</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="w-9 text-right text-[11px] text-slate-500">
              {settings.advanced.developerTools ? '已开启' : '已关闭'}
            </span>
            <Switch
              checked={settings.advanced.developerTools}
              onCheckedChange={(developerTools) =>
                onChange({ ...settings, advanced: { ...settings.advanced, developerTools } })
              }
            />
          </span>
        </Label>
        <Button
          className="mt-3"
          disabled={!developerToolsActive}
          onClick={() => void window.api?.settings.openDeveloperTools().catch(report)}
          variant="secondary"
        >
          <Code2 size={14} />
          打开开发者工具
        </Button>
        {settings.advanced.developerTools && !developerToolsActive && (
          <p className="mt-1.5 text-[11px] text-amber-600">保存设置后即可打开。</p>
        )}
      </SettingsSection>
    </Card>
  )
}
