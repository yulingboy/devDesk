import {
  Code2,
  FolderOpen,
  PackageCheck,
  Play,
  RefreshCw,
  TerminalSquare,
  Trash2
} from 'lucide-react'
import type { ProjectDetail } from '@shared/domain'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmAction } from '@/components/ConfirmAction'

interface ProjectDetailDrawerProps {
  detail: ProjectDetail | null
  loading: boolean
  open: boolean
  pendingAction?: 'refresh' | 'install' | 'script' | 'remove'
  onClose: () => void
  onOpenEditor: (path: string) => void
  onOpenFolder: (path: string) => void
  onInstallDependencies: () => void
  onRemove: () => Promise<void>
  onRefresh: () => void
  onRunScript: (script: string) => void
}

/** 项目详情抽屉将环境检查和可执行操作集中到项目上下文中。 */
export function ProjectDetailDrawer({
  detail,
  loading,
  open,
  pendingAction,
  onClose,
  onOpenEditor,
  onOpenFolder,
  onInstallDependencies,
  onRemove,
  onRefresh,
  onRunScript
}: ProjectDetailDrawerProps): React.JSX.Element {
  const project = detail?.project
  const environment = detail?.environment
  const workspace = detail?.workspace
  const running = Boolean(pendingAction)
  return (
    <Drawer
      description="状态从项目目录实时读取；脚本会在新的 macOS Terminal 窗口中运行。"
      footer={
        project ? (
          <>
            <ConfirmAction
              description={`将从当前工作区移除“${project.name}”的应用内引用，不会删除磁盘目录、Git 仓库或任何源代码。`}
              onConfirm={onRemove}
              title="从工作区移除项目？"
            >
              <Button disabled={running} size="icon" variant="ghost">
                {pendingAction === 'remove' ? <Spinner /> : <Trash2 size={14} />}
              </Button>
            </ConfirmAction>
            <Button onClick={onClose} variant="secondary">
              关闭
            </Button>
            <Button disabled={running} onClick={onRefresh} variant="outline">
              {pendingAction === 'refresh' ? <Spinner /> : <RefreshCw size={14} />}
              刷新项目
            </Button>
            <Button
              disabled={
                running ||
                environment?.directoryExists === false ||
                !project.hasPackageJson ||
                project.dependencyState === 'ready' ||
                !environment?.packageManagerAvailable
              }
              onClick={onInstallDependencies}
              variant="success"
            >
              {pendingAction === 'install' ? <Spinner /> : <PackageCheck size={14} />}
              {project.dependencyState === 'ready' ? '依赖已就绪' : '安装依赖'}
            </Button>
          </>
        ) : undefined
      }
      onClose={onClose}
      open={open}
      title={project?.name ?? '项目详情'}
    >
      {loading && (
        <div className="space-y-3">
          <div className="h-12 animate-pulse bg-slate-100" />
          <div className="h-28 animate-pulse bg-slate-100" />
          <div className="h-32 animate-pulse bg-slate-100" />
        </div>
      )}
      {!loading && project && environment && (
        <div className="space-y-5">
          {environment.directoryExists === false && (
            <Alert variant="warning">
              <AlertDescription>
                项目目录已不存在或无法访问。此记录不会自动删除，以便你确认后从工作区移除。
              </AlertDescription>
            </Alert>
          )}
          <section className="space-y-2">
            <p className="text-[11px] font-medium text-slate-400">项目</p>
            <Item className="px-0 py-0 border-x-0">
              <ItemContent>
                <ItemTitle>{project.packageName || project.name}</ItemTitle>
                <ItemDescription title={project.path}>{project.path}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  disabled={environment.directoryExists === false}
                  onClick={() => onOpenEditor(project.path)}
                  size="icon"
                  variant="ghost"
                >
                  <Code2 size={14} />
                </Button>
                <Button
                  disabled={environment.directoryExists === false}
                  onClick={() => onOpenFolder(project.path)}
                  size="icon"
                  variant="ghost"
                >
                  <FolderOpen size={14} />
                </Button>
              </ItemActions>
            </Item>
            {workspace && (
              <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
                <span className="shrink-0">工作区 · {workspace.name}</span>
                {workspace.gitIdentity ? (
                  <Badge variant="secondary">
                    Git · {workspace.gitIdentity.name} ({workspace.gitIdentity.email})
                  </Badge>
                ) : (
                  <span className="text-slate-400">未绑定 Git 身份</span>
                )}
              </div>
            )}
          </section>
          <section className="space-y-2">
            <p className="text-[11px] font-medium text-slate-400">运行环境</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Status label="当前 Node" value={environment.currentNodeVersion || '未检测到'} />
              <Status label="项目要求" value={environment.nodeRequirement || '未声明'} />
              <Status label="包管理器" value={environment.packageManager || '未识别'} />
              <Status
                label="依赖"
                value={
                  environment.dependencyState === 'ready'
                    ? '已安装'
                    : environment.dependencyState === 'missing'
                      ? '未安装'
                      : '不适用'
                }
              />
            </div>
            {environment.nodeCompatible === false && (
              <div className="flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 px-2.5 py-2">
                <p className="text-[11px] text-amber-800">
                  当前 Node 版本可能不满足项目要求，请切换后刷新项目状态。
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/node">前往 Node 管理</Link>
                </Button>
              </div>
            )}
            {environment.packageManager && !environment.packageManagerAvailable && (
              <p className="text-[11px] text-amber-700">
                未检测到 {environment.packageManager}，无法安装依赖或运行脚本。
              </p>
            )}
          </section>
          <section className="space-y-2">
            <p className="text-[11px] font-medium text-slate-400">可运行脚本</p>
            {detail.scripts.length ? (
              <div className="space-y-1">
                {detail.scripts.map((script) => (
                  <Item className="px-2 py-1.5" key={script.name}>
                    <ItemContent>
                      <ItemTitle className="font-mono">{script.name}</ItemTitle>
                      <ItemDescription className="font-mono" title={script.command}>
                        {script.command}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        disabled={
                          running ||
                          environment.directoryExists === false ||
                          !environment.packageManagerAvailable
                        }
                        onClick={() => onRunScript(script.name)}
                        size="sm"
                        variant="secondary"
                      >
                        {pendingAction === 'script' ? <Spinner /> : <Play size={13} />}
                        在终端运行
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            ) : (
              <Empty className="min-h-20 py-3">
                <TerminalSquare className="mb-1 size-4 text-slate-300" />
                <EmptyTitle>未声明 npm scripts</EmptyTitle>
                <EmptyDescription>项目 package.json 中的 scripts 会显示在这里。</EmptyDescription>
              </Empty>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}

function Status({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="border border-slate-100 bg-slate-50 px-2.5 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-1 truncate font-mono text-[11px] text-slate-700" title={value}>
        {value}
      </p>
    </div>
  )
}
