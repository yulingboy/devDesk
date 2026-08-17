import { FolderOpen, GitBranch, KeyRound, Pencil } from 'lucide-react'
import type { GitIdentity, SSHKey, Workspace } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'

interface WorkspaceDetailDrawerProps {
  identity?: GitIdentity
  onClose: () => void
  onEdit: () => void
  onOpenFolder: () => void
  open: boolean
  sshKey?: SSHKey
  workspace?: Workspace
}

/** 顶部只保留工作区上下文，路径与身份等详细信息集中在此查看。 */
export function WorkspaceDetailDrawer({
  identity,
  onClose,
  onEdit,
  onOpenFolder,
  open,
  sshKey,
  workspace
}: WorkspaceDetailDrawerProps): React.JSX.Element {
  return (
    <Drawer
      description="查看工作区目录、备注与当前绑定的 Git / SSH 身份。"
      footer={
        workspace ? (
          <>
            <Button onClick={onClose} variant="secondary">
              关闭
            </Button>
            <Button onClick={onEdit} variant="outline">
              <Pencil />
              编辑工作区
            </Button>
            <Button onClick={onOpenFolder}>
              <FolderOpen />
              打开目录
            </Button>
          </>
        ) : undefined
      }
      onClose={onClose}
      open={open}
      title={workspace?.name ?? '工作区详情'}
    >
      {workspace && (
        <div className="space-y-4">
          <section aria-labelledby="workspace-basic-title">
            <h3 className="mb-2 text-xs font-semibold text-slate-700" id="workspace-basic-title">
              工作区信息
            </h3>
            <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded-md bg-slate-50 px-3 py-2.5 text-xs">
              <dt className="text-slate-400">根目录</dt>
              <dd className="break-all font-mono text-[11px] text-slate-700">
                {workspace.rootPath}
              </dd>
              <dt className="text-slate-400">项目数量</dt>
              <dd className="text-slate-700">{workspace.projects.length} 个一级项目</dd>
              <dt className="text-slate-400">备注</dt>
              <dd className="whitespace-pre-wrap text-slate-700">
                {workspace.description || '未填写备注'}
              </dd>
            </dl>
          </section>

          <Separator />

          <section aria-labelledby="workspace-identity-title">
            <h3 className="mb-2 text-xs font-semibold text-slate-700" id="workspace-identity-title">
              Git / SSH 身份
            </h3>
            <div className="space-y-1.5">
              <Item>
                <GitBranch className="shrink-0 text-slate-400" size={15} />
                <ItemContent>
                  <ItemTitle>{identity?.name ?? '未绑定 Git 身份'}</ItemTitle>
                  <ItemDescription>
                    {identity
                      ? `${identity.username} · ${identity.email}`
                      : '可在编辑工作区时进行绑定'}
                  </ItemDescription>
                </ItemContent>
              </Item>
              <Item>
                <KeyRound className="shrink-0 text-slate-400" size={15} />
                <ItemContent>
                  <ItemTitle>{sshKey?.name ?? '未绑定 SSH 密钥'}</ItemTitle>
                  <ItemDescription>
                    {sshKey?.fingerprint ?? '当前 Git 身份没有关联 SSH 密钥'}
                  </ItemDescription>
                </ItemContent>
              </Item>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  )
}
