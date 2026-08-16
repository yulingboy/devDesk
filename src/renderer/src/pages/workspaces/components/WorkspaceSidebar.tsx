import { FolderKanban, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import type { Workspace } from '@shared/domain'
import { TooltipButton } from '@/components/TooltipButton'
import { cn } from '@/lib/utils'

interface WorkspaceSidebarProps {
  collapsed: boolean
  selectedId?: string
  workspaces: Workspace[]
  onCreate: () => void
  onSelect: (id: string) => void
  onToggle: () => void
}

/**
 * 工作区是项目管理的一级上下文，因此使用独立侧栏承载切换和摘要。
 * 收起后只保留图标，避免与应用全局导航争夺横向空间。
 */
export function WorkspaceSidebar({
  collapsed,
  selectedId,
  workspaces,
  onCreate,
  onSelect,
  onToggle
}: WorkspaceSidebarProps): React.JSX.Element {
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200',
        collapsed ? 'w-12' : 'w-56'
      )}
    >
      <div
        className={cn(
          'flex h-11 shrink-0 items-center border-b border-slate-100',
          collapsed ? 'justify-center' : 'px-3'
        )}
      >
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-700">工作区</span>
            <span className="text-[10px] tabular-nums text-slate-400">{workspaces.length}</span>
          </div>
        )}
        {!collapsed && (
          <TooltipButton onClick={onCreate} size="icon" tooltip="新增工作区" variant="ghost">
            <Plus />
          </TooltipButton>
        )}
        <TooltipButton
          onClick={onToggle}
          size="icon"
          tooltip={collapsed ? '展开工作区列表' : '收起工作区列表'}
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </TooltipButton>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-auto', collapsed ? 'p-1.5' : 'p-2')}>
        <div className="space-y-1">
          {workspaces.map((workspace) => {
            const selected = workspace.id === selectedId
            const attentionCount = workspace.projects.filter(needsAttention).length

            if (collapsed) {
              return (
                <TooltipButton
                  className={cn('w-full', selected && 'bg-blue-50 text-blue-600')}
                  key={workspace.id}
                  onClick={() => onSelect(workspace.id)}
                  size="icon"
                  tooltip={`${workspace.name} · ${workspace.projects.length} 个项目`}
                  variant="ghost"
                >
                  <FolderKanban />
                </TooltipButton>
              )
            }

            return (
              <button
                className={cn(
                  'relative flex h-12 w-full min-w-0 items-center gap-2 rounded-md px-2.5 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-200',
                  selected && 'bg-blue-50/80 text-blue-700 hover:bg-blue-50'
                )}
                key={workspace.id}
                onClick={() => onSelect(workspace.id)}
                type="button"
              >
                {selected && (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-blue-600" />
                )}
                <FolderKanban
                  className={cn('shrink-0 text-slate-400', selected && 'text-blue-600')}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">{workspace.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                    {workspace.projects.length} 个项目
                    {attentionCount > 0 ? ` · ${attentionCount} 个需处理` : ' · 状态正常'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function needsAttention(workspaceProject: Workspace['projects'][number]): boolean {
  return (
    workspaceProject.directoryExists === false ||
    Boolean(workspaceProject.gitError) ||
    Boolean(workspaceProject.hasPackageJson && workspaceProject.dependencyState === 'missing')
  )
}
