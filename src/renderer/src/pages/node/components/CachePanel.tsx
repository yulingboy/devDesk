import { HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import type { NodeState } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmAction } from '@/components/ConfirmAction'
import { TooltipButton } from '@/components/TooltipButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
          <div
            className="flex items-center gap-3 rounded-md border border-slate-100 p-3"
            key={cache.name}
          >
            <HardDrive className="text-slate-600" size={17} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{cache.name}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="truncate text-xs text-slate-500">{cache.path}</p>
                </TooltipTrigger>
                <TooltipContent>{cache.path}</TooltipContent>
              </Tooltip>
            </div>
            <span className="text-xs text-slate-600">
              {cache.exists ? formatBytes(cache.sizeBytes) : '不存在'}
            </span>
          </div>
        ))}
        {!state?.caches.length && (
          <p className="py-5 text-center text-sm text-slate-400">
            点击刷新按钮扫描缓存路径和大小。
          </p>
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
