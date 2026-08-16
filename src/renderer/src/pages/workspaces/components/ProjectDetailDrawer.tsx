import { Code2, FolderKanban, FolderOpen, GitBranch, KeyRound, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { GitIdentity, Project, SSHKey, Workspace } from '@shared/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmAction } from '@/components/ConfirmAction'

interface ProjectDetailDrawerProps {
  identity?: GitIdentity
  project?: Project
  sshKey?: SSHKey
  workspace?: Workspace
  open: boolean
  removing: boolean
  onClose: () => void
  onOpenEditor: (path: string) => void
  onOpenFolder: (path: string) => void
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
  onOpenEditor,
  onOpenFolder,
  onRemove
}: ProjectDetailDrawerProps): React.JSX.Element {
  const directoryAvailable = project?.directoryExists !== false
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
              <Button disabled={removing} size="icon" variant="ghost">
                {removing ? <Spinner /> : <Trash2 />}
              </Button>
            </ConfirmAction>
            <Button onClick={onClose} variant="secondary">
              关闭
            </Button>
            <Button
              disabled={!directoryAvailable}
              onClick={() => onOpenFolder(project.path)}
              variant="outline"
            >
              <FolderOpen />
              打开目录
            </Button>
            <Button
              disabled={!directoryAvailable}
              onClick={() => onOpenEditor(project.path)}
              variant="success"
            >
              <Code2 />
              VS Code
            </Button>
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
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700" id="project-location-title">
                项目位置
              </h3>
              <Badge variant={project.source === 'manual' ? 'secondary' : 'outline'}>
                {project.source === 'manual' ? '手动纳入' : '扫描发现'}
              </Badge>
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
            </dl>
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
