import { Copy, ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { HostRecord } from '@shared/domain'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePageFeedback } from '@/hooks/usePageFeedback'

export function HostsTable({
  records,
  query,
  saving,
  onEdit,
  onRemove,
  onToggle
}: {
  records: HostRecord[]
  query: string
  saving: boolean
  onEdit: (record: HostRecord) => void
  onRemove: (record: HostRecord) => Promise<void>
  onToggle: (record: HostRecord) => Promise<void>
}): React.JSX.Element {
  const { report } = usePageFeedback('Hosts 快捷操作失败', { keepStatus: false })

  return (
    <div className="rounded-md border border-slate-100">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>状态</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>域名</TableHead>
            <TableHead>备注</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Switch
                        aria-label={`${record.enabled ? '禁用' : '启用'} ${record.domain}`}
                        checked={record.enabled}
                        disabled={saving}
                        onCheckedChange={() => void onToggle(record)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{record.enabled ? '点击禁用' : '点击启用'}</TooltipContent>
                  </Tooltip>
                  <span className={record.enabled ? 'text-emerald-600' : 'text-slate-400'}>
                    {record.enabled ? '启用' : '停用'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-mono">{record.ip}</TableCell>
              <TableCell>{record.domain}</TableCell>
              <TableCell className="text-slate-500">{record.remark || '--'}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <Tooltip>
                    <DropdownMenuTrigger asChild>
                      <TooltipTrigger asChild>
                        <Button aria-label="更多操作" size="icon" variant="ghost">
                          <MoreHorizontal size={14} />
                        </Button>
                      </TooltipTrigger>
                    </DropdownMenuTrigger>
                    <TooltipContent>更多操作</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        void navigator.clipboard
                          .writeText(`${record.ip} ${record.domain}`)
                          .then(() => toast.success('已复制到剪贴板'))
                          .catch(report)
                      }
                    >
                      <Copy size={14} />
                      复制映射
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void window.api?.hosts.openDomain(record.domain).catch(report)
                      }
                    >
                      <ExternalLink size={14} />
                      访问域名
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(record)}>
                      <Pencil size={14} />
                      编辑记录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ConfirmAction
                  description={`将从受管 Hosts 区块删除 ${record.domain}，保存后立即影响本机解析。`}
                  onConfirm={() => onRemove(record)}
                  title="删除 Hosts 记录？"
                  triggerTooltip="删除"
                >
                  <Button aria-label="删除" size="icon" variant="ghost">
                    <Trash2 size={14} />
                  </Button>
                </ConfirmAction>
              </TableCell>
            </TableRow>
          ))}
          {!records.length && (
            <TableRow>
              <TableCell className="py-10 text-center text-slate-400" colSpan={5}>
                {query ? '没有匹配记录' : '暂无受管 Hosts 记录'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
