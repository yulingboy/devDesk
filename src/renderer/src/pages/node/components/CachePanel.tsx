import { HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import type { NodeState } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmAction } from '@/components/ConfirmAction'
import { TooltipButton } from '@/components/TooltipButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'

interface CachePanelProps {
  state: NodeState | null
  onState: (state: NodeState) => void
  report: (error: unknown) => void
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(2)} GB`
}

export function CachePanel({ state, onState, report }: CachePanelProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>环境路径与缓存</CardTitle>
          <CardDescription>扫描常见缓存目录；清理只调用各包管理器的官方命令。</CardDescription>
        </div>
        <TooltipButton
          onClick={() => void window.api?.node.scanCaches().then(onState).catch(report)}
          size="icon"
          tooltip="扫描缓存"
          variant="ghost"
        >
          <RefreshCw size={15} />
        </TooltipButton>
      </CardHeader>
      <CardContent className="space-y-2">
        {state?.caches.map((cache) => (
          <Item key={cache.name}>
            <ItemMedia className="bg-slate-100 text-slate-600">
              <HardDrive />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{cache.name}</ItemTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ItemDescription>{cache.path}</ItemDescription>
                </TooltipTrigger>
                <TooltipContent>{cache.path}</TooltipContent>
              </Tooltip>
            </ItemContent>
            <ItemActions>
              <span className="text-[11px] text-slate-600">
                {cache.exists ? formatBytes(cache.sizeBytes) : '不存在'}
              </span>
            </ItemActions>
          </Item>
        ))}
        {!state?.caches.length && (
          <Empty>
            <EmptyTitle>尚未扫描缓存路径</EmptyTitle>
            <EmptyDescription>点击右上角刷新按钮读取缓存目录和大小。</EmptyDescription>
          </Empty>
        )}
        <ConfirmAction
          description="将清理 npm、pnpm、yarn 和 bun 缓存，不会删除已安装的 Node 版本。"
          onConfirm={() => void window.api?.node.clearCaches().then(onState).catch(report)}
          title="清理包管理缓存？"
        >
          <Button variant="outline">
            <Trash2 size={15} />
            清理包管理缓存
          </Button>
        </ConfirmAction>
      </CardContent>
    </Card>
  )
}
