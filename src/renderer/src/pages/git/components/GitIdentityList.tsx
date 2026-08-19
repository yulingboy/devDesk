import { Copy, FileText, GitBranch, Pencil, Trash2 } from 'lucide-react'
import type { GitIdentity } from '@shared/domain'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'

export function GitIdentityList({
  identities,
  status,
  isPending,
  onDetail,
  onEdit,
  onCopy,
  onRemove
}: {
  identities: GitIdentity[]
  status: string
  isPending: (key: string) => boolean
  onDetail: (identity: GitIdentity) => void
  onEdit: (identity: GitIdentity) => void
  onCopy: (identity: GitIdentity) => void
  onRemove: (identity: GitIdentity) => Promise<void>
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>身份配置</CardTitle>
          <CardDescription>工作区可以绑定身份，后续用于生成 includeIf Git 规则。</CardDescription>
        </div>
        <Badge variant="secondary">{identities.length} 个身份</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {identities.map((item) => (
          <Item key={item.id}>
            <ItemMedia>
              <GitBranch />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{item.name}</ItemTitle>
              <ItemDescription>
                {item.username} · {item.email}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <TooltipButton
                loading={isPending(`git-detail:${item.id}`)}
                onClick={() => onDetail(item)}
                size="icon"
                tooltip="查看身份详情"
                variant="ghost"
              >
                <FileText size={15} />
              </TooltipButton>
              <TooltipButton
                onClick={() => onEdit(item)}
                size="icon"
                tooltip="编辑身份"
                variant="ghost"
              >
                <Pencil size={15} />
              </TooltipButton>
              <TooltipButton
                onClick={() => onCopy(item)}
                size="icon"
                tooltip="复制身份"
                variant="ghost"
              >
                <Copy size={15} />
              </TooltipButton>
              <ConfirmAction
                description={`删除身份“${item.name}”后将无法恢复；被工作区引用时操作会被拒绝。`}
                onConfirm={() => onRemove(item)}
                title="删除 Git 身份？"
                triggerTooltip="删除身份"
              >
                <Button aria-label="删除身份" size="icon" variant="ghost">
                  <Trash2 size={15} />
                </Button>
              </ConfirmAction>
            </ItemActions>
          </Item>
        ))}
        {status && (
          <Alert variant="destructive">
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
