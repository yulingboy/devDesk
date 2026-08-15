import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Copy,
  ExternalLink,
  FileWarning,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2
} from 'lucide-react'
import type { HostRecord } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rendererLogger } from '@/lib/logger'
import { Drawer } from '@/components/ui/drawer'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ConfirmAction } from '@/components/ConfirmAction'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { TooltipButton } from '@/components/TooltipButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const emptyRecord: HostRecord = { id: '', ip: '', domain: '', enabled: true, remark: '' }

export function HostsPage(): React.JSX.Element {
  const [records, setRecords] = useState<HostRecord[]>([])
  const [draft, setDraft] = useState<HostRecord>(emptyRecord)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const showError = useCallback((error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    toast.error(message)
    rendererLogger.error('Hosts 操作失败', { error: message })
  }, [])
  const load = useCallback((): void => {
    void window.api?.hosts
      .list()
      .then(setRecords)
      .catch(showError)
      .finally(() => setLoading(false))
  }, [showError])
  useEffect(() => load(), [load])

  const filtered = useMemo(
    () =>
      records.filter((record) =>
        `${record.ip} ${record.domain} ${record.remark}`.toLowerCase().includes(query.toLowerCase())
      ),
    [records, query]
  )
  const save = (): void => {
    if (!draft.ip || !draft.domain) {
      setStatus('请填写 IP 地址和域名')
      toast.error('请填写 IP 地址和域名')
      return
    }
    const next = draft.id
      ? records.map((item) => (item.id === draft.id ? draft : item))
      : [...records, { ...draft, id: crypto.randomUUID() }]
    void window.api?.hosts
      .save(next)
      .then((value) => {
        setRecords(value)
        setDraft(emptyRecord)
        setDrawerOpen(false)
        setStatus('')
        toast.success('Hosts 记录已保存')
      })
      .catch(showError)
  }
  const remove = (id: string): void => {
    void window.api?.hosts
      .save(records.filter((record) => record.id !== id))
      .then(setRecords)
      .catch(showError)
  }
  /** Hosts 使用整表写入语义，快速开关也经过同一串行保存通道。 */
  const toggleEnabled = (id: string): void => {
    const next = records.map((record) =>
      record.id === id ? { ...record, enabled: !record.enabled } : record
    )
    void window.api?.hosts
      .save(next)
      .then((value) => {
        setRecords(value)
        toast.success('记录状态已更新')
      })
      .catch(showError)
  }
  const copy = (value: string): void => {
    void navigator.clipboard.writeText(value).then(() => toast.success('已复制到剪贴板'))
  }

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <Card>
        <CardHeader className="flex-row items-start justify-between border-b border-slate-100">
          <div>
            <CardTitle>Hosts 记录</CardTitle>
            <CardDescription>应用只维护受管区块，不覆盖其他系统内容。</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setDraft(emptyRecord)
                setDrawerOpen(true)
              }}
              variant="success"
            >
              <Plus size={14} />
              新增记录
            </Button>
            <Button
              onClick={() => void window.api?.hosts.openFile().catch(showError)}
              size="sm"
              variant="secondary"
            >
              <ExternalLink size={14} />
              打开文件
            </Button>
            <Button
              onClick={() =>
                void window.api?.hosts
                  .flushDns()
                  .then(() => toast.success('DNS 缓存已刷新'))
                  .catch(showError)
              }
              size="sm"
              variant="secondary"
            >
              <RefreshCw size={14} />
              刷新 DNS
            </Button>
            <Button
              onClick={() =>
                void window.api?.hosts
                  .restoreBackup()
                  .then((value) => {
                    setRecords(value)
                    toast.success('已恢复 Hosts 备份')
                  })
                  .catch(showError)
              }
              size="sm"
              variant="outline"
            >
              <RotateCcw size={14} />
              恢复备份
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-3">
            <Input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 IP、域名或备注"
              value={query}
            />
            <TooltipButton onClick={load} size="icon" tooltip="重新读取" variant="ghost">
              <RefreshCw size={16} />
            </TooltipButton>
          </div>
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
                {filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Switch
                            aria-label={`${record.enabled ? '禁用' : '启用'} ${record.domain}`}
                            checked={record.enabled}
                            onCheckedChange={() => toggleEnabled(record.id)}
                          />
                        </TooltipTrigger>
                        <TooltipContent>{record.enabled ? '点击禁用' : '点击启用'}</TooltipContent>
                      </Tooltip>
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
                          <DropdownMenuItem onSelect={() => copy(`${record.ip} ${record.domain}`)}>
                            <Copy size={14} />
                            复制映射
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              void window.api?.hosts.openDomain(record.domain).catch(showError)
                            }
                          >
                            <ExternalLink size={14} />
                            访问域名
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setDraft(record)
                              setDrawerOpen(true)
                            }}
                          >
                            <Save size={14} />
                            编辑记录
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ConfirmAction
                        description={`将从受管 Hosts 区块删除 ${record.domain}，保存后立即影响本机解析。`}
                        onConfirm={() => remove(record.id)}
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
                {!filtered.length && (
                  <TableRow>
                    <TableCell className="py-10 text-center text-slate-400" colSpan={5}>
                      {query ? '没有匹配记录' : '暂无受管 Hosts 记录'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Drawer
        description="首次写入前会自动备份原始 Hosts 文件；保存失败时会保留当前输入。"
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)} variant="secondary">
              取消
            </Button>
            <Button onClick={save} variant="success">
              <Save size={15} />
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        title={draft.id ? '编辑 Host 记录' : '新增 Host 记录'}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="host-ip">IP 地址</Label>
            <Input
              id="host-ip"
              onChange={(event) => setDraft({ ...draft, ip: event.target.value })}
              placeholder="127.0.0.1"
              value={draft.ip}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="host-domain">域名</Label>
            <Input
              id="host-domain"
              onChange={(event) => setDraft({ ...draft, domain: event.target.value })}
              placeholder="dev.example.com"
              value={draft.domain}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="host-remark">备注</Label>
            <Input
              id="host-remark"
              onChange={(event) => setDraft({ ...draft, remark: event.target.value })}
              placeholder="可选"
              value={draft.remark}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.enabled}
              id="host-enabled"
              onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked === true })}
            />
            <Label htmlFor="host-enabled">启用记录</Label>
          </div>
          {status && (
            <Alert variant="destructive">
              <FileWarning size={14} />
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
        </div>
      </Drawer>
    </div>
  )
}
