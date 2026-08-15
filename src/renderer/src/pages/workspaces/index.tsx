import { useEffect, useMemo, useState } from 'react'
import {
  Code2,
  FolderKanban,
  FolderOpen,
  Pencil,
  Plus,
  RefreshCw,
  ScanSearch,
  Save,
  Rocket,
  Trash2
} from 'lucide-react'
import type { GitIdentity, ProjectTemplate, Workspace } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { rendererLogger } from '@/lib/logger'
import { PageHeader } from '@/components/PageHeader'
import { Drawer } from '@/components/ui/drawer'
import { DirectoryPickerInput } from '@/components/DirectoryPickerInput'
import { ProjectCreateDrawer } from '@/components/ProjectCreateDrawer'

const emptyWorkspace: Workspace = { id: '', name: '', rootPath: '', description: '', projects: [] }

export function WorkspacesPage(): React.JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [draft, setDraft] = useState<Workspace>(emptyWorkspace)
  const [identities, setIdentities] = useState<GitIdentity[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [drawerMode, setDrawerMode] = useState<'workspace' | 'project' | null>(null)
  const [createWorkspaceId, setCreateWorkspaceId] = useState<string>()
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    rendererLogger.error('工作区操作失败', { error: message })
  }
  const load = (): void => {
    void Promise.all([
      window.api?.workspaces.list(),
      window.api?.git.getState(),
      window.api?.templates.list()
    ])
      .then(([workspaceValue, gitState, templateValue]) => {
        if (workspaceValue) setWorkspaces(workspaceValue)
        if (gitState) setIdentities(gitState.identities)
        if (templateValue) setTemplates(templateValue)
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
        setDrawerMode(null)
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
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        extra={
          <Button
            onClick={() => {
              setDraft(emptyWorkspace)
              setDrawerMode('workspace')
            }}
            variant="success"
          >
            <Plus size={15} />
            新增工作区
          </Button>
        }
        title="工作区"
        subtitle="管理项目根目录、Git 身份和仓库状态"
      />
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
            <div className="rounded-md border border-slate-100 p-4" key={workspace.id}>
              <div className="flex items-start gap-3">
                <div className="grid size-9 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)]">
                  <FolderKanban size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{workspace.name}</p>
                  <p className="truncate text-xs text-slate-500">{workspace.rootPath}</p>
                  <p className="mt-1 text-xs text-slate-400">{workspace.projects.length} 个项目</p>
                </div>
                <Button
                  onClick={() => {
                    setDraft(workspace)
                    setDrawerMode('workspace')
                  }}
                  size="icon"
                  title="编辑工作区"
                  variant="ghost"
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  onClick={() => {
                    if (!templates.length) {
                      setStatus('暂无可用模板，请先到“项目模板”页新增模板')
                      return
                    }
                    setCreateWorkspaceId(workspace.id)
                    setDrawerMode('project')
                  }}
                  size="icon"
                  title={templates.length ? '从模板创建项目' : '请先新增项目模板'}
                  variant="ghost"
                >
                  <Rocket size={15} />
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
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-2">
                  {workspace.projects.map((project) => (
                    <div
                      className="flex items-center gap-1 rounded-md border border-slate-100 bg-white p-1"
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
                          <span className="ml-2 text-slate-400">
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
            <p className="py-8 text-center text-sm text-slate-400">
              暂无工作区，请先添加一个项目根目录。
            </p>
          )}
        </CardContent>
      </Card>
      <Drawer
        description="名称和规范化根目录不能与现有工作区重复，保存后会同步 Git 规则。"
        footer={
          <>
            <Button onClick={() => setDrawerMode(null)} variant="secondary">
              取消
            </Button>
            <Button onClick={save} variant="success">
              <Save size={15} />
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'workspace'}
        title={draft.id ? '编辑工作区' : '新增工作区'}
      >
        <div className="space-y-5">
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
            <DirectoryPickerInput
              onChange={(rootPath) => setDraft({ ...draft, rootPath })}
              placeholder="输入或选择项目根目录"
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
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
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
          <p className="text-xs text-slate-500">{status}</p>
        </div>
      </Drawer>
      <ProjectCreateDrawer
        defaultWorkspaceId={createWorkspaceId}
        onClose={() => setDrawerMode(null)}
        onCreated={(value) => {
          setWorkspaces(value)
          setStatus('项目创建成功')
        }}
        onError={report}
        open={drawerMode === 'project'}
        templates={templates}
        workspaces={workspaces}
      />
    </div>
  )
}
