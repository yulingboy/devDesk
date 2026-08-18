import { useCallback, useState } from 'react'
import { Copy, FileText, GitBranch, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import type {
  GitFileSnapshot,
  GitIdentity,
  GitIdentityDetail,
  GitState,
  SSHKey
} from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/form'
import { Drawer } from '@/components/ui/drawer'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { TooltipButton } from '@/components/common/TooltipButton'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { useInitialLoad } from '@/hooks/useInitialLoad'
import { useAsyncAction } from '@/hooks/useAsyncAction'

const emptyIdentity: GitIdentity = { id: '', name: '', username: '', email: '' }

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
  const saveGlobal = async (): Promise<void> => {
    const value = await run(
      'git-save',
      async () => {
        const next = await window.api?.git.saveGlobal(global)
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
  const saveIdentity = async (): Promise<void> => {
    const value = await run(
      'git-save',
      async () => {
        const next = await window.api?.git.saveIdentity(identity)
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

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <div className="grid gap-2.5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <CardTitle>全局 Git 配置</CardTitle>
            <div className="flex items-center gap-2">
              <CardDescription>来源文件：{state?.global.sourceFile ?? '读取中'}</CardDescription>
              <Button
                onClick={() => {
                  setIdentity(emptyIdentity)
                  setDrawerMode('identity')
                }}
                variant="success"
              >
                <Plus size={14} /> 新增配置
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                {global.username || '未配置用户名'}
              </span>
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
            <Accordion className="space-y-2" type="multiple">
              {files.map((file) => (
                <AccordionItem key={file.path} value={file.path}>
                  <AccordionTrigger>
                    <span>
                      {file.name}
                      <span className="ml-2 font-mono text-[11px] font-normal text-slate-500">
                        {file.path}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="max-h-52 rounded-md bg-slate-50">
                      <pre className="whitespace-pre-wrap p-2.5 text-[11px] text-slate-600">
                        {file.exists ? file.content : '文件不存在，请保存配置后重试。'}
                      </pre>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
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
            <Item key={item.id}>
              <ItemMedia>
                <GitBranch />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{item.name}</ItemTitle>
                <ItemDescription>
                  {item.username} · {item.email}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <TooltipButton
                  loading={isPending(`git-detail:${item.id}`)}
                  onClick={() =>
                    void run(`git-detail:${item.id}`, () =>
                      window.api!.git.getIdentityDetail(item.id)
                    ).then((value) => {
                      if (!value) return
                      setDetail(value)
                      setDrawerMode('detail')
                    })
                  }
                  size="icon"
                  tooltip="查看身份详情"
                  variant="ghost"
                >
                  <FileText size={15} />
                </TooltipButton>
                <TooltipButton
                  onClick={() => {
                    setIdentity(item)
                    setDrawerMode('identity')
                  }}
                  size="icon"
                  tooltip="编辑身份"
                  variant="ghost"
                >
                  <Pencil size={15} />
                </TooltipButton>
                <TooltipButton
                  onClick={() => {
                    setIdentity({ ...item, id: '', name: `${item.name}-copy` })
                    setDrawerMode('identity')
                  }}
                  size="icon"
                  tooltip="复制身份"
                  variant="ghost"
                >
                  <Copy size={15} />
                </TooltipButton>
                <ConfirmAction
                  description={`删除身份“${item.name}”后将无法恢复；被工作区引用时操作会被拒绝。`}
                  onConfirm={async () => {
                    const value = await run(
                      `git-remove:${item.id}`,
                      () => window.api!.git.removeIdentity(item.id),
                      { success: `Git 身份“${item.name}”已删除` }
                    )
                    if (value) setState(value)
                  }}
                  title="删除 Git 身份？"
                  triggerTooltip="删除身份"
                >
                  <Button aria-label="删除身份" size="icon" variant="ghost">
                    <Trash2 size={15} />
                  </Button>
                </ConfirmAction>
              </ItemActions>
            </Item>
          ))}
          {status && (
            <Alert variant="destructive">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
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
            <Button
              loading={isPending('git-save')}
              loadingText="保存中"
              onClick={() => void (drawerMode === 'global' ? saveGlobal() : saveIdentity())}
              variant="success"
            >
              <Save size={15} />
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'global' || drawerMode === 'identity'}
        title={
          drawerMode === 'global'
            ? '编辑全局 Git 配置'
            : identity.id
              ? '编辑 Git 配置'
              : '新增 Git 配置'
        }
      >
        {drawerMode === 'global' ? (
          <div className="space-y-3">
            <Alert variant="warning">
              <AlertDescription>
                保存后会立即写入 {state?.global.sourceFile || '~/.gitconfig'}。
              </AlertDescription>
            </Alert>
            <Field htmlFor="global-name" label="用户名">
              <Input
                id="global-name"
                onChange={(event) => setGlobal({ ...global, username: event.target.value })}
                value={global.username}
              />
            </Field>
            <Field htmlFor="global-email" label="邮箱">
              <Input
                id="global-email"
                onChange={(event) => setGlobal({ ...global, email: event.target.value })}
                value={global.email}
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field htmlFor="identity-name" label="身份名称">
              <Input
                id="identity-name"
                onChange={(event) => setIdentity({ ...identity, name: event.target.value })}
                value={identity.name}
              />
            </Field>
            <Field htmlFor="identity-user" label="用户名">
              <Input
                id="identity-user"
                onChange={(event) => setIdentity({ ...identity, username: event.target.value })}
                value={identity.username}
              />
            </Field>
            <Field htmlFor="identity-email" label="邮箱">
              <Input
                id="identity-email"
                onChange={(event) => setIdentity({ ...identity, email: event.target.value })}
                value={identity.email}
              />
            </Field>
            <Field htmlFor="identity-key" label="SSH 密钥">
              <Select
                onValueChange={(value) =>
                  setIdentity({ ...identity, sshKeyId: value === 'none' ? undefined : value })
                }
                value={identity.sshKeyId ?? 'none'}
              >
                <SelectTrigger id="identity-key">
                  <SelectValue placeholder="不绑定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不绑定</SelectItem>
                  {keys.map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      {key.name} · {key.fingerprint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </Drawer>
      <Drawer
        description="由当前 Git 身份、SSH 密钥和工作区规则实时汇总，只读展示。"
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'detail'}
        title={`身份详情${detail ? `：${detail.identity.name}` : ''}`}
      >
        {detail && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <p className="font-medium text-slate-700">Git 身份</p>
              <p>
                {detail.identity.username} · {detail.identity.email}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-700">SSH 密钥</p>
              <p>
                {detail.sshKey ? `${detail.sshKey.name} · ${detail.sshKey.fingerprint}` : '未绑定'}
              </p>
              {detail.sshKey && (
                <p className="text-slate-500">
                  私钥：{detail.sshKey.privateKeyExists ? '可用' : '未找到'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-700">Profile 路径</p>
              <p className="break-all font-mono text-[11px] text-slate-500">{detail.profilePath}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-700">关联工作区</p>
              {detail.workspaces.length ? (
                detail.workspaces.map((workspace) => (
                  <p key={workspace.id}>
                    {workspace.name} ·{' '}
                    <span className="font-mono text-[11px] text-slate-500">
                      {workspace.rootPath}
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-slate-500">尚无关联工作区</p>
              )}
            </div>
            <Accordion className="space-y-2" type="multiple">
              {detail.files.map((file) => (
                <AccordionItem key={file.path} value={file.path}>
                  <AccordionTrigger>{file.name}</AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="max-h-52 rounded-md bg-slate-50">
                      <pre className="whitespace-pre-wrap p-2.5 text-[11px] text-slate-600">
                        {file.exists ? file.content : '文件不存在'}
                      </pre>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </Drawer>
    </div>
  )
}
