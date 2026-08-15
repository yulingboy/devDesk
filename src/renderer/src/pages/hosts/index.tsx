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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rendererLogger } from '@/lib/logger'
import { PageHeader } from '@/components/PageHeader'
import { Drawer } from '@/components/ui/drawer'

const emptyRecord: HostRecord = { id: '', ip: '', domain: '', enabled: true, remark: '' }

export function HostsPage(): React.JSX.Element {
  const [records, setRecords] = useState<HostRecord[]>([])
  const [draft, setDraft] = useState<HostRecord>(emptyRecord)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

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
        setDrawerOpen(false)
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
  /** Hosts 使用整表写入语义，快速开关也经过同一串行保存通道。 */
  const toggleEnabled = (id: string): void => {
    const next = records.map((record) =>
      record.id === id ? { ...record, enabled: !record.enabled } : record
    )
    void window.api?.hosts
      .save(next)
      .then((value) => {
        setRecords(value)
        setStatus('记录状态已更新')
      })
      .catch(showError)
  }
  const copy = (value: string): void => {
    void navigator.clipboard.writeText(value).then(() => setStatus('已复制到剪贴板'))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        extra={
          <Button
            onClick={() => {
              setDraft(emptyRecord)
              setDrawerOpen(true)
            }}
            variant="success"
          >
            <Plus size={15} />
            新增记录
          </Button>
        }
        title="Host 管理"
        subtitle="管理本机 Hosts 映射、备份与 DNS 缓存"
      />
      <Card>
        <CardHeader className="flex-row items-start justify-between border-b border-slate-100">
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
          <div className="overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
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
                  <tr className="border-t border-slate-100" key={record.id}>
                    <td className="px-3 py-2">
                      <button
                        aria-label={`${record.enabled ? '禁用' : '启用'} ${record.domain}`}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          record.enabled ? 'bg-[var(--accent)]' : 'bg-slate-300'
                        }`}
                        onClick={() => toggleEnabled(record.id)}
                        title={record.enabled ? '点击禁用' : '点击启用'}
                        type="button"
                      >
                        <span
                          className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${
                            record.enabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{record.ip}</td>
                    <td className="px-3 py-2">{record.domain}</td>
                    <td className="px-3 py-2 text-slate-500">{record.remark || '--'}</td>
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
                      <Button
                        onClick={() => {
                          setDraft(record)
                          setDrawerOpen(true)
                        }}
                        size="sm"
                        variant="ghost"
                      >
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
                    <td className="px-3 py-10 text-center text-sm text-slate-400" colSpan={5}>
                      {query ? '没有匹配记录' : '暂无受管 Hosts 记录'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
        <div className="space-y-5">
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
          {status && (
            <p className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
              <FileWarning size={14} />
              {status}
            </p>
          )}
        </div>
      </Drawer>
    </div>
  )
}
