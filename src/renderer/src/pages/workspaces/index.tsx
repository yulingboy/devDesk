import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FolderKanban, Plus, Save } from 'lucide-react'
import type {
  ProjectEditorId,
  Project,
  Workspace,
  WorkspaceSubproject,
  WorkspaceScanResult
} from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Drawer } from '@/components/ui/drawer'
import { DirectoryPickerInput } from '@/components/DirectoryPickerInput'
import { ProjectCreateDrawer } from '@/components/ProjectCreateDrawer'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ProjectGrid } from './components/ProjectGrid'
import { ProjectDetailDrawer } from './components/ProjectDetailDrawer'
import { ProjectRemarkDrawer } from './components/ProjectRemarkDrawer'
import { WorkspaceToolbar } from './components/WorkspaceToolbar'
import { WorkspaceDetailDrawer } from './components/WorkspaceDetailDrawer'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { useWorkspaceResources } from './hooks/useWorkspaceResources'

const emptyWorkspace: Workspace = { id: '', name: '', rootPath: '', description: '', projects: [] }

export function WorkspacesPage(): React.JSX.Element {
  const [draft, setDraft] = useState<Workspace>(emptyWorkspace)
  const [query, setQuery] = useState('')
  const [drawerMode, setDrawerMode] = useState<'workspace' | 'workspace-detail' | 'project' | null>(
    null
  )
  const [createWorkspaceId, setCreateWorkspaceId] = useState<string>()
  const [createParentProjectId, setCreateParentProjectId] = useState<string>()
  const [removingProject, setRemovingProject] = useState(false)
  const [scanningWorkspaceId, setScanningWorkspaceId] = useState<string>()
  const [scanResults, setScanResults] = useState<Record<string, WorkspaceScanResult>>({})
  const [remarkDraft, setRemarkDraft] = useState<{
    workspaceId: string
    projectId: string
    projectName: string
    remark: string
  }>()
  const [savingRemark, setSavingRemark] = useState(false)
  const deepLinkHandled = useRef(false)
  const { status, report, clearError } = usePageFeedback('工作区操作失败')
  const {
    workspaces,
    setWorkspaces,
    identities,
    sshKeys,
    templates,
    loading,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedProjectId,
    setSelectedProjectId,
    reload: load
  } = useWorkspaceResources(report)
  useEffect(() => {
    if (!workspaces.length || deepLinkHandled.current) return
    deepLinkHandled.current = true
    const queryIndex = window.location.hash.indexOf('?')
    const params = new URLSearchParams(
      queryIndex >= 0 ? window.location.hash.slice(queryIndex + 1) : ''
    )
    const linkedWorkspace = workspaces.find((item) => item.id === params.get('workspace'))
    const linkedProject = linkedWorkspace?.projects.find(
      (item) => item.id === params.get('project')
    )
    if (!linkedWorkspace) return
    const timer = window.setTimeout(() => {
      setSelectedWorkspaceId(linkedWorkspace.id)
      if (linkedProject) setSelectedProjectId(linkedProject.id)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [setSelectedProjectId, setSelectedWorkspaceId, workspaces])
  const save = (): void => {
    void window.api?.workspaces
      .save(draft)
      .then((value) => {
        setWorkspaces(value)
        setDraft(emptyWorkspace)
        setDrawerMode(null)
        clearError()
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
      toast.success(`一级项目扫描完成：新增 ${result.added}，移除 ${result.removed}`)
      if (result.truncated) toast.warning('目录数量超过扫描上限，已展示可安全读取的部分')
    } catch (error) {
      report(error)
    } finally {
      setScanningWorkspaceId(undefined)
    }
  }
  const addProject = async (workspace: Workspace): Promise<void> => {
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
  const selectedWorkspace =
    workspaces.find((item) => item.id === selectedWorkspaceId) ?? workspaces[0]
  const editProjectRemark = (project: Project): void => {
    if (!selectedWorkspace) return
    setSelectedProjectId(undefined)
    setRemarkDraft({
      workspaceId: selectedWorkspace.id,
      projectId: project.id,
      projectName: project.name,
      remark: project.remark ?? ''
    })
  }
  const editSubprojectRemark = (subproject: WorkspaceSubproject): void => {
    if (!selectedWorkspace) return
    setSelectedProjectId(undefined)
    setRemarkDraft({
      workspaceId: selectedWorkspace.id,
      projectId: subproject.id,
      projectName: subproject.name,
      remark: subproject.remark ?? ''
    })
  }
  const saveProjectRemark = async (): Promise<void> => {
    if (!remarkDraft || savingRemark) return
    setSavingRemark(true)
    try {
      const next = await window.api?.workspaces.saveProjectRemark(
        remarkDraft.workspaceId,
        remarkDraft.projectId,
        remarkDraft.remark
      )
      if (!next) throw new Error('当前页面未连接桌面服务，无法保存项目备注。')
      setWorkspaces(next)
      setRemarkDraft(undefined)
      toast.success('项目备注已保存')
    } catch (error) {
      report(error)
    } finally {
      setSavingRemark(false)
    }
  }
  const visibleWorkspace = useMemo(
    () =>
      selectedWorkspace
        ? {
            ...selectedWorkspace,
            projects: selectedWorkspace.projects.filter((project) => {
              const subprojectText = project.subprojects
                ?.map((item) => `${item.name} ${item.path}`)
                .join(' ')
              return `${project.name} ${project.remark ?? ''} ${project.path} ${subprojectText ?? ''}`
                .toLowerCase()
                .includes(query.toLowerCase())
            })
          }
        : undefined,
    [query, selectedWorkspace]
  )
  const scanResult = selectedWorkspace ? scanResults[selectedWorkspace.id] : undefined
  const selectedIdentity = identities.find(
    (identity) => identity.id === selectedWorkspace?.gitIdentityId
  )
  const selectedSshKey = sshKeys.find((key) => key.id === selectedIdentity?.sshKeyId)
  const selectedProject = selectedWorkspace?.projects.find(
    (project) => project.id === selectedProjectId
  )
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
  const removeProject = async (): Promise<void> => {
    if (!selectedWorkspace || !selectedProject || removingProject) return
    setRemovingProject(true)
    try {
      const next = await window.api?.workspaces.removeProject(
        selectedWorkspace.id,
        selectedProject.id
      )
      if (!next) throw new Error('当前页面未连接桌面服务，无法移除项目。')
      setWorkspaces(next)
      setSelectedProjectId(undefined)
      toast.success('项目已从工作区移除')
    } catch (error) {
      report(error)
    } finally {
      setRemovingProject(false)
    }
  }
  if (loading) return <PageLoadingSkeleton />
  const createWorkspace = (): void => {
    setDraft(emptyWorkspace)
    setDrawerMode('workspace')
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50 p-3">
      {visibleWorkspace ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <WorkspaceToolbar
            onAddProject={() => void addProject(visibleWorkspace)}
            onCreateProject={() => {
              setCreateWorkspaceId(visibleWorkspace.id)
              setCreateParentProjectId(undefined)
              setDrawerMode('project')
            }}
            onCreateWorkspace={createWorkspace}
            onDelete={() => deleteWorkspace(visibleWorkspace)}
            onEdit={() => {
              setDraft(visibleWorkspace)
              setDrawerMode('workspace')
            }}
            onOpen={() => void window.api?.workspaces.open(visibleWorkspace.id).catch(report)}
            onQueryChange={setQuery}
            onRefresh={load}
            onScan={() => void scan(visibleWorkspace.id)}
            onSelectWorkspace={(id) => {
              setSelectedWorkspaceId(id)
              setSelectedProjectId(undefined)
              setQuery('')
            }}
            onViewDetails={() => setDrawerMode('workspace-detail')}
            query={query}
            scanResult={scanResult}
            scanning={scanningWorkspaceId === visibleWorkspace.id}
            templatesAvailable={templates.length > 0}
            workspace={visibleWorkspace}
            workspaces={workspaces}
          />
          <div className="flex min-h-0 flex-1 px-3 pb-3 pt-2">
            <ProjectGrid
              onEditRemark={editProjectRemark}
              onOpen={(project) => setSelectedProjectId(project.id)}
              onOpenEditor={(path, editor: ProjectEditorId) =>
                void window.api?.workspaces.openProjectEditor(path, editor).catch(report)
              }
              onOpenFolder={(path) => void window.api?.workspaces.openProject(path).catch(report)}
              projects={visibleWorkspace.projects}
              query={query}
              scanning={scanningWorkspaceId === visibleWorkspace.id}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <FolderKanban size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">工作区</p>
                <p className="mt-0.5 text-[10px] text-slate-400">集中管理项目目录与 Git 身份</p>
              </div>
            </div>
            <Button onClick={createWorkspace} variant="success">
              <Plus />
              新增工作区
            </Button>
          </div>
          <Empty className="min-h-0 flex-1 rounded-none border-0 bg-white">
            <EmptyTitle>还没有工作区</EmptyTitle>
            <EmptyDescription>新增一个项目根目录，即可扫描其中的一级项目。</EmptyDescription>
            <Button className="mt-3" onClick={createWorkspace} variant="outline">
              <Plus />
              新增工作区
            </Button>
          </Empty>
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
          <Field htmlFor="workspace-name" label="名称">
            <Input
              id="workspace-name"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              value={draft.name}
            />
          </Field>
          <Field htmlFor="workspace-root" label="根目录">
            <DirectoryPickerInput
              id="workspace-root"
              onChange={(rootPath) => setDraft({ ...draft, rootPath })}
              placeholder="输入或选择项目根目录"
              value={draft.rootPath}
            />
          </Field>
          <Field className="md:col-span-2" htmlFor="workspace-description" label="描述">
            <Textarea
              id="workspace-description"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              value={draft.description}
            />
          </Field>
          <Field className="md:col-span-2" htmlFor="workspace-identity" label="Git 身份">
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
          </Field>
          {status && (
            <Alert variant="destructive">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
        </div>
      </Drawer>
      <WorkspaceDetailDrawer
        identity={selectedIdentity}
        onClose={() => setDrawerMode(null)}
        onEdit={() => {
          if (!selectedWorkspace) return
          setDraft(selectedWorkspace)
          setDrawerMode('workspace')
        }}
        onOpenFolder={() => {
          if (!selectedWorkspace) return
          void window.api?.workspaces.open(selectedWorkspace.id).catch(report)
        }}
        open={drawerMode === 'workspace-detail'}
        sshKey={selectedSshKey}
        workspace={selectedWorkspace}
      />
      <ProjectCreateDrawer
        defaultParentProjectId={createParentProjectId}
        defaultWorkspaceId={createWorkspaceId}
        onClose={() => {
          setDrawerMode(null)
          setCreateParentProjectId(undefined)
        }}
        onCreated={(value) => {
          setWorkspaces(value)
          toast.success(createParentProjectId ? '子项目创建成功' : '项目创建成功')
        }}
        onError={report}
        open={drawerMode === 'project'}
        templates={templates}
        workspaces={workspaces}
      />
      <ProjectDetailDrawer
        identity={selectedIdentity}
        onClose={() => !removingProject && setSelectedProjectId(undefined)}
        onCreateSubproject={(project) => {
          setSelectedProjectId(undefined)
          setCreateWorkspaceId(selectedWorkspace?.id)
          setCreateParentProjectId(project.id)
          setDrawerMode('project')
        }}
        onEditRemark={editProjectRemark}
        onEditSubprojectRemark={editSubprojectRemark}
        onRemove={removeProject}
        onOpenEditor={(path, editor: ProjectEditorId) =>
          void window.api?.workspaces.openProjectEditor(path, editor).catch(report)
        }
        onOpenFolder={(path) => void window.api?.workspaces.openProject(path).catch(report)}
        open={Boolean(selectedProject)}
        project={selectedProject}
        removing={removingProject}
        sshKey={selectedSshKey}
        workspace={selectedWorkspace}
      />
      <ProjectRemarkDrawer
        open={Boolean(remarkDraft)}
        onChange={(remark) =>
          setRemarkDraft((current) => (current ? { ...current, remark } : current))
        }
        onClose={() => !savingRemark && setRemarkDraft(undefined)}
        onSave={() => void saveProjectRemark()}
        projectName={remarkDraft?.projectName ?? ''}
        saving={savingRemark}
        value={remarkDraft?.remark ?? ''}
      />
    </div>
  )
}
