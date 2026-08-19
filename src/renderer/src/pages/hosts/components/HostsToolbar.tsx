import { ExternalLink, Plus, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/common/TooltipButton'
import { ResourcePanel } from '@/components/common/ResourcePanel'
import { SearchInput } from '@/components/common/SearchInput'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { usePageFeedback } from '@/hooks/usePageFeedback'

export function HostsToolbar({
  query,
  pending,
  onQueryChange,
  onCreate,
  onRestore,
  onRefresh,
  children
}: {
  query: string
  pending: { restore: boolean; refresh: boolean }
  onQueryChange: (value: string) => void
  onCreate: () => void
  onRestore: () => void
  onRefresh: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const { report } = usePageFeedback('Hosts 工具操作失败', { keepStatus: false })
  const { isPending, run } = useAsyncAction(report)

  return (
    <ResourcePanel
      actions={
        <div className="flex gap-2">
          <Button onClick={onCreate} size="sm" variant="success">
            <Plus size={14} />
            新增记录
          </Button>
          <Button
            onClick={() => void window.api?.hosts.openFile().catch(report)}
            size="sm"
            variant="secondary"
          >
            <ExternalLink size={14} />
            打开文件
          </Button>
          <Button
            loading={isPending('hosts-dns')}
            loadingText="刷新中"
            onClick={() =>
              void run('hosts-dns', () => window.api!.hosts.flushDns(), {
                success: 'DNS 缓存已刷新'
              })
            }
            size="sm"
            variant="secondary"
          >
            <RefreshCw size={14} />
            刷新 DNS
          </Button>
          <Button
            loading={pending.restore}
            loadingText="恢复中"
            onClick={onRestore}
            size="sm"
            variant="outline"
          >
            <RotateCcw size={14} />
            恢复备份
          </Button>
        </div>
      }
      contentClassName="space-y-4 pt-5"
      description="应用只维护受管区块，不覆盖其他系统内容。"
      headerClassName="border-b border-slate-100"
      title="Hosts 记录"
    >
      <div className="flex items-center gap-1.5">
        <SearchInput
          className="flex-1"
          onValueChange={onQueryChange}
          placeholder="搜索 IP、域名或备注"
          value={query}
        />
        <TooltipButton
          loading={pending.refresh}
          onClick={onRefresh}
          size="icon"
          tooltip="重新读取"
          variant="ghost"
        >
          <RefreshCw size={16} />
        </TooltipButton>
      </div>
      {children}
    </ResourcePanel>
  )
}
