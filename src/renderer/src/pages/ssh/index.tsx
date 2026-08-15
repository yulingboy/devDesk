import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import type { SSHKey, SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { rendererLogger } from '@/lib/logger'

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
        setStatus('SSH 公钥已保存')
      })
      .catch(report)
  }
  const generate = (): void => {
    void window.api?.ssh
      .generate(generateOptions)
      .then((value) => {
        setKeys(value)
        setStatus('SSH 密钥已生成，私钥仅保留在系统路径中')
      })
      .catch(report)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-8 py-8">
      <Card>
        <CardHeader className="flex-row items-start justify-between border-b border-[#e7e8e9]">
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
                className="flex items-center gap-3 rounded-md border border-[#e7e8e9] p-3"
                key={key.id}
              >
                <div className="grid size-9 place-items-center rounded-md bg-[#edf8f3] text-[#1f845a]">
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
                  <p className="mt-1 truncate font-mono text-xs text-[#777b80]">
                    {key.fingerprint}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    setDraft({
                      id: key.id,
                      name: key.name,
                      publicKey: key.publicKey,
                      privateKeyPath: key.privateKeyPath,
                      source: key.source
                    })
                  }
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
              <p className="py-8 text-center text-sm text-[#85878a]">
                未发现 SSH 公钥，可手动录入或生成新密钥。
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{draft.id ? '编辑公钥' : '录入公钥'}</CardTitle>
            <CardDescription>名称必须唯一，系统会自动计算算法和指纹。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <Button onClick={save} variant="success">
              <Plus size={15} />
              {draft.id ? '更新公钥' : '保存公钥'}
            </Button>
            {draft.id && (
              <Button onClick={() => setDraft(emptyDraft)} variant="ghost">
                取消编辑
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>生成密钥</CardTitle>
            <CardDescription>
              支持 ed25519 和 4096 位 RSA，私钥写入本机 ~/.ssh 目录。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                className="h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm"
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
            <Button onClick={generate} variant="secondary">
              <Sparkles size={15} />
              生成 {generateOptions.algorithm === 'rsa' ? 'RSA 4096' : 'ed25519'} 密钥
            </Button>
            <p className="text-xs text-[#777b80]">{status}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
