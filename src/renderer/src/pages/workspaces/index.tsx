import { useEffect, useMemo, useState } from 'react'
import {
  Code2,
  FolderKanban,
  FolderOpen,
  Pencil,
  RefreshCw,
  ScanSearch,
  Save,
  Trash2
} from 'lucide-react'
import type { GitIdentity, Workspace } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { rendererLogger } from '@/lib/logger'

const emptyWorkspace: Workspace = { id: '', name: '', rootPath: '', description: '', projects: [] }

export function WorkspacesPage(): React.JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [draft, setDraft] = useState<Workspace>(emptyWorkspace)
  const [identities, setIdentities] = useState<GitIdentity[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    rendererLogger.error('工作区操作失败', { error: message })
  }
  const load = (): void => {
    void Promise.all([window.api?.workspaces.list(), window.api?.git.getState()])
      .then(([workspaceValue, gitState]) => {
        if (workspaceValue) setWorkspaces(workspaceValue)
        if (gitState) setIdentities(gitState.identities)
      })
      .catch(report)
  }
  useEffect(load, [])
  const save = (): void => {
    void window.api?.workspaces
      .save(draft)
      .then((value) => {
        setWorkspaces(value)
        setDraft(emptyWorkspace)
        setStatus('工作区已保存')
      })
      .catch(report)
  }
  const scan = (id: string): void => {
    void window.api?.workspaces
      .scan(id)
      .then((value) => {
        setWorkspaces(value)
        setStatus('项目扫描完成')
      })
      .catch(report)
  }
  const filtered = useMemo(
    () =>
      workspaces
        .map((workspace) => ({
          ...workspace,
          projects: workspace.projects.filter((project) =>
            `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase())
          )
        }))
        .filter((workspace) =>
          query
            ? `${workspace.name} ${workspace.rootPath}`
                .toLowerCase()
                .includes(query.toLowerCase()) || workspace.projects.length > 0
            : true
        ),
    [query, workspaces]
  )

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-8 py-8">
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>工作区</CardTitle>
            <CardDescription>只扫描根目录第一层非隐藏目录，最多导入 500 个项目。</CardDescription>
          </div>
          <Button onClick={load} size="icon" title="刷新工作区" variant="ghost">
            <RefreshCw size={16} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索工作区、项目或路径"
            value={query}
          />
          {filtered.map((workspace) => (
            <div className="rounded-md border border-[#e7e8e9] p-4" key={workspace.id}>
              <div className="flex items-start gap-3">
                <div className="grid size-9 place-items-center rounded-md bg-[#edf8f3] text-[#1f845a]">
                  <FolderKanban size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{workspace.name}</p>
                  <p className="truncate text-xs text-[#777b80]">{workspace.rootPath}</p>
                  <p className="mt-1 text-xs text-[#85878a]">{workspace.projects.length} 个项目</p>
                </div>
                <Button
                  onClick={() => setDraft(workspace)}
                  size="icon"
                  title="编辑工作区"
                  variant="ghost"
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  onClick={() => void window.api?.workspaces.open(workspace.id).catch(report)}
                  size="icon"
                  title="打开目录"
                  variant="ghost"
                >
                  <FolderOpen size={15} />
                </Button>
                <Button
                  onClick={() => scan(workspace.id)}
                  size="icon"
                  title="扫描项目"
                  variant="ghost"
                >
                  <ScanSearch size={15} />
                </Button>
                <Button
                  onClick={() => {
                    if (window.confirm(`删除工作区“${workspace.name}”？项目记录也会被删除。`))
                      void window.api?.workspaces
                        .remove(workspace.id)
                        .then(setWorkspaces)
                        .catch(report)
                  }}
                  size="icon"
                  title="删除工作区"
                  variant="ghost"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
              {workspace.projects.length > 0 && (
                <div className="mt-3 grid gap-2 border-t border-[#eef0f1] pt-3 md:grid-cols-2">
                  {workspace.projects.map((project) => (
                    <div
                      className="flex items-center gap-1 rounded-md border border-[#e7e8e9] bg-white p-1"
                      key={project.id}
                    >
                      <button
                        className="min-w-0 flex-1 truncate px-2 py-1 text-left text-xs"
                        onClick={() =>
                          void window.api?.workspaces.openProject(project.path).catch(report)
                        }
                        type="button"
                      >
                        <span className="truncate">
                          <span className="font-medium">{project.name}</span>
                          <span className="ml-2 text-[#85878a]">
                            {project.branch ?? '非 Git 项目'}
                          </span>
                        </span>
                      </button>
                      {project.gitError ? (
                        <Badge variant="outline">状态未知</Badge>
                      ) : (
                        <Badge variant={project.dirty ? 'secondary' : 'success'}>
                          {project.dirty ? '有改动' : '干净'}
                        </Badge>
                      )}
                      <Button
                        onClick={() =>
                          void window.api?.workspaces.openProjectEditor(project.path).catch(report)
                        }
                        size="icon"
                        title="在 VS Code 中打开"
                        variant="ghost"
                      >
                        <Code2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!filtered.length && (
            <p className="py-8 text-center text-sm text-[#85878a]">
              暂无工作区，请先添加一个项目根目录。
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{draft.id ? '编辑工作区' : '添加工作区'}</CardTitle>
          <CardDescription>名称和规范化根目录不能与现有工作区重复。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">名称</Label>
            <Input
              id="workspace-name"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              value={draft.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-root">根目录</Label>
            <Input
              id="workspace-root"
              onChange={(event) => setDraft({ ...draft, rootPath: event.target.value })}
              placeholder="/Users/you/Code"
              value={draft.rootPath}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="workspace-description">描述</Label>
            <Textarea
              id="workspace-description"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              value={draft.description}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="workspace-identity">Git 身份</Label>
            <select
              className="h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm"
              id="workspace-identity"
              onChange={(event) =>
                setDraft({ ...draft, gitIdentityId: event.target.value || undefined })
              }
              value={draft.gitIdentityId ?? ''}
            >
              <option value="">不绑定</option>
              {identities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  {identity.name} · {identity.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Button onClick={save} variant="success">
              <Save size={15} />
              保存工作区
            </Button>
            {draft.id && (
              <Button onClick={() => setDraft(emptyWorkspace)} variant="ghost">
                取消编辑
              </Button>
            )}
          </div>
          <p className="text-xs text-[#777b80] md:col-span-2">{status}</p>
        </CardContent>
      </Card>
    </div>
  )
}
