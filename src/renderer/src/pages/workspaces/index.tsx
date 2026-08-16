import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import type {
  GitIdentity,
  Project,
  ProjectDetail,
  ProjectTemplate,
  Workspace,
  WorkspaceScanResult
} from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { rendererLogger } from '@/lib/logger'
import { Drawer } from '@/components/ui/drawer'
import { DirectoryPickerInput } from '@/components/DirectoryPickerInput'
import { ProjectCreateDrawer } from '@/components/ProjectCreateDrawer'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { Tabs } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ProjectGrid } from './components/ProjectGrid'
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { WorkspaceToolbar } from './components/WorkspaceToolbar'

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
  const [scanningWorkspaceId, setScanningWorkspaceId] = useState<string>()
  const [scanResults, setScanResults] = useState<Record<string, WorkspaceScanResult>>({})
  const [activeProjectTab, setActiveProjectTab] = useState('all')
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null)
  const [projectDetailLoading, setProjectDetailLoading] = useState(false)
  const [projectAction, setProjectAction] = useState<'refresh' | 'install' | 'script' | 'remove'>()
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
  const scan = async (id: string): Promise<void> => {
    if (scanningWorkspaceId) return
    setScanningWorkspaceId(id)
    try {
      const result = await window.api?.workspaces.scanDetailed(id)
      if (!result) throw new Error('当前页面未连接桌面服务，无法扫描工作区。')
      setWorkspaces(result.workspaces)
      setScanResults((current) => ({ ...current, [id]: result }))
      toast.success(
        `项目扫描完成：新增 ${result.added}，移除 ${result.removed}${result.gitErrorCount ? `，${result.gitErrorCount} 个 Git 状态异常` : ''}`
      )
      if (result.truncated) toast.warning('目录超过 500 个，已按扫描上限展示')
    } catch (error) {
      report(error)
    } finally {
      setScanningWorkspaceId(undefined)
    }
  }
  const applyProjectDetail = (detail: ProjectDetail): void => {
    setProjectDetail(detail)
    setWorkspaces((current) =>
      current.map((workspace) =>
        workspace.id === detail.project.workspaceId
          ? {
              ...workspace,
              projects: workspace.projects.map((project) =>
                project.id === detail.project.id ? { ...project, ...detail.project } : project
              )
            }
          : workspace
      )
    )
  }
  const openProjectDetail = async (project: Project): Promise<void> => {
    setProjectDetailLoading(true)
    setProjectDetail(null)
    try {
      const detail = await window.api?.workspaces.getProjectDetail(project.workspaceId, project.id)
      if (!detail) throw new Error('当前页面未连接桌面服务，无法读取项目详情。')
      applyProjectDetail(detail)
    } catch (error) {
      report(error)
    } finally {
      setProjectDetailLoading(false)
    }
  }
  const refreshProjectDetail = async (): Promise<void> => {
    if (!projectDetail || projectAction) return
    setProjectAction('refresh')
    try {
      const detail = await window.api?.workspaces.refreshProject(
        projectDetail.project.workspaceId,
        projectDetail.project.id
      )
      if (!detail) throw new Error('当前页面未连接桌面服务，无法刷新项目。')
      applyProjectDetail(detail)
      toast.success('项目状态已刷新')
    } catch (error) {
      report(error)
    } finally {
      setProjectAction(undefined)
    }
  }
  const installDependencies = async (): Promise<void> => {
    if (!projectDetail || projectAction) return
    setProjectAction('install')
    try {
      const detail = await window.api?.workspaces.installDependencies(
        projectDetail.project.workspaceId,
        projectDetail.project.id
      )
      if (!detail) throw new Error('当前页面未连接桌面服务，无法安装依赖。')
      applyProjectDetail(detail)
      toast.success('项目依赖已安装')
    } catch (error) {
      report(error)
    } finally {
      setProjectAction(undefined)
    }
  }
  const runProjectScript = async (script: string): Promise<void> => {
    if (!projectDetail || projectAction) return
    setProjectAction('script')
    try {
      await window.api?.workspaces.runScript(
        projectDetail.project.workspaceId,
        projectDetail.project.id,
        script
      )
      toast.success(`已在 Terminal 中启动 ${script} 脚本`)
    } catch (error) {
      report(error)
    } finally {
      setProjectAction(undefined)
    }
  }
  const addProject = async (workspace: Workspace): Promise<void> => {
    if (projectAction) return
    try {
      const path = await window.api?.dialog.selectDirectory(workspace.rootPath)
      if (!path) return
      const next = await window.api?.workspaces.addProject(workspace.id, path)
      if (!next) throw new Error('当前页面未连接桌面服务，无法纳入项目。')
      setWorkspaces(next)
      toast.success('项目已纳入当前工作区')
    } catch (error) {
      report(error)
    }
  }
  const removeProject = async (): Promise<void> => {
    if (!projectDetail || projectAction) return
    setProjectAction('remove')
    try {
      const next = await window.api?.workspaces.removeProject(
        projectDetail.project.workspaceId,
        projectDetail.project.id
      )
      if (!next) throw new Error('当前页面未连接桌面服务，无法移除项目。')
      setWorkspaces(next)
      setProjectDetail(null)
      toast.success('项目已从工作区移除')
    } catch (error) {
      report(error)
    } finally {
      setProjectAction(undefined)
    }
  }
  const selectedWorkspace =
    workspaces.find((item) => item.id === selectedWorkspaceId) ?? workspaces[0]
  const visibleWorkspace = useMemo(
    () =>
      selectedWorkspace
        ? {
            ...selectedWorkspace,
            projects: selectedWorkspace.projects.filter((project) =>
              `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase())
            )
          }
        : undefined,
    [query, selectedWorkspace]
  )
  const scanResult = selectedWorkspace ? scanResults[selectedWorkspace.id] : undefined
  const selectedIdentity = identities.find(
    (identity) => identity.id === selectedWorkspace?.gitIdentityId
  )
  const attentionProjects = visibleWorkspace?.projects.filter(needsAttention) ?? []
  const readyProjects =
    visibleWorkspace?.projects.filter(
      (project) =>
        project.directoryExists !== false &&
        project.dependencyState === 'ready' &&
        !project.gitError
    ) ?? []
  const deleteWorkspace = async (workspace: Workspace): Promise<void> => {
    if (scanningWorkspaceId) return
    try {
      const next = await window.api?.workspaces.remove(workspace.id)
      if (!next) throw new Error('当前页面未连接桌面服务，无法删除工作区。')
      setWorkspaces(next)
      setSelectedWorkspaceId((current) => (current === workspace.id ? next[0]?.id : current))
      setScanResults((current) => {
        const nextResults = { ...current }
        delete nextResults[workspace.id]
        return nextResults
      })
      toast.success('工作区已删除')
    } catch (error) {
      report(error)
    }
  }
  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      <WorkspaceSidebar
        collapsed={sidebarCollapsed}
        onCreate={() => {
          setDraft(emptyWorkspace)
          setDrawerMode('workspace')
        }}
        onSelect={setSelectedWorkspaceId}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        selectedId={selectedWorkspace?.id}
        workspaces={workspaces}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {visibleWorkspace ? (
          <>
            <WorkspaceToolbar
              identityName={selectedIdentity?.name}
              onAddProject={() => void addProject(visibleWorkspace)}
              onCreateProject={() => {
                setCreateWorkspaceId(visibleWorkspace.id)
                setDrawerMode('project')
              }}
              onDelete={() => deleteWorkspace(visibleWorkspace)}
              onEdit={() => {
                setDraft(visibleWorkspace)
                setDrawerMode('workspace')
              }}
              onOpen={() => void window.api?.workspaces.open(visibleWorkspace.id).catch(report)}
              onQueryChange={setQuery}
              onRefresh={load}
              onScan={() => void scan(visibleWorkspace.id)}
              query={query}
              scanResult={scanResult}
              scanning={scanningWorkspaceId === visibleWorkspace.id}
              templatesAvailable={templates.length > 0}
              workspace={visibleWorkspace}
            />
            <Tabs
              className="min-h-0 flex-1 gap-0 bg-white [&_[role=tablist]]:shrink-0 [&_[role=tablist]]:px-5 [&_[role=tabpanel]]:overflow-auto"
              fill
              items={[
                {
                  value: 'all',
                  label: `全部 ${visibleWorkspace.projects.length}`,
                  content: (
                    <ProjectGrid
                      onOpen={(project) => void openProjectDetail(project)}
                      onOpenEditor={(path) =>
                        void window.api?.workspaces.openProjectEditor(path).catch(report)
                      }
                      onOpenFolder={(path) =>
                        void window.api?.workspaces.openProject(path).catch(report)
                      }
                      projects={visibleWorkspace.projects}
                      query={query}
                      rootPath={visibleWorkspace.rootPath}
                      scanning={scanningWorkspaceId === visibleWorkspace.id}
                    />
                  )
                },
                {
                  value: 'attention',
                  label: `需处理 ${attentionProjects.length}`,
                  content: (
                    <ProjectGrid
                      onOpen={(project) => void openProjectDetail(project)}
                      onOpenEditor={(path) =>
                        void window.api?.workspaces.openProjectEditor(path).catch(report)
                      }
                      onOpenFolder={(path) =>
                        void window.api?.workspaces.openProject(path).catch(report)
                      }
                      projects={attentionProjects}
                      query={query}
                      rootPath={visibleWorkspace.rootPath}
                      scanning={scanningWorkspaceId === visibleWorkspace.id}
                    />
                  )
                },
                {
                  value: 'ready',
                  label: `已就绪 ${readyProjects.length}`,
                  content: (
                    <ProjectGrid
                      onOpen={(project) => void openProjectDetail(project)}
                      onOpenEditor={(path) =>
                        void window.api?.workspaces.openProjectEditor(path).catch(report)
                      }
                      onOpenFolder={(path) =>
                        void window.api?.workspaces.openProject(path).catch(report)
                      }
                      projects={readyProjects}
                      query={query}
                      rootPath={visibleWorkspace.rootPath}
                      scanning={scanningWorkspaceId === visibleWorkspace.id}
                    />
                  )
                }
              ]}
              onValueChange={setActiveProjectTab}
              value={activeProjectTab}
            />
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <ProjectGrid
              onOpen={() => undefined}
              onOpenEditor={() => undefined}
              onOpenFolder={() => undefined}
              projects={[]}
              query={query}
              scanning={false}
            />
          </div>
        )}
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
        <ProjectDetailDrawer
          detail={projectDetail}
          loading={projectDetailLoading}
          onClose={() => {
            if (!projectAction) setProjectDetail(null)
          }}
          onInstallDependencies={() => void installDependencies()}
          onRemove={removeProject}
          onOpenEditor={(path) => void window.api?.workspaces.openProjectEditor(path).catch(report)}
          onOpenFolder={(path) => void window.api?.workspaces.openProject(path).catch(report)}
          onRefresh={() => void refreshProjectDetail()}
          onRunScript={(script) => void runProjectScript(script)}
          open={projectDetailLoading || Boolean(projectDetail)}
          pendingAction={projectAction}
        />
      </div>
    </div>
  )
}

/** 项目缺目录、依赖未安装或 Git 状态不可读取时，归入“需处理”页签。 */
function needsAttention(project: Project): boolean {
  return (
    project.directoryExists === false ||
    Boolean(project.gitError) ||
    Boolean(project.hasPackageJson && project.dependencyState === 'missing')
  )
}
