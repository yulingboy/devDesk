import {
  FolderOpen,
  FolderPlus,
  FolderKanban,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  ScanSearch,
  Trash2
} from 'lucide-react'
import type { Workspace, WorkspaceScanResult } from '@shared/domain'
import { ConfirmAction } from '@/components/ConfirmAction'
import { SearchInput } from '@/components/SearchInput'
import { TooltipButton } from '@/components/TooltipButton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface WorkspaceToolbarProps {
  query: string
  scanResult?: WorkspaceScanResult
  scanning: boolean
  templatesAvailable: boolean
  workspace: Workspace
  workspaces: Workspace[]
  onAddProject: () => void
  onCreateProject: () => void
  onCreateWorkspace: () => void
  onDelete: () => Promise<void>
  onEdit: () => void
  onOpen: () => void
  onQueryChange: (value: string) => void
  onRefresh: () => void
  onScan: () => void
  onSelectWorkspace: (id: string) => void
  onViewDetails: () => void
}

/** 当前工作区的身份、路径、检索和操作统一放在一个上下文工具栏中。 */
export function WorkspaceToolbar({
  query,
  scanResult,
  scanning,
  templatesAvailable,
  workspace,
  workspaces,
  onAddProject,
  onCreateProject,
  onCreateWorkspace,
  onDelete,
  onEdit,
  onOpen,
  onQueryChange,
  onRefresh,
  onScan,
  onSelectWorkspace,
  onViewDetails
}: WorkspaceToolbarProps): React.JSX.Element {
  return (
    <section className="shrink-0 bg-white">
      <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Select onValueChange={onSelectWorkspace} value={workspace.id}>
            <SelectTrigger
              aria-label="选择工作区"
              className="h-8 w-56 border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800"
            >
              <FolderKanban className="size-3.5 shrink-0 text-blue-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} · {item.projects.length} 个项目
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TooltipButton
            onClick={onCreateWorkspace}
            size="icon"
            tooltip="新增工作区"
            variant="ghost"
          >
            <Plus />
          </TooltipButton>
          <span className="shrink-0 tabular-nums text-[10px] text-slate-400">
            {workspace.projects.length} 个项目
          </span>
          <Button onClick={onViewDetails} size="sm" variant="ghost">
            <Info />
            查看详情
          </Button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button disabled={scanning} onClick={onScan} variant="secondary">
            {scanning ? <Spinner /> : <ScanSearch />}
            {scanning ? '扫描中' : '扫描项目'}
          </Button>
          <Button disabled={!templatesAvailable} onClick={onCreateProject} variant="success">
            <Rocket />
            从模板创建
          </Button>
          <Button onClick={onAddProject} variant="outline">
            <FolderPlus />
            纳入已有项目
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="更多工作区操作" size="icon" variant="ghost">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil />
                编辑工作区
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpen}>
                <FolderOpen />
                打开工作区目录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmAction
            description={`删除工作区“${workspace.name}”会同时移除应用内项目记录和 Git 路径规则，不会删除磁盘目录。`}
            onConfirm={onDelete}
            title="删除工作区？"
            triggerTooltip="删除工作区"
          >
            <Button
              aria-label="删除工作区"
              className="text-slate-400 hover:bg-red-50 hover:text-red-600"
              disabled={scanning}
              size="icon"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </ConfirmAction>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-2 pt-3">
        <SearchInput
          className="min-w-48 flex-1"
          onValueChange={onQueryChange}
          placeholder="搜索项目名称、备注或子项目"
          value={query}
        />
        <TooltipButton onClick={onRefresh} size="icon" tooltip="刷新工作区数据" variant="ghost">
          <RefreshCw />
        </TooltipButton>
      </div>

      {scanResult && (
        <div className="mx-3 mb-2 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
          <span>扫描结果</span>
          <span>新增 {scanResult.added}</span>
          <span>移除 {scanResult.removed}</span>
          <span>共 {scanResult.total} 个项目</span>
          {scanResult.truncated && <span className="text-amber-700">已达到扫描上限</span>}
        </div>
      )}
    </section>
  )
}
