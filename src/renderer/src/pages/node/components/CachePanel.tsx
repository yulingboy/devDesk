import { FolderOpen, HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import type { NodeState } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { useAsyncAction } from '@/hooks/useAsyncAction'
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
  loading: boolean
  onScan: () => void
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(2)} GB`
}

export function CachePanel({
  state,
  onState,
  report,
  loading,
  onScan
}: CachePanelProps): React.JSX.Element {
  const { run } = useAsyncAction(report)
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>缓存占用</CardTitle>
          <CardDescription>首次进入自动读取；清理只调用各包管理器的官方命令。</CardDescription>
        </div>
        <TooltipButton
          loading={loading}
          onClick={onScan}
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
              <TooltipButton
                disabled={!cache.exists}
                onClick={() => void window.api?.node.openPath(cache.path).catch(report)}
                size="icon"
                tooltip="打开缓存目录"
                variant="ghost"
              >
                <FolderOpen size={14} />
              </TooltipButton>
              {cache.clearable && cache.id && cache.id !== 'nvm' && (
                <ConfirmAction
                  description={`将使用 ${cache.name} 的官方命令清理缓存，不会删除全局包或已安装的 Node 版本。`}
                  onConfirm={async () => {
                    const value = await run(
                      `cache-clear:${cache.id}`,
                      () =>
                        window.api!.node.clearCache(cache.id as 'npm' | 'pnpm' | 'yarn' | 'bun'),
                      { success: `${cache.name} 缓存已清理` }
                    )
                    if (value) onState(value)
                  }}
                  title={`清理 ${cache.name}？`}
                  triggerTooltip={`清理 ${cache.name}`}
                >
                  <Button aria-label={`清理 ${cache.name}`} size="icon" variant="ghost">
                    <Trash2 size={14} />
                  </Button>
                </ConfirmAction>
              )}
            </ItemActions>
          </Item>
        ))}
        {!state?.caches.length && (
          <Empty>
            <EmptyTitle>{loading ? '正在读取缓存大小' : '尚未读取缓存大小'}</EmptyTitle>
            <EmptyDescription>
              {loading
                ? '首次扫描会统计各缓存目录的占用空间。'
                : '点击右上角刷新按钮读取缓存目录和大小。'}
            </EmptyDescription>
          </Empty>
        )}
        <ConfirmAction
          description="将依次清理当前可用的 npm、pnpm、yarn 和 bun 缓存；某一项失败时会明确提示，不会删除 Node 版本。"
          onConfirm={async () => {
            const value = await run('caches-clear', () => window.api!.node.clearCaches(), {
              success: '包管理器缓存已清理'
            })
            if (value) onState(value)
          }}
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
