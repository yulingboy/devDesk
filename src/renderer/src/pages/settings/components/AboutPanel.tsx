import type { RuntimeInfo } from '@shared/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { SettingsSection } from './SettingsSection'

export function AboutPanel({
  runtime,
  error
}: {
  runtime: RuntimeInfo | null
  error?: string
}): React.JSX.Element {
  return (
    <div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="overflow-hidden">
        <SettingsSection description="开发工坊本地开发环境管理工具" title="应用信息">
          <dl className="grid gap-x-6 gap-y-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-[11px] text-slate-400">应用版本</dt>
              <dd className="mt-1 font-mono">{runtime?.appVersion ?? '--'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Electron / Chrome</dt>
              <dd className="mt-1 font-mono">
                {runtime ? `${runtime.versions.electron} / ${runtime.versions.chrome}` : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Node / 架构</dt>
              <dd className="mt-1 font-mono">
                {runtime ? `${runtime.versions.node} / ${runtime.arch}` : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">构建时间</dt>
              <dd className="mt-1 font-mono">
                {runtime ? new Date(runtime.buildDate).toLocaleString('zh-CN') : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">平台</dt>
              <dd className="mt-1 font-mono">
                {runtime ? `${runtime.platform} / ${runtime.arch}` : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">许可证</dt>
              <dd className="mt-1">MIT License</dd>
            </div>
          </dl>
        </SettingsSection>
      </Card>
    </div>
  )
}
