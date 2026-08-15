import { useEffect, useState } from 'react'
import { Copy, GitBranch, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import type { GitFileSnapshot, GitIdentity, GitState, SSHKey } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rendererLogger } from '@/lib/logger'
import { PageHeader } from '@/components/PageHeader'
import { Drawer } from '@/components/ui/drawer'

const emptyIdentity: GitIdentity = { id: '', name: '', username: '', email: '' }

export function GitPage(): React.JSX.Element {
  const [state, setState] = useState<GitState | null>(null)
  const [keys, setKeys] = useState<SSHKey[]>([])
  const [global, setGlobal] = useState({ username: '', email: '' })
  const [identity, setIdentity] = useState<GitIdentity>(emptyIdentity)
  const [status, setStatus] = useState('')
  const [files, setFiles] = useState<GitFileSnapshot[]>([])
  const [drawerMode, setDrawerMode] = useState<'global' | 'identity' | null>(null)
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    rendererLogger.error('Git 操作失败', { error: message })
  }
  const load = (): void => {
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
  }
  useEffect(load, [])
  const saveGlobal = (): void => {
    void window.api?.git
      .saveGlobal(global)
      .then((value) => {
        setState(value)
        setDrawerMode(null)
        setStatus('全局 Git 配置已写入真实配置文件')
      })
      .catch(report)
  }
  const saveIdentity = (): void => {
    void window.api?.git
      .saveIdentity(identity)
      .then((value) => {
        setState(value)
        setIdentity(emptyIdentity)
        setDrawerMode(null)
        setStatus('Git 身份已保存并生成 profile')
      })
      .catch(report)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        extra={
          <Button
            onClick={() => {
              setIdentity(emptyIdentity)
              setDrawerMode('identity')
            }}
            variant="success"
          >
            <Plus size={15} />
            新增配置
          </Button>
        }
        title="Git 配置"
        subtitle="维护全局配置、项目身份和工作区规则"
      />
      <Card>
        <CardHeader>
          <CardTitle>全局 Git 配置</CardTitle>
          <CardDescription>来源文件：{state?.global.sourceFile ?? '读取中'}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{global.username || '未配置用户名'}</span>
            <span className="mx-2 text-slate-300">·</span>
            {global.email || '未配置邮箱'}
          </div>
          <Button onClick={() => setDrawerMode('global')} variant="secondary">
            <Pencil size={15} />
            编辑全局配置
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>真实配置文件</CardTitle>
          <CardDescription>
            只读展示全局配置、身份 profile 和工作区 includeIf 规则。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {files.map((file) => (
            <details className="rounded-md border border-slate-100 p-3" key={file.path}>
              <summary className="cursor-pointer text-sm font-medium">
                {file.name}
                <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                  {file.path}
                </span>
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                {file.exists ? file.content : '文件不存在，请保存配置后重试。'}
              </pre>
            </details>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>身份配置</CardTitle>
            <CardDescription>工作区可以绑定身份，后续用于生成 includeIf Git 规则。</CardDescription>
          </div>
          <Badge variant="secondary">{state?.identities.length ?? 0} 个身份</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {state?.identities.map((item) => (
            <div
              className="flex items-center gap-3 rounded-md border border-slate-100 p-3"
              key={item.id}
            >
              <GitBranch className="text-[var(--accent)]" size={18} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.username} · {item.email}
                </p>
              </div>
              <Button
                onClick={() => {
                  setIdentity(item)
                  setDrawerMode('identity')
                }}
                size="icon"
                title="编辑身份"
                variant="ghost"
              >
                <Pencil size={15} />
              </Button>
              <Button
                onClick={() => {
                  setIdentity({ ...item, id: '', name: `${item.name}-copy` })
                  setDrawerMode('identity')
                }}
                size="icon"
                title="复制身份"
                variant="ghost"
              >
                <Copy size={15} />
              </Button>
              <Button
                onClick={() => {
                  if (window.confirm(`删除身份“${item.name}”？`))
                    void window.api?.git.removeIdentity(item.id).then(setState).catch(report)
                }}
                size="icon"
                title="删除身份"
                variant="ghost"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          <p className="text-xs text-slate-500">{status}</p>
        </CardContent>
      </Card>
      <Drawer
        description={
          drawerMode === 'global'
            ? '此操作会直接修改当前用户的真实 Git 全局配置。'
            : '配置可绑定 SSH 密钥，并由工作区通过 includeIf 自动应用。'
        }
        footer={
          <>
            <Button onClick={() => setDrawerMode(null)} variant="secondary">
              取消
            </Button>
            <Button onClick={drawerMode === 'global' ? saveGlobal : saveIdentity} variant="success">
              <Save size={15} />
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode !== null}
        title={
          drawerMode === 'global'
            ? '编辑全局 Git 配置'
            : identity.id
              ? '编辑 Git 配置'
              : '新增 Git 配置'
        }
      >
        {drawerMode === 'global' ? (
          <div className="space-y-5">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              保存后会立即写入 {state?.global.sourceFile || '~/.gitconfig'}。
            </div>
            <div className="space-y-2">
              <Label htmlFor="global-name">用户名</Label>
              <Input
                id="global-name"
                onChange={(event) => setGlobal({ ...global, username: event.target.value })}
                value={global.username}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="global-email">邮箱</Label>
              <Input
                id="global-email"
                onChange={(event) => setGlobal({ ...global, email: event.target.value })}
                value={global.email}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identity-name">身份名称</Label>
              <Input
                id="identity-name"
                onChange={(event) => setIdentity({ ...identity, name: event.target.value })}
                value={identity.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identity-user">用户名</Label>
              <Input
                id="identity-user"
                onChange={(event) => setIdentity({ ...identity, username: event.target.value })}
                value={identity.username}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identity-email">邮箱</Label>
              <Input
                id="identity-email"
                onChange={(event) => setIdentity({ ...identity, email: event.target.value })}
                value={identity.email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identity-key">SSH 密钥</Label>
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                id="identity-key"
                onChange={(event) =>
                  setIdentity({ ...identity, sshKeyId: event.target.value || undefined })
                }
                value={identity.sshKeyId ?? ''}
              >
                <option value="">不绑定</option>
                {keys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name} · {key.fingerprint}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
