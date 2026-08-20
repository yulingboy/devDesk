import { useState } from 'react'
import {
  CheckCircle2,
  FolderOpen,
  GitBranch,
  KeyRound,
  Pencil,
  ShieldCheck,
  XCircle
} from 'lucide-react'
import type { GitIdentity, GitWorkspaceVerification, SSHKey, Workspace } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { usePageFeedback } from '@/hooks/usePageFeedback'

interface WorkspaceDetailDrawerProps {
  identity?: GitIdentity
  onClose: () => void
  onEdit: () => void
  open: boolean
  sshKey?: SSHKey
  workspace?: Workspace
}

/** 顶部只保留工作区上下文，路径与身份等详细信息集中在此查看。 */
export function WorkspaceDetailDrawer({
  identity,
  onClose,
  onEdit,
  open,
  sshKey,
  workspace
}: WorkspaceDetailDrawerProps): React.JSX.Element {
  const [verification, setVerification] = useState<GitWorkspaceVerification>()
  const [verifying, setVerifying] = useState(false)
  const { report } = usePageFeedback('工作区操作失败', { keepStatus: false })

  const verifyIdentity = async (): Promise<void> => {
    if (!workspace || verifying) return
    setVerifying(true)
    try {
      setVerification(await window.api!.git.verifyWorkspace(workspace.id))
    } catch (error) {
      report(error)
    } finally {
      setVerifying(false)
    }
  }

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
            <Button
              onClick={() => void window.api?.workspaces.open(workspace.id).catch(report)}
              variant="success"
            >
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700" id="workspace-identity-title">
                Git / SSH 身份
              </h3>
              <Button
                disabled={!identity || verifying}
                onClick={() => void verifyIdentity()}
                size="sm"
                variant="ghost"
              >
                <ShieldCheck />
                {verifying ? '验证中' : '验证实际配置'}
              </Button>
            </div>
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
            {verification && (
              <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-100">
                {verification.message ? (
                  <p className="px-3 py-2.5 text-[11px] text-amber-700">{verification.message}</p>
                ) : (
                  <>
                    <VerificationRow label="用户名" value={verification.username} />
                    <VerificationRow label="邮箱" value={verification.email} />
                    <VerificationRow label="SSH 命令" value={verification.sshCommand} />
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}

function VerificationRow({
  label,
  value
}: {
  label: string
  value: GitWorkspaceVerification['username']
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-start gap-2 px-3 py-2">
      {value.matches ? (
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={13} />
      ) : (
        <XCircle className="mt-0.5 shrink-0 text-red-500" size={13} />
      )}
      <div className="min-w-0 text-[11px]">
        <p className="text-slate-600">
          {label}：{value.actual || '未生效'}
        </p>
        {!value.matches && (
          <p className="mt-0.5 text-slate-400">预期：{value.expected || '未配置'}</p>
        )}
        {value.source && (
          <p className="mt-0.5 truncate text-slate-400" title={value.source}>
            来源：{value.source}
          </p>
        )}
      </div>
    </div>
  )
}
