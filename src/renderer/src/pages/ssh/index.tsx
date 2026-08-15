import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react'
import type { SSHKey, SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { rendererLogger } from '@/lib/logger'
import { PageHeader } from '@/components/PageHeader'
import { Drawer } from '@/components/ui/drawer'

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

  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    rendererLogger.error('SSH 操作失败', { error: message })
  }
  const load = (): void => {
    void window.api?.ssh.list().then(setKeys).catch(report)
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
        setStatus('SSH 公钥已保存')
      })
      .catch(report)
  }
  const generate = (): void => {
    void window.api?.ssh
      .generate(generateOptions)
      .then((value) => {
        setKeys(value)
        setDrawerMode(null)
        setStatus('SSH 密钥已生成，私钥仅保留在系统路径中')
      })
      .catch(report)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        extra={
          <>
            <Button
              onClick={() => {
                setDraft(emptyDraft)
                setDrawerMode('manual')
              }}
              variant="secondary"
            >
              <Plus size={15} />
              录入公钥
            </Button>
            <Button onClick={() => setDrawerMode('generate')} variant="success">
              <Sparkles size={15} />
              生成密钥
            </Button>
          </>
        }
        title="SSH 密钥"
        subtitle="发现、录入和生成本机 SSH 公钥"
      />
      <Card>
        <CardHeader className="flex-row items-start justify-between border-b border-slate-100">
          <div>
            <CardTitle>SSH 密钥</CardTitle>
            <CardDescription>只读取和保存公钥、指纹与私钥路径，不会保存私钥内容。</CardDescription>
          </div>
          <Button onClick={load} size="icon" title="重新发现本机公钥" variant="ghost">
            <RefreshCw size={16} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、指纹或公钥"
            value={query}
          />
          <div className="space-y-2">
            {filtered.map((key) => (
              <div
                className="flex items-center gap-3 rounded-md border border-slate-100 p-3"
                key={key.id}
              >
                <div className="grid size-9 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)]">
                  <KeyRound size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{key.name}</p>
                    <Badge variant="secondary">{key.algorithm}</Badge>
                    {key.privateKeyPath && (
                      <Badge variant={key.privateKeyExists ? 'success' : 'outline'}>
                        {key.privateKeyExists ? '私钥可用' : '私钥缺失'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">
                    {key.fingerprint}
                  </p>
                </div>
                <Button
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
                  title="编辑公钥"
                  variant="ghost"
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(key.publicKey)
                      .then(() => setStatus('公钥已复制'))
                  }
                  size="icon"
                  title="复制公钥"
                  variant="ghost"
                >
                  <Copy size={15} />
                </Button>
                <Button
                  onClick={() => {
                    if (window.confirm(`删除密钥元数据“${key.name}”？关联 Git 身份会解除绑定。`))
                      void window.api?.ssh.remove(key.id).then(setKeys).catch(report)
                  }}
                  size="icon"
                  title="删除密钥"
                  variant="ghost"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            {!filtered.length && (
              <p className="py-8 text-center text-sm text-slate-400">
                未发现 SSH 公钥，可手动录入或生成新密钥。
              </p>
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
          <div className="space-y-5">
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
          <div className="space-y-5">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              不设置口令会降低私钥安全性，重要密钥建议配置口令。
            </div>
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
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                id="generate-algorithm"
                onChange={(event) =>
                  setGenerateOptions({
                    ...generateOptions,
                    algorithm: event.target.value as SSHKeyGenerateOptions['algorithm']
                  })
                }
                value={generateOptions.algorithm}
              >
                <option value="ed25519">ed25519</option>
                <option value="rsa">RSA 4096</option>
              </select>
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
            <p className="text-xs text-slate-500">{status}</p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
