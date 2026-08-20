import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { HostRecord } from '@shared/domain'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useInitialLoad } from '@/hooks/useInitialLoad'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { HostEditorDrawer } from './components/HostEditorDrawer'
import { HostsTable } from './components/HostsTable'
import { HostsToolbar } from './components/HostsToolbar'

const emptyRecord: HostRecord = { id: '', ip: '', domain: '', enabled: true, remark: '' }

/** Hosts 页面入口只组合资源、操作栏、表格和编辑抽屉。 */
export function HostsPage(): React.JSX.Element {
  const [records, setRecords] = useState<HostRecord[]>([])
  const [systemRecords, setSystemRecords] = useState<HostRecord[]>([])
  const [draft, setDraft] = useState<HostRecord>(emptyRecord)
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const { status, report: showError, clearError } = usePageFeedback('Hosts 操作失败')
  const { isPending, run } = useAsyncAction(showError)
  const load = useCallback((): void => {
    const loadRecords = async (): Promise<void> => {
      try {
        const [managed, system] = await Promise.all([
          window.api!.hosts.list(),
          window.api!.hosts.listSystem()
        ])
        setRecords(managed)
        setSystemRecords(system)
      } catch (error) {
        showError(error)
      } finally {
        setLoading(false)
      }
    }
    void loadRecords()
  }, [showError])
  useInitialLoad(load)

  const refresh = async (): Promise<void> => {
    const value = await run('hosts-refresh', () => window.api!.hosts.list(), {
      success: 'Hosts 记录已重新读取'
    })
    if (value) setRecords(value)
  }
  const save = async (valueToSave: HostRecord = draft): Promise<void> => {
    if (!valueToSave.ip || !valueToSave.domain) {
      showError('请填写 IP 地址和域名')
      return
    }
    const next = valueToSave.id
      ? records.map((item) => (item.id === valueToSave.id ? valueToSave : item))
      : [...records, { ...valueToSave, id: crypto.randomUUID() }]
    const value = await run('hosts-save', async () => {
      const saved = await window.api?.hosts.save(next)
      if (!saved) throw new Error('当前页面未连接桌面服务，无法保存 Hosts。')
      return saved
    })
    if (value) {
      setRecords(value)
      setDraft(emptyRecord)
      setDrawerOpen(false)
      clearError()
      toast.success('Hosts 记录已保存')
    }
  }
  const saveRecords = async (next: HostRecord[], success?: string): Promise<boolean> => {
    const value = await run(
      'hosts-save',
      async () => {
        const saved = await window.api?.hosts.save(next)
        if (!saved) throw new Error('当前页面未连接桌面服务，无法更新 Hosts。')
        return saved
      },
      success ? { success } : undefined
    )
    if (!value) return false
    setRecords(value)
    return true
  }
  const remove = async (record: HostRecord): Promise<void> => {
    await saveRecords(
      records.filter((item) => item.id !== record.id),
      'Hosts 记录已删除'
    )
  }
  const toggleEnabled = async (record: HostRecord): Promise<void> => {
    await saveRecords(
      records.map((item) => (item.id === record.id ? { ...item, enabled: !item.enabled } : item)),
      '记录状态已更新'
    )
  }
  const importSystemRecords = async (): Promise<void> => {
    const saved = await saveRecords([...records, ...systemRecords], '系统 Hosts 记录已导入')
    if (saved) setSystemRecords([])
  }
  const filtered = useMemo(() => {
    const keyword = query.toLowerCase()
    return records.filter((record) =>
      `${record.ip} ${record.domain} ${record.remark}`.toLowerCase().includes(keyword)
    )
  }, [records, query])

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <HostsToolbar
        systemRecordCount={systemRecords.length}
        onImportSystem={importSystemRecords}
        onCreate={() => {
          setDraft(emptyRecord)
          setDrawerOpen(true)
        }}
        onQueryChange={setQuery}
        onRefresh={() => void refresh()}
        onRestore={() => {
          void run('hosts-restore', async () => {
            const value = await window.api?.hosts.restoreBackup()
            if (!value) throw new Error('当前页面未连接桌面服务，无法恢复 Hosts 备份。')
            setRecords(value)
            toast.success('已恢复 Hosts 备份')
          })
        }}
        pending={{
          refresh: isPending('hosts-refresh'),
          restore: isPending('hosts-restore')
        }}
        query={query}
      >
        <HostsTable
          onEdit={(record) => {
            setDraft(record)
            setDrawerOpen(true)
          }}
          onRemove={remove}
          onToggle={toggleEnabled}
          query={query}
          records={filtered}
          saving={isPending('hosts-save')}
        />
      </HostsToolbar>
      <HostEditorDrawer
        draft={draft}
        key={`${drawerOpen}-${draft.id}`}
        onClose={() => setDrawerOpen(false)}
        onSave={(value) => void save(value)}
        open={drawerOpen}
        saving={isPending('hosts-save')}
        status={status}
      />
    </div>
  )
}
