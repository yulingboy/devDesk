import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, KeyRound, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react'
import type { SSHKey, SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { rendererLogger } from '@/lib/logger'
import { Drawer } from '@/components/ui/drawer'
import { ConfirmAction } from '@/components/ConfirmAction'
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

const emptyDraft: SSHKeyDraft = { name: '', publicKey: '', source: 'manual' }

export function SshPage(): React.JSX.Element {
  const [keys, setKeys] = useState<SSHKey[]>([])
  const [draft, setDraft] = useState<SSHKeyDraft>(emptyDraft)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [generateOptions, setGenerateOptions] = useState<SSHKeyGenerateOptions>({
    name: 'id_ed25519_env_tool',
    algorithm: 'ed25519',
    comment: '',
    passphrase: ''
  })
  const [drawerMode, setDrawerMode] = useState<'generate' | 'manual' | 'edit' | null>(null)
  const [loading, setLoading] = useState(true)

  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    toast.error(message)
    rendererLogger.error('SSH 操作失败', { error: message })
  }
  const load = (): void => {
    void window.api?.ssh
      .list()
      .then(setKeys)
      .catch(report)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])
  const filtered = useMemo(
    () =>
      keys.filter((key) =>
        `${key.name} ${key.fingerprint} ${key.publicKey}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [keys, query]
  )
  const save = (): void => {
    void window.api?.ssh
      .save(draft)
      .then((value) => {
        setKeys(value)
        setDraft(emptyDraft)
        setDrawerMode(null)
        setStatus('')
        toast.success('SSH 公钥已保存')
      })
      .catch(report)
  }
  const generate = (): void => {
    void window.api?.ssh
      .generate(generateOptions)
      .then((value) => {
        setKeys(value)
        setDrawerMode(null)
        toast.success('SSH 密钥已生成，私钥仅保留在系统路径中')
      })
      .catch(report)
  }

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <Card>
        <CardHeader className="flex-row items-start justify-between border-b border-slate-100">
          <div>
            <CardTitle>SSH 密钥</CardTitle>
            <CardDescription>只读取和保存公钥、指纹与私钥路径，不会保存私钥内容。</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => {
                setDraft(emptyDraft)
                setDrawerMode('manual')
              }}
              variant="secondary"
            >
              <Plus size={14} />
              录入公钥
            </Button>
            <Button onClick={() => setDrawerMode('generate')} variant="success">
              <Sparkles size={14} />
              生成密钥
            </Button>
            <TooltipButton onClick={load} size="icon" tooltip="重新发现本机公钥" variant="ghost">
              <RefreshCw size={15} />
            </TooltipButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、指纹或公钥"
            value={query}
          />
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
                    description={`将删除密钥元数据“${key.name}”，关联的 Git 身份会解除绑定；磁盘上的密钥文件不会删除。`}
                    onConfirm={() =>
                      void window.api?.ssh.remove(key.id).then(setKeys).catch(report)
                    }
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
        </CardContent>
      </Card>
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
            <Button onClick={drawerMode === 'generate' ? generate : save} variant="success">
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
            <div className="space-y-2">
              <Label htmlFor="key-name">名称</Label>
              <Input
                id="key-name"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                value={draft.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-value">公钥</Label>
              <Textarea
                id="key-value"
                onChange={(event) => setDraft({ ...draft, publicKey: event.target.value })}
                placeholder="ssh-ed25519 AAAA..."
                value={draft.publicKey}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert variant="warning">
              <AlertDescription>
                不设置口令会降低私钥安全性，重要密钥建议配置口令。
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="generate-name">文件名</Label>
              <Input
                id="generate-name"
                onChange={(event) =>
                  setGenerateOptions({ ...generateOptions, name: event.target.value })
                }
                value={generateOptions.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-algorithm">算法</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-comment">注释</Label>
              <Input
                id="generate-comment"
                onChange={(event) =>
                  setGenerateOptions({ ...generateOptions, comment: event.target.value })
                }
                placeholder="邮箱或用途"
                value={generateOptions.comment}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-passphrase">口令（可选）</Label>
              <Input
                id="generate-passphrase"
                onChange={(event) =>
                  setGenerateOptions({ ...generateOptions, passphrase: event.target.value })
                }
                type="password"
                value={generateOptions.passphrase}
              />
            </div>
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
