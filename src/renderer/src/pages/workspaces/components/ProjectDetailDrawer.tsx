import {
  FolderKanban,
  FolderOpen,
  FolderTree,
  GitBranch,
  KeyRound,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { GitIdentity, Project, SSHKey, Workspace, WorkspaceSubproject } from '@shared/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import { ProjectEditorMenu } from './ProjectEditorMenu'
import { usePageFeedback } from '@/hooks/usePageFeedback'

interface ProjectDetailDrawerProps {
  identity?: GitIdentity
  project?: Project
  sshKey?: SSHKey
  workspace?: Workspace
  open: boolean
  removing: boolean
  onClose: () => void
  onCreateSubproject: (project: Project) => void
  onEditRemark: (project: Project) => void
  onEditSubprojectRemark: (subproject: WorkspaceSubproject) => void
  onRemove: () => Promise<void>
}

/**
 * 项目详情只回答工作区的两个核心问题：项目在哪里，以及继承哪套 Git/SSH 身份。
 * 语言运行时、依赖和脚本属于各自的环境管理页，不在这里判定项目是否“就绪”。
 */
export function ProjectDetailDrawer({
  identity,
  project,
  sshKey,
  workspace,
  open,
  removing,
  onClose,
  onCreateSubproject,
  onEditRemark,
  onEditSubprojectRemark,
  onRemove
}: ProjectDetailDrawerProps): React.JSX.Element {
  const directoryAvailable = project?.directoryExists !== false
  const { report } = usePageFeedback('打开项目目录失败', { keepStatus: false })
  return (
    <Drawer
      className="sm:max-w-lg"
      description="查看项目目录及当前工作区继承的 Git/SSH 身份。"
      footer={
        project ? (
          <>
            <ConfirmAction
              description={`将从当前工作区移除“${project.name}”的应用内引用，不会删除磁盘目录或源代码。`}
              onConfirm={onRemove}
              title="从工作区移除项目？"
              triggerTooltip="从工作区移除"
            >
              <Button disabled={removing} size="sm" variant="outline">
                {removing ? <Spinner /> : <Trash2 />}
                移除项目
              </Button>
            </ConfirmAction>
            <Button onClick={onClose} variant="secondary">
              关闭
            </Button>
            <Button
              disabled={!directoryAvailable}
              onClick={() => void window.api?.workspaces.openProject(project.path).catch(report)}
              variant="outline"
            >
              <FolderOpen />
              打开目录
            </Button>
            <ProjectEditorMenu labeled disabled={!directoryAvailable} path={project.path} />
          </>
        ) : undefined
      }
      onClose={onClose}
      open={open}
      title={project?.name ?? '项目详情'}
    >
      {project && workspace && (
        <div className="space-y-4">
          {!directoryAvailable && (
            <Alert variant="warning">
              <AlertDescription>
                项目目录已被移动或删除，可以从工作区移除这条记录后重新扫描。
              </AlertDescription>
            </Alert>
          )}

          <section aria-labelledby="project-location-title">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700" id="project-location-title">
                项目位置
              </h3>
              <div className="flex items-center gap-1">
                <Badge variant={project.source === 'manual' ? 'secondary' : 'outline'}>
                  {project.source === 'manual' ? '手动纳入' : '扫描发现'}
                </Badge>
                <TooltipButton
                  onClick={() => onEditRemark(project)}
                  size="icon"
                  tooltip="编辑项目备注"
                  variant="ghost"
                >
                  <Pencil size={14} />
                </TooltipButton>
              </div>
            </div>
            <Item>
              <FolderKanban className="shrink-0 text-slate-400" />
              <ItemContent>
                <ItemTitle>{project.name}</ItemTitle>
                <ItemDescription title={project.path}>{project.path}</ItemDescription>
              </ItemContent>
            </Item>
            <dl className="mt-2 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs">
              <dt className="text-slate-400">所属工作区</dt>
              <dd className="truncate text-slate-700">{workspace.name}</dd>
              <dt className="text-slate-400">相对路径</dt>
              <dd className="truncate font-mono text-[11px] text-slate-600">
                {formatRelativePath(project.path, workspace.rootPath)}
              </dd>
              <dt className="text-slate-400">备注</dt>
              <dd className="truncate text-slate-700">{project.remark || '未填写备注'}</dd>
              <dt className="text-slate-400">Git 状态</dt>
              <dd className="flex min-w-0 items-center gap-1.5 text-slate-700">
                <Badge className={project.gitError ? 'text-red-600' : undefined} variant="outline">
                  {formatGitStatus(project.gitStatus)}
                </Badge>
                {project.branch && (
                  <span className="truncate font-mono text-[11px]">{project.branch}</span>
                )}
                {project.dirty && <span className="text-[11px] text-amber-600">有未提交变更</span>}
              </dd>
            </dl>
            {project.gitError && (
              <Alert className="mt-2" variant="warning">
                <AlertDescription>{project.gitError}</AlertDescription>
              </Alert>
            )}
          </section>

          <Separator />

          <section aria-labelledby="project-subprojects-title">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-slate-700" id="project-subprojects-title">
                子项目
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">
                  {project.subprojects?.length ?? 0} 个
                </span>
                <Button onClick={() => onCreateSubproject(project)} size="sm" variant="ghost">
                  <Plus />
                  创建子项目
                </Button>
              </div>
            </div>
            {project.subprojects?.length ? (
              <div className="space-y-1.5">
                {project.subprojects.map((subproject) => (
                  <Item key={subproject.id}>
                    <FolderTree className="shrink-0 text-slate-400" size={15} />
                    <ItemContent>
                      <ItemTitle className="truncate">{subproject.name}</ItemTitle>
                      <ItemDescription title={subproject.remark || subproject.path}>
                        {subproject.remark || formatRelativePath(subproject.path, project.path)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <TooltipButton
                        onClick={() => onEditSubprojectRemark(subproject)}
                        size="icon"
                        tooltip="编辑子项目备注"
                        variant="ghost"
                      >
                        <Pencil size={14} />
                      </TooltipButton>
                      <ProjectEditorMenu
                        disabled={subproject.directoryExists === false}
                        path={subproject.path}
                      />
                      <TooltipButton
                        disabled={subproject.directoryExists === false}
                        onClick={() =>
                          void window.api?.workspaces.openProject(subproject.path).catch(report)
                        }
                        size="icon"
                        tooltip="打开子项目目录"
                        variant="ghost"
                      >
                        <FolderOpen size={14} />
                      </TooltipButton>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 px-3 py-2.5 text-[11px] text-slate-400">
                当前一级目录下未识别到独立子项目。
              </p>
            )}
          </section>

          <Separator />

          <section aria-labelledby="project-identity-title">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-slate-700" id="project-identity-title">
                Git / SSH 身份
              </h3>
              <Button asChild size="sm" variant="ghost">
                <Link to="/git">管理身份</Link>
              </Button>
            </div>
            {identity ? (
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                <IdentityRow
                  description={`${identity.username} · ${identity.email}`}
                  icon={GitBranch}
                  title={identity.name}
                />
                <IdentityRow
                  description={
                    sshKey
                      ? `${sshKey.algorithm} · ${sshKey.fingerprint}`
                      : identity.sshKeyId
                        ? '关联的密钥已不存在'
                        : '当前 Git 身份未绑定 SSH 密钥'
                  }
                  icon={KeyRound}
                  title={sshKey?.name ?? '未绑定 SSH 密钥'}
                />
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  当前工作区未绑定 Git 身份，项目不会应用工作区级的 Git 用户和 SSH 密钥配置。
                </AlertDescription>
              </Alert>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}

function IdentityRow({
  description,
  icon: Icon,
  title
}: {
  description: string
  icon: typeof GitBranch
  title: string
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
      <Icon className="shrink-0 text-slate-400" size={15} />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-700">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400" title={description}>
          {description}
        </p>
      </div>
    </div>
  )
}

function formatRelativePath(projectPath: string, rootPath: string): string {
  const normalizedRoot = rootPath.replace(/\/$/, '')
  if (!projectPath.startsWith(`${normalizedRoot}/`)) return '外部目录'
  return `./${projectPath.slice(normalizedRoot.length + 1)}`
}

function formatGitStatus(status: Project['gitStatus']): string {
  switch (status) {
    case 'ready':
      return '正常'
    case 'not-repository':
      return '非 Git 仓库'
    case 'git-missing':
      return '未安装 Git'
    case 'no-remote':
      return '无远程仓库'
    case 'error':
      return '读取失败'
    default:
      return '未检测'
  }
}
