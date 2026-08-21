import { FolderOpen, Info, MoreHorizontal, Pencil, TriangleAlert } from 'lucide-react'
import type { Project } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { TooltipButton } from '@/components/common/TooltipButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ProjectEditorMenu } from './ProjectEditorMenu'
import { usePageFeedback } from '@/hooks/usePageFeedback'

interface ProjectGridProps {
  workspaceId: string
  projects: Project[]
  query: string
  scanning: boolean
  onOpen: (project: Project) => void
  onEditRemark: (project: Project) => void
}

/** 主列表只展示一级项目，子项目以数量提示并在详情抽屉中查看。 */
export function ProjectGrid({
  workspaceId,
  projects,
  query,
  scanning,
  onOpen,
  onEditRemark
}: ProjectGridProps): React.JSX.Element {
  const { report } = usePageFeedback('打开项目目录失败', { keepStatus: false })

  if (scanning) {
    return (
      <div className="min-w-0 flex-1 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-100 bg-white">
        {Array.from({ length: 9 }, (_, index) => (
          <div className="flex h-14 items-center justify-between px-5" key={index}>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="flex items-center gap-8">
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!projects.length) {
    return (
      <Empty className="min-h-56 min-w-0 flex-1 rounded-md border border-slate-100 bg-white">
        <EmptyTitle>{query ? '没有匹配的项目' : '工作区中还没有项目'}</EmptyTitle>
        <EmptyDescription>
          {query ? '修改项目名称、备注或子项目搜索条件。' : '扫描工作区，或手动纳入一个项目目录。'}
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-100 bg-white">
      <Table className="table-fixed" containerClassName="shrink-0 overflow-hidden">
        <ProjectColumns />
        <TableHeader>
          <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead>项目</TableHead>
            <TableHead className="w-56">备注</TableHead>
            <TableHead className="w-32">子项目</TableHead>
            <TableHead className="w-32 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <ScrollArea className="min-h-0 flex-1">
        <Table className="table-fixed" containerClassName="overflow-visible">
          <ProjectColumns />
          <TableBody>
            {projects.map((project) => (
              <TableRow className="group h-14" key={project.id}>
                <TableCell className="py-2.5">
                  <Button
                    className="h-auto min-w-0 max-w-full justify-start p-0 text-left"
                    onClick={() => onOpen(project)}
                    type="button"
                    variant="link"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="max-w-[34rem] truncate text-[13px] font-normal text-slate-800">
                        {project.name}
                      </span>
                      {project.source === 'manual' && (
                        <Badge className="shrink-0" variant="outline">
                          手动纳入
                        </Badge>
                      )}
                      {project.directoryExists === false && (
                        <TriangleAlert className="shrink-0 text-amber-600" size={13} />
                      )}
                    </span>
                  </Button>
                </TableCell>
                <TableCell
                  className="max-w-56 truncate text-[11px] text-slate-500"
                  title={project.remark || '未填写备注'}
                >
                  {project.remark || <span className="text-slate-300">未填写备注</span>}
                </TableCell>
                <TableCell className="text-[11px] text-slate-500">
                  {project.subprojects?.length ? (
                    <Button
                      className="h-auto p-0 text-left text-[11px] font-normal text-slate-500"
                      onClick={() => onOpen(project)}
                      title={project.subprojects.map((item) => item.name).join('、')}
                      type="button"
                      variant="link"
                    >
                      {project.subprojects.length} 个子项目
                    </Button>
                  ) : (
                    <span className="text-slate-300">--</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                    <ProjectEditorMenu
                      disabled={project.directoryExists === false}
                      projectId={project.id}
                      workspaceId={workspaceId}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <TooltipButton size="icon" tooltip="更多项目操作" variant="ghost">
                          <MoreHorizontal size={14} />
                        </TooltipButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onOpen(project)}>
                          <Info />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onEditRemark(project)}>
                          <Pencil />
                          编辑备注
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={project.directoryExists === false}
                          onSelect={() =>
                            void window.api?.workspaces
                              .openProject(workspaceId, project.id)
                              .catch(report)
                          }
                        >
                          <FolderOpen />
                          打开目录
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}

function ProjectColumns(): React.JSX.Element {
  return (
    <colgroup>
      <col />
      <col className="w-56" />
      <col className="w-32" />
      <col className="w-32" />
    </colgroup>
  )
}
