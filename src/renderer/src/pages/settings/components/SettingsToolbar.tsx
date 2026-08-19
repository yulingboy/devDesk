import { RotateCcw, Save, Settings2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmAction } from '@/components/common/ConfirmAction'

interface SettingsToolbarProps {
  dirty: boolean
  pending: boolean
  onDiscard: () => void
  onReset: () => void
  onSave: () => void
}

/** 设置页统一的标题与操作栏，避免页面入口混入按钮布局细节。 */
export function SettingsToolbar({
  dirty,
  pending,
  onDiscard,
  onReset,
  onSave
}: SettingsToolbarProps): React.JSX.Element {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)]">
        <Settings2 size={17} />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-slate-900">系统设置</div>
        <div className="truncate text-[11px] text-slate-500">管理应用行为、本地数据和开发环境</div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span
          className={
            dirty
              ? 'mr-1 flex items-center gap-1.5 text-[11px] text-amber-600'
              : 'mr-1 flex items-center gap-1.5 text-[11px] text-slate-500'
          }
        >
          <span
            className={
              dirty ? 'size-1.5 rounded-full bg-amber-500' : 'size-1.5 rounded-full bg-emerald-500'
            }
          />
          {dirty ? '有未保存的修改' : '设置已同步'}
        </span>
        <Button disabled={!dirty || pending} onClick={onDiscard} variant="ghost">
          <Undo2 size={15} />
          撤销
        </Button>
        <ConfirmAction
          description="恢复桌面行为和高级设置的默认值，不会删除业务数据。"
          onConfirm={onReset}
          title="恢复默认设置？"
        >
          <Button disabled={pending} variant="secondary">
            <RotateCcw size={15} />
            重置
          </Button>
        </ConfirmAction>
        <Button
          disabled={!dirty || pending}
          loading={pending}
          loadingText="保存中"
          onClick={onSave}
          variant="success"
        >
          <Save size={15} />
          保存
        </Button>
      </div>
    </div>
  )
}
