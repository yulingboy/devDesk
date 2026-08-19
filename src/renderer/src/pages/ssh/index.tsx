import { useCallback, useMemo, useState } from 'react'
import type { SSHKey, SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useInitialLoad } from '@/hooks/useInitialLoad'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { SshKeyDrawer } from './components/SshKeyDrawer'
import { SshKeyList } from './components/SshKeyList'
import { SshToolbar } from './components/SshToolbar'

const emptyDraft: SSHKeyDraft = { name: '', publicKey: '', source: 'manual' }

/** SSH 页面入口只负责资源状态和组件间的业务协调。 */
export function SshPage(): React.JSX.Element {
  const [keys, setKeys] = useState<SSHKey[]>([])
  const [draft, setDraft] = useState<SSHKeyDraft>(emptyDraft)
  const [query, setQuery] = useState('')
  const [drawerMode, setDrawerMode] = useState<'generate' | 'manual' | 'edit' | null>(null)
  const [loading, setLoading] = useState(true)
  const { status, report, clearError } = usePageFeedback('SSH 操作失败')
  const { isPending, run } = useAsyncAction(report)
  const load = useCallback((): void => {
    void window.api?.ssh
      .list()
      .then(setKeys)
      .catch(report)
      .finally(() => setLoading(false))
  }, [report])
  useInitialLoad(load)
  const filtered = useMemo(() => {
    const keyword = query.toLowerCase()
    return keys.filter((key) =>
      `${key.name} ${key.fingerprint} ${key.publicKey}`.toLowerCase().includes(keyword)
    )
  }, [keys, query])
  const refresh = async (): Promise<void> => {
    const value = await run('ssh-refresh', () => window.api!.ssh.list(), {
      success: 'SSH 密钥已重新读取'
    })
    if (value) setKeys(value)
  }
  const save = async (valueToSave: SSHKeyDraft = draft): Promise<void> => {
    const value = await run('ssh-save', () => window.api!.ssh.save(valueToSave), {
      success: 'SSH 公钥已保存'
    })
    if (value) {
      setKeys(value)
      setDraft(emptyDraft)
      setDrawerMode(null)
      clearError()
    }
  }
  const generate = async (options: SSHKeyGenerateOptions): Promise<void> => {
    const value = await run('ssh-save', () => window.api!.ssh.generate(options), {
      success: 'SSH 密钥已生成，私钥仅保留在系统路径中'
    })
    if (value) {
      setKeys(value)
      setDrawerMode(null)
      clearError()
    }
  }
  const remove = async (key: SSHKey): Promise<void> => {
    const value = await run(`ssh-remove:${key.id}`, () => window.api!.ssh.remove(key.id), {
      success: `SSH 密钥“${key.name}”已删除`
    })
    if (value) setKeys(value)
  }
  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <SshToolbar
        onGenerate={() => setDrawerMode('generate')}
        onManual={() => {
          setDraft(emptyDraft)
          setDrawerMode('manual')
        }}
        onQueryChange={setQuery}
        onRefresh={() => void refresh()}
        query={query}
        refreshing={isPending('ssh-refresh')}
      >
        <SshKeyList
          keys={filtered}
          onDelete={remove}
          onEdit={(key) => {
            setDraft({
              id: key.id,
              name: key.name,
              publicKey: key.publicKey,
              privateKeyPath: key.privateKeyPath,
              source: key.source
            })
            setDrawerMode('edit')
          }}
          query={query}
        />
      </SshToolbar>
      <SshKeyDrawer
        draft={draft}
        key={`${drawerMode}-${draft.id}`}
        mode={drawerMode}
        onClose={() => setDrawerMode(null)}
        onGenerate={(options) => void generate(options)}
        onSave={(value) => void save(value)}
        saving={isPending('ssh-save')}
        status={status}
      />
    </div>
  )
}
