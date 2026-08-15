import type { LucideIcon } from 'lucide-react'
import { Braces, HardDrive, PackageOpen, ServerCog, ShieldCheck } from 'lucide-react'
import type { RuntimeInfo } from '@shared/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function EnvironmentPanel({
  runtimeInfo,
  hasDesktopRuntime
}: {
  runtimeInfo: RuntimeInfo | null
  hasDesktopRuntime: boolean
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between border-b border-slate-100">
        <div>
          <CardTitle>开发环境</CardTitle>
          <CardDescription>运行时与平台信息</CardDescription>
        </div>
        <ShieldCheck aria-hidden="true" className="text-[var(--accent)]" />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
          <RuntimeRow
            icon={ServerCog}
            label="操作平台"
            value={
              runtimeInfo
                ? `${runtimeInfo.platform} / ${runtimeInfo.arch}`
                : hasDesktopRuntime
                  ? '读取中'
                  : '桌面运行时不可用'
            }
          />
          <RuntimeRow
            icon={PackageOpen}
            label="Electron"
            value={runtimeInfo?.versions.electron ?? (hasDesktopRuntime ? '读取中' : '--')}
          />
          <RuntimeRow
            icon={Braces}
            label="Node.js"
            value={runtimeInfo?.versions.node ?? (hasDesktopRuntime ? '读取中' : '--')}
          />
          <RuntimeRow
            icon={HardDrive}
            label="Chromium"
            value={runtimeInfo?.versions.chrome ?? (hasDesktopRuntime ? '读取中' : '--')}
          />
        </dl>
      </CardContent>
    </Card>
  )
}

function RuntimeRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)]">
        <Icon aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-slate-400">{label}</dt>
        <dd className="mt-0.5 truncate text-xs font-medium text-slate-700">{value}</dd>
      </div>
    </div>
  )
}
