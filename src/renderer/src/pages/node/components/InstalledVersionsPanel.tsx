import { ArrowRightLeft, CheckCircle2, RefreshCw, Terminal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { NodeInstall, NodeState } from '@shared/domain'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePageFeedback } from '@/hooks/usePageFeedback'

interface InstalledVersionsPanelProps {
  state: NodeState | null
  loading: boolean
  versionAction: string
  onRefresh: () => void
  onChangeVersion: (version: string, setDefault: boolean) => void
  onRemove: (item: NodeInstall) => void | Promise<void>
}

/** 已安装版本面板只负责展示版本和派发用户操作。 */
export function InstalledVersionsPanel({
  state,
  loading,
  versionAction,
  onRefresh,
  onChangeVersion,
  onRemove
}: InstalledVersionsPanelProps): React.JSX.Element {
  const { report } = usePageFeedback('打开 Node 终端失败', { keepStatus: false })

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 flex-row items-start justify-between">
        <div>
          <CardTitle>已安装版本</CardTitle>
          <CardDescription>
            切换会更新工作台后续命令的 Node 环境；设置默认会影响新终端会话。
          </CardDescription>
        </div>
        <TooltipButton
          loading={loading}
          onClick={onRefresh}
          size="icon"
          tooltip="刷新状态"
          variant="ghost"
        >
          <RefreshCw size={15} />
        </TooltipButton>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <ScrollArea className="h-full pr-2">
          <div className="space-y-1.5">
            {state?.installed.map((item) => (
              <Item key={item.version}>
                <ItemContent className="flex min-w-0 flex-row items-center gap-2">
                  <ItemTitle className="font-mono">v{item.version}</ItemTitle>
                  {item.isCurrent && <Badge variant="success">当前</Badge>}
                  {item.isDefault && <Badge variant="secondary">默认</Badge>}
                  <ItemDescription className="min-w-0 flex-1" title={item.path}>
                    {item.path}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <TooltipButton
                    disabled={
                      item.isCurrent || !state?.capabilities?.canSwitch || Boolean(versionAction)
                    }
                    loading={versionAction === `switch:${item.version}`}
                    loadingText="切换中"
                    onClick={() => onChangeVersion(item.version, false)}
                    size="icon"
                    tooltip="切换 Node 版本"
                    variant="ghost"
                  >
                    <ArrowRightLeft size={13} />
                  </TooltipButton>
                  <TooltipButton
                    disabled={!state?.capabilities?.canUseInTerminal || Boolean(versionAction)}
                    onClick={() =>
                      void window.api?.node
                        .useInTerminal(item.version)
                        .then(() => toast.success(`已在新终端中启用 Node ${item.version}`))
                        .catch(report)
                    }
                    size="icon"
                    tooltip="在新终端中使用"
                    variant="ghost"
                  >
                    <Terminal size={14} />
                  </TooltipButton>
                  <TooltipButton
                    disabled={
                      item.isDefault ||
                      !state?.capabilities?.canSetDefault ||
                      Boolean(versionAction)
                    }
                    loading={versionAction === `default:${item.version}`}
                    loadingText="设置中"
                    onClick={() => onChangeVersion(item.version, true)}
                    size="icon"
                    tooltip="设为默认 Node 版本"
                    variant="ghost"
                  >
                    <CheckCircle2 size={13} />
                  </TooltipButton>
                  <ConfirmAction
                    description={`将删除本机 nvm 管理的 Node ${item.version}。当前使用中的版本不能删除。`}
                    onConfirm={() => onRemove(item)}
                    title="删除 Node 版本？"
                    triggerTooltip="删除版本"
                  >
                    <Button
                      aria-label="删除版本"
                      disabled={
                        item.isCurrent || !state?.capabilities?.canSwitch || Boolean(versionAction)
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </ConfirmAction>
                </ItemActions>
              </Item>
            ))}
            {!state?.installed.length && (
              <Empty>
                <EmptyTitle>尚未发现 Node 版本</EmptyTitle>
                <EmptyDescription>安装版本后会显示在这里。</EmptyDescription>
              </Empty>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
