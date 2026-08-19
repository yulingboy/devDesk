import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { NodeState } from '@shared/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TooltipButton } from '@/components/common/TooltipButton'

export function NodeSummaryHeader({
  state,
  loading,
  onRefresh
}: {
  state: NodeState | null
  loading: boolean
  onRefresh: () => void
}): React.JSX.Element {
  const warnings = [
    state && !state.capabilities?.canInstall ? (state.capabilities?.message ?? '') : '',
    state && !state.packageManagerVersion
      ? `默认包管理器 ${state.packageManager || ''} 不可用，全局包操作将被禁用。`
      : ''
  ].filter(Boolean)

  return (
    <section className="shrink-0 border-b border-slate-200 pb-2.5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Node 管理</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            管理运行时版本、镜像、包管理器与全局包。
          </p>
        </div>
        <TooltipButton
          loading={loading}
          onClick={onRefresh}
          size="icon"
          tooltip="刷新 Node 状态"
          variant="ghost"
        >
          <RefreshCw size={15} />
        </TooltipButton>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ['当前版本', state?.currentVersion || '--'],
          ['默认版本', state?.defaultVersion || '--'],
          [
            '包管理器',
            state ? `${state.packageManager} ${state.packageManagerVersion || '不可用'}` : '--'
          ],
          [
            '运行环境',
            `nvm ${state?.capabilities?.nvmVersion || (state?.nvmAvailable ? '可用' : '不可用')} · nrm ${state?.nrmAvailable ? '可用' : '不可用'}`
          ]
        ].map(([label, value]) => (
          <div className="border border-slate-200 bg-white px-2.5 py-2" key={label}>
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className="mt-1 truncate text-xs font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {!!warnings.length && (
        <Alert className="mt-2" variant="warning">
          <AlertTriangle size={15} />
          <AlertDescription>{warnings.join(' ')}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}
