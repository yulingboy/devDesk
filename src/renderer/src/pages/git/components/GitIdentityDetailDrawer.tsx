import type { GitIdentityDetail } from '@shared/domain'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Drawer } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'

export function GitIdentityDetailDrawer({
  detail,
  open,
  onClose
}: {
  detail: GitIdentityDetail | null
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <Drawer
      description="由当前 Git 身份、SSH 密钥和工作区规则实时汇总，只读展示。"
      onClose={onClose}
      open={open}
      title={`身份详情${detail ? `：${detail.identity.name}` : ''}`}
    >
      {detail && (
        <div className="space-y-4 text-xs">
          <DetailBlock label="Git 身份">
            {detail.identity.username} · {detail.identity.email}
          </DetailBlock>
          <DetailBlock label="SSH 密钥">
            {detail.sshKey ? `${detail.sshKey.name} · ${detail.sshKey.fingerprint}` : '未绑定'}
            {detail.sshKey && (
              <span className="block text-slate-500">
                私钥：{detail.sshKey.privateKeyExists ? '可用' : '未找到'}
              </span>
            )}
          </DetailBlock>
          <DetailBlock label="Profile 路径">
            <span className="break-all font-mono text-[11px] text-slate-500">
              {detail.profilePath}
            </span>
          </DetailBlock>
          <DetailBlock label="关联工作区">
            {detail.workspaces.length ? (
              detail.workspaces.map((workspace) => (
                <p key={workspace.id}>
                  {workspace.name} ·{' '}
                  <span className="font-mono text-[11px] text-slate-500">{workspace.rootPath}</span>
                </p>
              ))
            ) : (
              <span className="text-slate-500">尚无关联工作区</span>
            )}
          </DetailBlock>
          <Accordion className="space-y-2" type="multiple">
            {detail.files.map((file) => (
              <AccordionItem key={file.path} value={file.path}>
                <AccordionTrigger>{file.name}</AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="max-h-52 rounded-md bg-slate-50">
                    <pre className="whitespace-pre-wrap p-2.5 text-[11px] text-slate-600">
                      {file.exists ? file.content : '文件不存在'}
                    </pre>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </Drawer>
  )
}

function DetailBlock({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <p className="font-medium text-slate-700">{label}</p>
      <div>{children}</div>
    </div>
  )
}
