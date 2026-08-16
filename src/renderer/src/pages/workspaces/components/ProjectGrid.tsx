import { Code2, FolderOpen, Info, PackageCheck, TriangleAlert } from 'lucide-react'
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

/** 项目主列表保持工具页的密度，状态使用色点和短文本，避免胶囊堆叠造成视觉噪声。 */
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
          <div
            className="grid grid-cols-[minmax(280px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_96px] items-center gap-4 px-4 py-3"
            key={index}
          >
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-64" />
            </div>
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-6 w-20" />
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
          {query
            ? '修改搜索条件，或切换到其他状态页签。'
            : '扫描工作区，或使用模板创建一个新项目。'}
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="min-h-full overflow-x-auto bg-white">
      <Table className="min-w-[820px]">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="w-[42%]">项目</TableHead>
            <TableHead>工具链</TableHead>
            <TableHead>依赖</TableHead>
            <TableHead>Git 状态</TableHead>
            <TableHead className="w-24 text-right">操作</TableHead>
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
                    <span className="max-w-[28rem] truncate text-[13px] font-semibold text-slate-800">
                      {project.name}
                    </span>
                    {project.source === 'manual' && (
                      <span className="text-[10px] text-slate-400">外部</span>
                    )}
                    {project.directoryExists === false && (
                      <TriangleAlert className="shrink-0 text-amber-600" size={13} />
                    )}
                  </span>
                  <span
                    className="mt-1 block max-w-[34rem] truncate text-[11px] text-slate-400"
                    title={project.path}
                  >
                    {formatProjectPath(project.path, rootPath)}
                  </span>
                </button>
              </TableCell>
              <TableCell>
                <div className="min-w-0 text-[11px] text-slate-600">
                  <span className="font-mono font-medium">{project.packageManager ?? '--'}</span>
                  {project.nodeRequirement && (
                    <span
                      className="mt-1 block max-w-44 truncate text-slate-400"
                      title={project.nodeRequirement}
                    >
                      Node {project.nodeRequirement}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {project.directoryExists === false ? (
                  <StateText tone="warning" text="目录缺失" />
                ) : project.hasPackageJson ? (
                  <StateText
                    icon={<PackageCheck size={13} />}
                    tone={project.dependencyState === 'ready' ? 'success' : 'warning'}
                    text={project.dependencyState === 'ready' ? '依赖已就绪' : '等待安装'}
                  />
                ) : (
                  <StateText tone="muted" text="无 package.json" />
                )}
              </TableCell>
              <TableCell>
                {project.directoryExists === false ? (
                  <StateText tone="muted" text="--" />
                ) : project.gitError ? (
                  <StateText tone="warning" text="状态未知" />
                ) : project.branch ? (
                  <StateText
                    tone={project.dirty ? 'warning' : 'success'}
                    text={`${project.branch}${project.dirty ? ' · 有改动' : ''}`}
                  />
                ) : (
                  <StateText tone="muted" text="非 Git 项目" />
                )}
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

function StateText({
  icon,
  text,
  tone
}: {
  icon?: React.ReactNode
  text: string
  tone: 'success' | 'warning' | 'muted'
}): React.JSX.Element {
  const toneClass = {
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    muted: 'text-slate-500'
  }[tone]
  const dotClass = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    muted: 'bg-slate-300'
  }[tone]
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate text-[11px] ${toneClass}`}
    >
      {icon ?? <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${dotClass}`} />}
      <span className="truncate">{text}</span>
    </span>
  )
}

/** 工作区内部项目优先显示相对路径，减少每行重复的根目录噪声。 */
function formatProjectPath(projectPath: string, rootPath?: string): string {
  if (!rootPath) return projectPath
  const normalizedRoot = rootPath.replace(/\/$/, '')
  if (!projectPath.startsWith(`${normalizedRoot}/`)) return projectPath
  return `./${projectPath.slice(normalizedRoot.length + 1)}`
}
