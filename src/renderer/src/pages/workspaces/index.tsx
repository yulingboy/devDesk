import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Code2,
  FolderKanban,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
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
import { Drawer } from '@/components/ui/drawer'
import { DirectoryPickerInput } from '@/components/DirectoryPickerInput'
import { ProjectCreateDrawer } from '@/components/ProjectCreateDrawer'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { TooltipButton } from '@/components/TooltipButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent } from '@/components/ui/item'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

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
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>()
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    toast.error(message)
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
        if (workspaceValue) setSelectedWorkspaceId((current) => current ?? workspaceValue[0]?.id)
        if (gitState) setIdentities(gitState.identities)
        if (templateValue) setTemplates(templateValue)
      })
      .catch(report)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])
  const save = (): void => {
    void window.api?.workspaces
      .save(draft)
      .then((value) => {
        setWorkspaces(value)
        setDraft(emptyWorkspace)
        setDrawerMode(null)
        setStatus('')
        toast.success('工作区已保存')
      })
      .catch(report)
  }
  const scan = (id: string): void => {
    void window.api?.workspaces
      .scanDetailed(id)
      .then((result) => {
        setWorkspaces(result.workspaces)
        toast.success(
          `项目扫描完成：新增 ${result.added}，移除 ${result.removed}${result.gitErrorCount ? `，${result.gitErrorCount} 个 Git 状态异常` : ''}`
        )
        if (result.truncated) toast.warning('目录超过 500 个，已按扫描上限展示')
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

  const selectedWorkspace = filtered.find((item) => item.id === selectedWorkspaceId) ?? filtered[0]
  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="flex h-full min-h-0 gap-2.5 p-3">
      <aside
        className={`shrink-0 border-r border-slate-200 pr-2 ${sidebarCollapsed ? 'w-10' : 'w-52'}`}
      >
        <div className="mb-2 flex items-center justify-between">
          {!sidebarCollapsed && <span className="text-xs font-medium text-slate-600">工作区</span>}
          <TooltipButton
            onClick={() => setSidebarCollapsed((value) => !value)}
            size="icon"
            tooltip={sidebarCollapsed ? '展开工作区列表' : '收起工作区列表'}
            variant="ghost"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </TooltipButton>
        </div>
        {!sidebarCollapsed && (
          <div className="space-y-1">
            {workspaces.map((workspace) => (
              <Button
                className="w-full justify-start truncate"
                key={workspace.id}
                onClick={() => setSelectedWorkspaceId(workspace.id)}
                size="sm"
                variant={selectedWorkspaceId === workspace.id ? 'secondary' : 'ghost'}
              >
                <FolderKanban size={14} />
                <span className="truncate">{workspace.name}</span>
              </Button>
            ))}
          </div>
        )}
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>工作区</CardTitle>
              <CardDescription>只扫描根目录第一层非隐藏目录，最多导入 500 个项目。</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={() => {
                  setDraft(emptyWorkspace)
                  setDrawerMode('workspace')
                }}
                variant="success"
              >
                <Plus size={14} />
                新增工作区
              </Button>
              <TooltipButton onClick={load} size="icon" tooltip="刷新工作区" variant="ghost">
                <RefreshCw size={15} />
              </TooltipButton>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索工作区、项目或路径"
              value={query}
            />
            {(selectedWorkspace ? [selectedWorkspace] : []).map((workspace) => (
              <div className="rounded-md border border-slate-100 p-4" key={workspace.id}>
                <div className="flex items-start gap-3">
                  <div className="grid size-9 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)]">
                    <FolderKanban size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{workspace.name}</p>
                    <p className="truncate text-xs text-slate-500">{workspace.rootPath}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {workspace.projects.length} 个项目
                    </p>
                  </div>
                  <DropdownMenu>
                    <Tooltip>
                      <DropdownMenuTrigger asChild>
                        <TooltipTrigger asChild>
                          <Button aria-label="工作区操作" size="icon" variant="ghost">
                            <MoreHorizontal size={15} />
                          </Button>
                        </TooltipTrigger>
                      </DropdownMenuTrigger>
                      <TooltipContent>工作区操作</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setDraft(workspace)
                          setDrawerMode('workspace')
                        }}
                      >
                        <Pencil size={14} />
                        编辑工作区
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          if (!templates.length) {
                            toast.warning('暂无可用模板，请先到“项目模板”页新增模板')
                            return
                          }
                          setCreateWorkspaceId(workspace.id)
                          setDrawerMode('project')
                        }}
                      >
                        <Rocket size={14} />
                        从模板创建项目
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          void window.api?.workspaces.open(workspace.id).catch(report)
                        }
                      >
                        <FolderOpen size={14} />
                        打开目录
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => scan(workspace.id)}>
                        <ScanSearch size={14} />
                        扫描项目
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ConfirmAction
                    description={`删除工作区“${workspace.name}”会同时移除应用内项目记录和 Git 路径规则，不会删除磁盘目录。`}
                    onConfirm={() =>
                      void window.api?.workspaces
                        .remove(workspace.id)
                        .then(setWorkspaces)
                        .catch(report)
                    }
                    title="删除工作区？"
                    triggerTooltip="删除工作区"
                  >
                    <Button aria-label="删除工作区" size="icon" variant="ghost">
                      <Trash2 size={15} />
                    </Button>
                  </ConfirmAction>
                </div>
                {workspace.projects.length > 0 && (
                  <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-2">
                    {workspace.projects.map((project) => (
                      <Item className="gap-1.5 bg-white p-1" key={project.id}>
                        <ItemContent>
                          <Button
                            className="h-auto w-full justify-start truncate px-2 py-1 text-left text-xs"
                            onClick={() =>
                              void window.api?.workspaces.openProject(project.path).catch(report)
                            }
                            variant="ghost"
                          >
                            <span className="truncate font-medium text-slate-800">
                              {project.name}
                              <span className="ml-2 font-normal text-slate-400">
                                {project.branch ?? '非 Git 项目'}
                              </span>
                            </span>
                          </Button>
                        </ItemContent>
                        <ItemActions>
                          {project.gitError ? (
                            <Badge variant="outline">状态未知</Badge>
                          ) : (
                            <Badge variant={project.dirty ? 'secondary' : 'success'}>
                              {project.dirty ? '有改动' : '干净'}
                            </Badge>
                          )}
                          <TooltipButton
                            onClick={() =>
                              void window.api?.workspaces
                                .openProjectEditor(project.path)
                                .catch(report)
                            }
                            size="icon"
                            tooltip="在 VS Code 中打开"
                            variant="ghost"
                          >
                            <Code2 size={14} />
                          </TooltipButton>
                        </ItemActions>
                      </Item>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!filtered.length && (
              <Empty>
                <EmptyTitle>{query ? '没有匹配的工作区或项目' : '尚未添加工作区'}</EmptyTitle>
                <EmptyDescription>
                  {query
                    ? '尝试修改搜索条件，或清空搜索框查看全部工作区。'
                    : '添加项目根目录后，可以扫描和管理其中的项目。'}
                </EmptyDescription>
              </Empty>
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
          <div className="space-y-3">
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
              <Select
                value={draft.gitIdentityId ?? 'none'}
                onValueChange={(value) =>
                  setDraft({ ...draft, gitIdentityId: value === 'none' ? undefined : value })
                }
              >
                <SelectTrigger id="workspace-identity">
                  <SelectValue placeholder="不绑定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不绑定</SelectItem>
                  {identities.map((identity) => (
                    <SelectItem key={identity.id} value={identity.id}>
                      {identity.name} · {identity.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status && (
              <Alert variant="destructive">
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            )}
          </div>
        </Drawer>
        <ProjectCreateDrawer
          defaultWorkspaceId={createWorkspaceId}
          onClose={() => setDrawerMode(null)}
          onCreated={(value) => {
            setWorkspaces(value)
            toast.success('项目创建成功')
          }}
          onError={report}
          open={drawerMode === 'project'}
          templates={templates}
          workspaces={workspaces}
        />
      </div>
    </div>
  )
}
