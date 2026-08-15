import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  ExternalLink,
  FileWarning,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2
} from 'lucide-react'
import type { HostRecord } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rendererLogger } from '@/lib/logger'

const emptyRecord: HostRecord = { id: '', ip: '', domain: '', enabled: true, remark: '' }

export function HostsPage(): React.JSX.Element {
  const [records, setRecords] = useState<HostRecord[]>([])
  const [draft, setDraft] = useState<HostRecord>(emptyRecord)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  const showError = useCallback((error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    rendererLogger.error('Hosts 操作失败', { error: message })
  }, [])
  const load = useCallback((): void => {
    void window.api?.hosts.list().then(setRecords).catch(showError)
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
    if (!draft.ip || !draft.domain) return setStatus('请填写 IP 地址和域名')
    const next = draft.id
      ? records.map((item) => (item.id === draft.id ? draft : item))
      : [...records, { ...draft, id: crypto.randomUUID() }]
    void window.api?.hosts
      .save(next)
      .then((value) => {
        setRecords(value)
        setDraft(emptyRecord)
        setStatus('Hosts 记录已保存')
      })
      .catch(showError)
  }
  const remove = (id: string): void => {
    if (!window.confirm('确定删除这条 Hosts 记录吗？')) return
    void window.api?.hosts
      .save(records.filter((record) => record.id !== id))
      .then(setRecords)
      .catch(showError)
  }
  const copy = (value: string): void => {
    void navigator.clipboard.writeText(value).then(() => setStatus('已复制到剪贴板'))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-8 py-8">
      <Card>
        <CardHeader className="flex-row items-start justify-between border-b border-[#e7e8e9]">
          <div>
            <CardTitle>Hosts 记录</CardTitle>
            <CardDescription>应用只维护受管区块，不覆盖其他系统内容。</CardDescription>
          </div>
          <div className="flex gap-2">
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
                  .then(() => setStatus('DNS 缓存已刷新'))
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
                    setStatus('已恢复 Hosts 备份')
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
            <Button onClick={load} size="icon" title="重新读取" variant="ghost">
              <RefreshCw size={16} />
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-[#e7e8e9]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f7f5] text-xs text-[#777b80]">
                <tr>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">域名</th>
                  <th className="px-3 py-2">备注</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr className="border-t border-[#eef0f1]" key={record.id}>
                    <td className="px-3 py-2">
                      <Badge variant={record.enabled ? 'success' : 'secondary'}>
                        {record.enabled ? '启用' : '禁用'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{record.ip}</td>
                    <td className="px-3 py-2">{record.domain}</td>
                    <td className="px-3 py-2 text-[#777b80]">{record.remark || '--'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        onClick={() => copy(`${record.ip} ${record.domain}`)}
                        size="icon"
                        title="复制"
                        variant="ghost"
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        onClick={() =>
                          void window.api?.hosts.openDomain(record.domain).catch(showError)
                        }
                        size="icon"
                        title="访问域名"
                        variant="ghost"
                      >
                        <ExternalLink size={14} />
                      </Button>
                      <Button onClick={() => setDraft(record)} size="sm" variant="ghost">
                        编辑
                      </Button>
                      <Button
                        onClick={() => remove(record.id)}
                        size="icon"
                        title="删除"
                        variant="ghost"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td className="px-3 py-10 text-center text-sm text-[#85878a]" colSpan={5}>
                      {query ? '没有匹配记录' : '暂无受管 Hosts 记录'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{draft.id ? '编辑记录' : '新增记录'}</CardTitle>
          <CardDescription>首次写入前会自动备份原始 Hosts 文件。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
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
            <input
              checked={draft.enabled}
              id="host-enabled"
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              type="checkbox"
            />
            <Label htmlFor="host-enabled">启用记录</Label>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Button onClick={save} variant="success">
              <Save size={15} />
              保存记录
            </Button>
            <Button onClick={() => setDraft(emptyRecord)} variant="ghost">
              <Plus size={15} />
              清空表单
            </Button>
          </div>
          {status && (
            <p className="flex items-center gap-2 text-xs text-[#69777d] md:col-span-3">
              <FileWarning size={14} />
              {status}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
