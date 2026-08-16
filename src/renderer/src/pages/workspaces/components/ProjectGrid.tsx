import { Code2, FolderOpen, Info, TriangleAlert } from 'lucide-react'
import type { Project } from '@shared/domain'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { TooltipButton } from '@/components/TooltipButton'

interface ProjectGridProps {
  projects: Project[]
  query: string
  rootPath?: string
  scanning: boolean
  onOpen: (project: Project) => void
  onOpenEditor: (path: string) => void
  onOpenFolder: (path: string) => void
}

/** 工作区只展示项目目录，不根据具体语言、依赖或构建工具划分项目状态。 */
export function ProjectGrid({
  projects,
  query,
  rootPath,
  scanning,
  onOpen,
  onOpenEditor,
  onOpenFolder
}: ProjectGridProps): React.JSX.Element {
  if (scanning) {
    return (
      <div className="divide-y divide-slate-100 bg-white">
        {Array.from({ length: 9 }, (_, index) => (
          <div className="flex h-14 items-center justify-between px-5" key={index}>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-64" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (!projects.length) {
    return (
      <Empty className="min-h-56 border-y border-slate-200 bg-white">
        <EmptyTitle>{query ? '没有匹配的项目' : '工作区中还没有项目'}</EmptyTitle>
        <EmptyDescription>
          {query ? '修改项目名称或路径搜索条件。' : '扫描工作区，或手动纳入一个项目目录。'}
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead>项目</TableHead>
            <TableHead className="w-28 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow className="group h-14" key={project.id}>
              <TableCell className="py-2.5">
                <button
                  className="block min-w-0 max-w-full text-left outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onClick={() => onOpen(project)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="max-w-[34rem] truncate text-[13px] font-semibold text-slate-800">
                      {project.name}
                    </span>
                    {project.source === 'manual' && (
                      <span className="text-[10px] text-slate-400">手动纳入</span>
                    )}
                    {project.directoryExists === false && (
                      <TriangleAlert className="shrink-0 text-amber-600" size={13} />
                    )}
                  </span>
                  <span
                    className="mt-1 block max-w-[48rem] truncate text-[11px] text-slate-400"
                    title={project.path}
                  >
                    {formatProjectPath(project.path, rootPath)}
                  </span>
                </button>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                  <TooltipButton
                    onClick={() => onOpen(project)}
                    size="icon"
                    tooltip="查看项目详情"
                    variant="ghost"
                  >
                    <Info size={14} />
                  </TooltipButton>
                  <TooltipButton
                    disabled={project.directoryExists === false}
                    onClick={() => onOpenEditor(project.path)}
                    size="icon"
                    tooltip="在 VS Code 中打开"
                    variant="ghost"
                  >
                    <Code2 size={14} />
                  </TooltipButton>
                  <TooltipButton
                    disabled={project.directoryExists === false}
                    onClick={() => onOpenFolder(project.path)}
                    size="icon"
                    tooltip="打开项目目录"
                    variant="ghost"
                  >
                    <FolderOpen size={14} />
                  </TooltipButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** 工作区内部项目优先显示相对路径，多级子项目仍能看出目录层级。 */
function formatProjectPath(projectPath: string, rootPath?: string): string {
  if (!rootPath) return projectPath
  const normalizedRoot = rootPath.replace(/\/$/, '')
  if (!projectPath.startsWith(`${normalizedRoot}/`)) return projectPath
  return `./${projectPath.slice(normalizedRoot.length + 1)}`
}
