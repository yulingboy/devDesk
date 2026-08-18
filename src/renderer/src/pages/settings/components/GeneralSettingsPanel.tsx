import type { AppSettings } from '@shared/domain'
import { LogIn, PanelTopClose } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from './SettingsSection'

export function GeneralSettingsPanel({
  settings,
  onChange
}: {
  settings: AppSettings
  onChange: (value: AppSettings) => void
}): React.JSX.Element {
  return (
    <Card className="overflow-hidden">
      <SettingsSection description="控制应用随系统启动以及关闭窗口后的驻留行为。" title="桌面行为">
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          <Label className="flex min-h-16 items-center justify-between gap-4 px-4 py-3.5">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                <LogIn />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-slate-800">开机自启</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  登录系统后自动启动 DevDesk
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="w-9 text-right text-[11px] text-slate-500">
                {settings.general.launchAtLogin ? '已开启' : '已关闭'}
              </span>
              <Switch
                checked={settings.general.launchAtLogin}
                onCheckedChange={(launchAtLogin) =>
                  onChange({
                    ...settings,
                    general: { ...settings.general, launchAtLogin }
                  })
                }
              />
            </span>
          </Label>
          <Label className="flex min-h-16 items-center justify-between gap-4 px-4 py-3.5">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                <PanelTopClose />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-slate-800">最小化到托盘</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  关闭主窗口时保持后台服务运行
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="w-9 text-right text-[11px] text-slate-500">
                {settings.general.minimizeToTray ? '已开启' : '已关闭'}
              </span>
              <Switch
                checked={settings.general.minimizeToTray}
                onCheckedChange={(minimizeToTray) =>
                  onChange({
                    ...settings,
                    general: { ...settings.general, minimizeToTray }
                  })
                }
              />
            </span>
          </Label>
        </div>
      </SettingsSection>
    </Card>
  )
}
