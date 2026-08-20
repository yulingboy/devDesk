import { useState } from 'react'
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
  Trash2,
  ChevronDown
} from 'lucide-react'
import type { Workspace, WorkspaceScanResult } from '@shared/domain'
import { SearchInput } from '@/components/common/SearchInput'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

interface WorkspaceToolbarProps {
  query: string
  scanResult?: WorkspaceScanResult
  refreshing: boolean
  scanning: boolean
  templatesAvailable: boolean
  workspace: Workspace
  workspaces: Workspace[]
  onAddProject: () => void
  onCreateEmptyProject: () => void
  onCreateFromTemplate: () => void
  onCreateWorkspace: () => void
  onDelete: () => Promise<void>
  onEdit: () => void
  onQueryChange: (value: string) => void
  onRefresh: () => void
  onScan: () => void
  onCancelScan: () => void
  onSelectWorkspace: (id: string) => void
  onViewDetails: () => void
}

/** 当前工作区的身份、路径、检索和操作统一放在一个上下文工具栏中。 */
export function WorkspaceToolbar({
  query,
  scanResult,
  refreshing,
  scanning,
  templatesAvailable,
  workspace,
  workspaces,
  onAddProject,
  onCreateEmptyProject,
  onCreateFromTemplate,
  onCreateWorkspace,
  onDelete,
  onEdit,
  onQueryChange,
  onRefresh,
  onScan,
  onCancelScan,
  onSelectWorkspace,
  onViewDetails
}: WorkspaceToolbarProps): React.JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { report } = usePageFeedback('打开工作区目录失败', { keepStatus: false })

  return (
    <section className="shrink-0 border-b border-slate-100 bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-1">
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
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SearchInput
          className="min-w-36 flex-1"
          onValueChange={onQueryChange}
          placeholder="搜索项目名称、备注或子项目"
          value={query}
        />
        <TooltipButton
          loading={refreshing}
          onClick={onRefresh}
          size="icon"
          tooltip="刷新工作区数据"
          variant="ghost"
        >
          <RefreshCw />
        </TooltipButton>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            onClick={scanning ? onCancelScan : onScan}
            size="sm"
            variant={scanning ? 'outline' : 'secondary'}
          >
            <ScanSearch />
            {scanning ? '取消扫描' : '扫描项目'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="success">
                <Plus />
                新增项目
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onCreateEmptyProject}>
                <FolderPlus />
                创建空目录
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!templatesAvailable} onSelect={onCreateFromTemplate}>
                <Rocket />
                从模板创建
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddProject}>
                <FolderPlus />
                纳入已有目录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="更多工作区操作" size="icon" variant="outline">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onViewDetails}>
                <Info />
                查看工作区详情
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCreateWorkspace}>
                <Plus />
                新增工作区
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil />
                编辑工作区
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void window.api?.workspaces.open(workspace.id).catch(report)}
              >
                <FolderOpen />
                打开工作区目录
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                disabled={scanning}
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 />
                删除工作区
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {scanResult && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
          <span>扫描结果</span>
          <span>新增 {scanResult.added}</span>
          <span>移除 {scanResult.removed}</span>
          <span>共 {scanResult.total} 个项目</span>
          {scanResult.truncated && <span className="text-amber-700">已达到扫描上限</span>}
        </div>
      )}
      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除工作区？</AlertDialogTitle>
            <AlertDialogDescription>
              删除工作区“{workspace.name}”会同时移除应用内项目记录和 Git
              路径规则，不会删除磁盘目录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDelete()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
