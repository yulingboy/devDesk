import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, KeyRound, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react'
import type { SSHDeleteImpact, SSHKey, SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/form'
import { Drawer } from '@/components/ui/drawer'
import { ConfirmAction } from '@/components/ConfirmAction'
import { SearchInput } from '@/components/SearchInput'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { TooltipButton } from '@/components/TooltipButton'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ResourcePanel } from '@/components/ResourcePanel'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { useInitialLoad } from '@/hooks/useInitialLoad'
import { useAsyncAction } from '@/hooks/useAsyncAction'

const emptyDraft: SSHKeyDraft = { name: '', publicKey: '', source: 'manual' }

export function SshPage(): React.JSX.Element {
  const [keys, setKeys] = useState<SSHKey[]>([])
  const [draft, setDraft] = useState<SSHKeyDraft>(emptyDraft)
  const [query, setQuery] = useState('')
  const [generateOptions, setGenerateOptions] = useState<SSHKeyGenerateOptions>({
    name: 'id_ed25519_devdesk',
    algorithm: 'ed25519',
    comment: '',
    passphrase: ''
  })
  const [drawerMode, setDrawerMode] = useState<'generate' | 'manual' | 'edit' | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteImpact, setDeleteImpact] = useState<SSHDeleteImpact | null>(null)

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
  const filtered = useMemo(
    () =>
      keys.filter((key) =>
        `${key.name} ${key.fingerprint} ${key.publicKey}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [keys, query]
  )
  const refresh = async (): Promise<void> => {
    const value = await run('ssh-refresh', () => window.api!.ssh.list(), {
      success: 'SSH 密钥已重新读取'
    })
    if (value) setKeys(value)
  }
  const save = async (): Promise<void> => {
    const value = await run('ssh-save', () => window.api!.ssh.save(draft), {
      success: 'SSH 公钥已保存'
    })
    if (value) {
      setKeys(value)
      setDraft(emptyDraft)
      setDrawerMode(null)
      clearError()
    }
  }
  const generate = async (): Promise<void> => {
    const value = await run('ssh-save', () => window.api!.ssh.generate(generateOptions), {
      success: 'SSH 密钥已生成，私钥仅保留在系统路径中'
    })
    if (value) {
      setKeys(value)
      setDrawerMode(null)
      clearError()
    }
  }

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <ResourcePanel
        actions={
          <div className="flex items-center gap-1">
            <Button
              onClick={() => {
                setDraft(emptyDraft)
                setDrawerMode('manual')
              }}
              size="sm"
              variant="secondary"
            >
              <Plus size={14} />
              录入公钥
            </Button>
            <Button onClick={() => setDrawerMode('generate')} size="sm" variant="success">
              <Sparkles size={14} />
              生成密钥
            </Button>
            <Button
              loading={isPending('ssh-refresh')}
              onClick={() => void refresh()}
              size="sm"
              variant="outline"
            >
              <RefreshCw size={15} />
              刷新
            </Button>
          </div>
        }
        contentClassName="space-y-4 pt-5"
        description="只读取和保存公钥、指纹与私钥路径，不会保存私钥内容。"
        headerClassName="border-b border-slate-100"
        title="SSH 密钥"
      >
        <SearchInput onValueChange={setQuery} placeholder="搜索名称、指纹或公钥" value={query} />
        <div className="space-y-2">
          {filtered.map((key) => (
            <Item key={key.id}>
              <ItemMedia>
                <KeyRound />
              </ItemMedia>
              <ItemContent>
                <div className="flex items-center gap-2">
                  <ItemTitle>{key.name}</ItemTitle>
                  <Badge variant="secondary">{key.algorithm}</Badge>
                  {key.privateKeyPath && (
                    <Badge variant={key.privateKeyExists ? 'success' : 'outline'}>
                      {key.privateKeyExists ? '私钥可用' : '私钥缺失'}
                    </Badge>
                  )}
                </div>
                <ItemDescription className="font-mono">{key.fingerprint}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <TooltipButton
                  onClick={() => {
                    setDraft({
                      id: key.id,
                      name: key.name,
                      publicKey: key.publicKey,
                      privateKeyPath: key.privateKeyPath,
                      source: key.source
                    })
                    setDrawerMode('edit')
                  }}
                  size="icon"
                  tooltip="编辑公钥"
                  variant="ghost"
                >
                  <Pencil size={15} />
                </TooltipButton>
                <TooltipButton
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(key.publicKey)
                      .then(() => toast.success('公钥已复制'))
                  }
                  size="icon"
                  tooltip="复制公钥"
                  variant="ghost"
                >
                  <Copy size={15} />
                </TooltipButton>
                <ConfirmAction
                  description={
                    deleteImpact?.key.id === key.id ? (
                      <span>
                        将删除密钥元数据“{key.name}”，磁盘上的密钥文件不会删除。{' '}
                        {deleteImpact.identities.length
                          ? `会解除 ${deleteImpact.identities.map((item) => item.name).join('、')} 的绑定。`
                          : '当前没有 Git 身份绑定此密钥。'}
                      </span>
                    ) : (
                      `正在读取密钥“${key.name}”的关联影响。`
                    )
                  }
                  onConfirm={async () => {
                    const value = await run(
                      `ssh-remove:${key.id}`,
                      () => window.api!.ssh.remove(key.id),
                      { success: `SSH 密钥“${key.name}”已删除` }
                    )
                    if (value) setKeys(value)
                  }}
                  onOpenChange={(open) => {
                    if (open)
                      void window.api?.ssh
                        .getDeleteImpact(key.id)
                        .then(setDeleteImpact)
                        .catch(report)
                  }}
                  title="删除 SSH 密钥元数据？"
                  triggerTooltip="删除密钥"
                >
                  <Button aria-label="删除密钥" size="icon" variant="ghost">
                    <Trash2 size={15} />
                  </Button>
                </ConfirmAction>
              </ItemActions>
            </Item>
          ))}
          {!filtered.length && (
            <Empty>
              <EmptyTitle>{query ? '没有匹配的 SSH 密钥' : '尚未发现 SSH 公钥'}</EmptyTitle>
              <EmptyDescription>
                {query
                  ? '尝试修改搜索条件，或清空搜索框查看全部密钥。'
                  : '可手动录入已有公钥，或直接生成新密钥。'}
              </EmptyDescription>
            </Empty>
          )}
        </div>
      </ResourcePanel>
      <Drawer
        description={
          drawerMode === 'generate'
            ? '调用本机 ssh-keygen，私钥内容不会进入应用存储。'
            : '名称必须唯一，系统会自动计算算法和指纹。'
        }
        footer={
          <>
            <Button onClick={() => setDrawerMode(null)} variant="secondary">
              取消
            </Button>
            <Button
              loading={isPending('ssh-save')}
              loadingText={drawerMode === 'generate' ? '生成中' : '保存中'}
              onClick={() => void (drawerMode === 'generate' ? generate() : save())}
              variant="success"
            >
              <Save size={15} />
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode !== null}
        title={
          drawerMode === 'generate'
            ? '新增 SSH 密钥（自动生成）'
            : drawerMode === 'edit'
              ? '编辑 SSH 公钥'
              : '录入 SSH 公钥'
        }
      >
        {drawerMode !== 'generate' ? (
          <div className="space-y-3">
            <Field htmlFor="key-name" label="名称">
              <Input
                id="key-name"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                value={draft.name}
              />
            </Field>
            <Field htmlFor="key-value" label="公钥">
              <Textarea
                id="key-value"
                onChange={(event) => setDraft({ ...draft, publicKey: event.target.value })}
                placeholder="ssh-ed25519 AAAA..."
                value={draft.publicKey}
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert variant="warning">
              <AlertDescription>
                不设置口令会降低私钥安全性，重要密钥建议配置口令。
              </AlertDescription>
            </Alert>
            <Field htmlFor="generate-name" label="文件名">
              <Input
                id="generate-name"
                onChange={(event) =>
                  setGenerateOptions({ ...generateOptions, name: event.target.value })
                }
                value={generateOptions.name}
              />
            </Field>
            <Field htmlFor="generate-algorithm" label="算法">
              <Select
                value={generateOptions.algorithm}
                onValueChange={(value) =>
                  setGenerateOptions({
                    ...generateOptions,
                    algorithm: value as SSHKeyGenerateOptions['algorithm']
                  })
                }
              >
                <SelectTrigger id="generate-algorithm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ed25519">ed25519</SelectItem>
                  <SelectItem value="rsa">RSA 4096</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field htmlFor="generate-comment" label="注释">
              <Input
                id="generate-comment"
                onChange={(event) =>
                  setGenerateOptions({ ...generateOptions, comment: event.target.value })
                }
                placeholder="邮箱或用途"
                value={generateOptions.comment}
              />
            </Field>
            <Field htmlFor="generate-passphrase" label="口令（可选）">
              <Input
                id="generate-passphrase"
                onChange={(event) =>
                  setGenerateOptions({ ...generateOptions, passphrase: event.target.value })
                }
                type="password"
                value={generateOptions.passphrase}
              />
            </Field>
            {status && (
              <Alert variant="destructive">
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
