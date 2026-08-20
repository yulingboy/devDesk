import { ExternalLink, Import, Plus, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/common/TooltipButton'
import { ResourcePanel } from '@/components/common/ResourcePanel'
import { SearchInput } from '@/components/common/SearchInput'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { ConfirmAction } from '@/components/common/ConfirmAction'

export function HostsToolbar({
  query,
  pending,
  onQueryChange,
  onCreate,
  onRestore,
  onRefresh,
  onImportSystem,
  systemRecordCount,
  children
}: {
  query: string
  pending: { restore: boolean; refresh: boolean }
  onQueryChange: (value: string) => void
  onCreate: () => void
  onRestore: () => void
  onRefresh: () => void
  onImportSystem: () => Promise<void>
  systemRecordCount: number
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
      {systemRecordCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
          <span>检测到 {systemRecordCount} 条系统已有映射，当前不会自动接管。</span>
          <ConfirmAction
            description="导入后，这些映射会从系统原位置移入 DevDesk 受管区块，后续可在列表中启用、停用或删除。"
            onConfirm={onImportSystem}
            title={`导入 ${systemRecordCount} 条系统 Hosts 记录？`}
            triggerTooltip="导入系统已有记录"
          >
            <Button size="sm" variant="outline">
              <Import />
              导入
            </Button>
          </ConfirmAction>
        </div>
      )}
      {children}
    </ResourcePanel>
  )
}
