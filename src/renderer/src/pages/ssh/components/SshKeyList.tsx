import { useState } from 'react'
import { Copy, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { SSHDeleteImpact, SSHKey } from '@shared/domain'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'
import { usePageFeedback } from '@/hooks/usePageFeedback'

export function SshKeyList({
  keys,
  query,
  onDelete,
  onEdit
}: {
  keys: SSHKey[]
  query: string
  onDelete: (key: SSHKey) => Promise<void>
  onEdit: (key: SSHKey) => void
}): React.JSX.Element {
  const { report } = usePageFeedback('复制 SSH 公钥失败', { keepStatus: false })
  const [deleteImpact, setDeleteImpact] = useState<SSHDeleteImpact | null>(null)

  return (
    <div className="space-y-2">
      {keys.map((key) => (
        <Item key={key.id}>
          <ItemMedia>
            <KeyRound />
          </ItemMedia>
          <ItemContent>
            <div className="flex items-center gap-2">
              <ItemTitle>{key.name}</ItemTitle>
              <Badge variant="secondary">{key.algorithm}</Badge>
              {key.privateKeyPath && (
                <Badge variant={key.privateKeyExists ? 'success' : 'outline'}>
                  {key.privateKeyExists ? '私钥可用' : '私钥缺失'}
                </Badge>
              )}
            </div>
            <ItemDescription className="font-mono">{key.fingerprint}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <TooltipButton
              onClick={() => onEdit(key)}
              size="icon"
              tooltip="编辑公钥"
              variant="ghost"
            >
              <Pencil size={15} />
            </TooltipButton>
            <TooltipButton
              onClick={() =>
                void navigator.clipboard
                  .writeText(key.publicKey)
                  .then(() => toast.success('公钥已复制'))
                  .catch(report)
              }
              size="icon"
              tooltip="复制公钥"
              variant="ghost"
            >
              <Copy size={15} />
            </TooltipButton>
            <ConfirmAction
              description={
                deleteImpact?.key.id === key.id ? (
                  <span>
                    将删除密钥元数据“{key.name}”，磁盘上的密钥文件不会删除。{' '}
                    {deleteImpact.identities.length
                      ? `会解除 ${deleteImpact.identities.map((item) => item.name).join('、')} 的绑定。`
                      : '当前没有 Git 身份绑定此密钥。'}
                  </span>
                ) : (
                  `正在读取密钥“${key.name}”的关联影响。`
                )
              }
              onConfirm={() => onDelete(key)}
              onOpenChange={(open) => {
                if (!open) return
                setDeleteImpact(null)
                void window.api?.ssh.getDeleteImpact(key.id).then(setDeleteImpact).catch(report)
              }}
              title="删除 SSH 密钥元数据？"
              triggerTooltip="删除密钥"
            >
              <Button aria-label="删除密钥" size="icon" variant="ghost">
                <Trash2 size={15} />
              </Button>
            </ConfirmAction>
          </ItemActions>
        </Item>
      ))}
      {!keys.length && (
        <Empty>
          <EmptyTitle>{query ? '没有匹配的 SSH 密钥' : '尚未发现 SSH 公钥'}</EmptyTitle>
          <EmptyDescription>
            {query
              ? '尝试修改搜索条件，或清空搜索框查看全部密钥。'
              : '可手动录入已有公钥，或直接生成新密钥。'}
          </EmptyDescription>
        </Empty>
      )}
    </div>
  )
}
