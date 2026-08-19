import { useCallback, useState } from 'react'
import type {
  GitFileSnapshot,
  GitIdentity,
  GitIdentityDetail,
  GitState,
  SSHKey
} from '@shared/domain'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useInitialLoad } from '@/hooks/useInitialLoad'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { GitConfigDrawer } from './components/GitConfigDrawer'
import { GitFilesPanel } from './components/GitFilesPanel'
import { GitGlobalPanel } from './components/GitGlobalPanel'
import { GitIdentityDetailDrawer } from './components/GitIdentityDetailDrawer'
import { GitIdentityList } from './components/GitIdentityList'

const emptyIdentity: GitIdentity = { id: '', name: '', username: '', email: '' }

/** Git 页面入口只组合配置面板、身份列表和两个抽屉。 */
export function GitPage(): React.JSX.Element {
  const [state, setState] = useState<GitState | null>(null)
  const [keys, setKeys] = useState<SSHKey[]>([])
  const [global, setGlobal] = useState({ username: '', email: '' })
  const [identity, setIdentity] = useState<GitIdentity>(emptyIdentity)
  const [files, setFiles] = useState<GitFileSnapshot[]>([])
  const [drawerMode, setDrawerMode] = useState<'global' | 'identity' | 'detail' | null>(null)
  const [detail, setDetail] = useState<GitIdentityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { status, report, clearError } = usePageFeedback('Git 操作失败')
  const { isPending, run } = useAsyncAction(report)
  const load = useCallback((): void => {
    void Promise.all([window.api?.git.getState(), window.api?.ssh.list(), window.api?.git.files()])
      .then(([gitState, sshKeys, fileValue]) => {
        if (gitState) {
          setState(gitState)
          setGlobal({ username: gitState.global.username, email: gitState.global.email })
        }
        if (sshKeys) setKeys(sshKeys)
        if (fileValue) setFiles(fileValue)
      })
      .catch(report)
      .finally(() => setLoading(false))
  }, [report])
  useInitialLoad(load)
  const saveGlobal = async (valueToSave = global): Promise<void> => {
    const value = await run(
      'git-save',
      async () => {
        const next = await window.api?.git.saveGlobal(valueToSave)
        if (!next) throw new Error('当前页面未连接桌面服务，无法保存 Git 配置。')
        return next
      },
      { success: '全局 Git 配置已写入真实配置文件' }
    )
    if (value) {
      setState(value)
      clearError()
      setDrawerMode(null)
    }
  }
  const saveIdentity = async (valueToSave = identity): Promise<void> => {
    const value = await run(
      'git-save',
      async () => {
        const next = await window.api?.git.saveIdentity(valueToSave)
        if (!next) throw new Error('当前页面未连接桌面服务，无法保存 Git 身份。')
        return next
      },
      { success: 'Git 身份已保存并生成 profile' }
    )
    if (value) {
      setState(value)
      setIdentity(emptyIdentity)
      clearError()
      setDrawerMode(null)
    }
  }
  const removeIdentity = async (item: GitIdentity): Promise<void> => {
    const value = await run(
      `git-remove:${item.id}`,
      () => window.api!.git.removeIdentity(item.id),
      { success: `Git 身份“${item.name}”已删除` }
    )
    if (value) setState(value)
  }
  const openDetail = (item: GitIdentity): void => {
    void run(`git-detail:${item.id}`, () => window.api!.git.getIdentityDetail(item.id)).then(
      (value) => {
        if (value) {
          setDetail(value)
          setDrawerMode('detail')
        }
      }
    )
  }
  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <div className="grid gap-2.5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <GitGlobalPanel
          email={global.email}
          onCreateIdentity={() => {
            setIdentity(emptyIdentity)
            setDrawerMode('identity')
          }}
          onEdit={() => setDrawerMode('global')}
          sourceFile={state?.global.sourceFile}
          username={global.username}
        />
        <GitFilesPanel files={files} />
      </div>
      <GitIdentityList
        identities={state?.identities ?? []}
        isPending={(key) => isPending(key)}
        onCopy={(item) => {
          setIdentity({ ...item, id: '', name: `${item.name}-copy` })
          setDrawerMode('identity')
        }}
        onDetail={openDetail}
        onEdit={(item) => {
          setIdentity(item)
          setDrawerMode('identity')
        }}
        onRemove={removeIdentity}
        status={status}
      />
      <GitConfigDrawer
        global={global}
        identity={identity}
        key={`${drawerMode}-${identity.id}`}
        keys={keys}
        mode={drawerMode === 'global' || drawerMode === 'identity' ? drawerMode : null}
        onClose={() => setDrawerMode(null)}
        onSaveGlobal={(value) => void saveGlobal(value)}
        onSaveIdentity={(value) => void saveIdentity(value)}
        saving={isPending('git-save')}
        state={state}
      />
      <GitIdentityDetailDrawer
        detail={detail}
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'detail'}
      />
    </div>
  )
}
