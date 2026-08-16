import {
  FolderOpen,
  FolderPlus,
  GitBranch,
  KeyRound,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Rocket,
  ScanSearch,
  Trash2
} from 'lucide-react'
import type { Workspace, WorkspaceScanResult } from '@shared/domain'
import { ConfirmAction } from '@/components/ConfirmAction'
import { TooltipButton } from '@/components/TooltipButton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

interface WorkspaceToolbarProps {
  identityName?: string
  sshKeyName?: string
  query: string
  scanResult?: WorkspaceScanResult
  scanning: boolean
  templatesAvailable: boolean
  workspace: Workspace
  onAddProject: () => void
  onCreateProject: () => void
  onDelete: () => Promise<void>
  onEdit: () => void
  onOpen: () => void
  onQueryChange: (value: string) => void
  onRefresh: () => void
  onScan: () => void
}

/** 当前工作区的身份、路径、检索和操作统一放在一个上下文工具栏中。 */
export function WorkspaceToolbar({
  identityName,
  sshKeyName,
  query,
  scanResult,
  scanning,
  templatesAvailable,
  workspace,
  onAddProject,
  onCreateProject,
  onDelete,
  onEdit,
  onOpen,
  onQueryChange,
  onRefresh,
  onScan
}: WorkspaceToolbarProps): React.JSX.Element {
  return (
    <section className="shrink-0 border-b border-slate-200 bg-white">
      <div className="flex min-w-0 items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold text-slate-900">{workspace.name}</h1>
            <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
              {workspace.projects.length} 个项目
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-slate-400">
            <span className="truncate" title={workspace.rootPath}>
              {workspace.rootPath}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 border-l border-slate-200 pl-2 text-slate-500">
              <GitBranch />
              {identityName ?? '未绑定 Git 身份'}
            </span>
            {identityName && (
              <span className="inline-flex shrink-0 items-center gap-1 text-slate-500">
                <KeyRound />
                {sshKeyName ?? '未绑定 SSH 密钥'}
              </span>
            )}
          </div>
          {workspace.description && (
            <p className="mt-1 max-w-3xl truncate text-[10px] text-slate-400">
              {workspace.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <TooltipButton onClick={onRefresh} size="icon" tooltip="刷新工作区数据" variant="ghost">
            <RefreshCw />
          </TooltipButton>
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

      <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3">
        <Input
          className="h-7 min-w-48 flex-1 bg-slate-50/70 sm:max-w-80"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索项目名称或路径"
          value={query}
        />
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
      </div>

      {scanResult && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-5 py-1.5 text-[10px] text-slate-500">
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
