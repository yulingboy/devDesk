import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Project, Workspace, WorkspaceSubproject, WorkspaceScanResult } from '@shared/domain'
import { ProjectCreateDrawer } from '@/components/project/ProjectCreateDrawer'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { ProjectGrid } from './components/ProjectGrid'
import { WorkspaceEditorDrawer } from './components/WorkspaceEditorDrawer'
import { WorkspaceEmptyState } from './components/WorkspaceEmptyState'
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
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
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
  const save = async (valueToSave: Workspace = draft): Promise<void> => {
    if (savingWorkspace) return
    setSavingWorkspace(true)
    try {
      const value = await window.api?.workspaces.save(valueToSave)
      if (!value) throw new Error('当前页面未连接桌面服务，无法保存工作区。')
      setWorkspaces(value)
      setDraft(emptyWorkspace)
      setDrawerMode(null)
      clearError()
      toast.success('工作区已保存')
    } catch (error) {
      report(error)
    } finally {
      setSavingWorkspace(false)
    }
  }
  const refresh = async (): Promise<void> => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await load()
      toast.success('工作区数据已刷新')
    } finally {
      setRefreshing(false)
    }
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
  const saveProjectRemark = async (remark = remarkDraft?.remark ?? ''): Promise<void> => {
    if (!remarkDraft || savingRemark) return
    setSavingRemark(true)
    try {
      const next = await window.api?.workspaces.saveProjectRemark(
        remarkDraft.workspaceId,
        remarkDraft.projectId,
        remark
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
            onQueryChange={setQuery}
            onRefresh={() => void refresh()}
            onScan={() => void scan(visibleWorkspace.id)}
            onSelectWorkspace={(id) => {
              setSelectedWorkspaceId(id)
              setSelectedProjectId(undefined)
              setQuery('')
            }}
            onViewDetails={() => setDrawerMode('workspace-detail')}
            query={query}
            refreshing={refreshing}
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
              projects={visibleWorkspace.projects}
              query={query}
              scanning={scanningWorkspaceId === visibleWorkspace.id}
            />
          </div>
        </div>
      ) : (
        <WorkspaceEmptyState onCreate={createWorkspace} />
      )}
      <WorkspaceEditorDrawer
        draft={draft}
        identities={identities}
        key={`${drawerMode}-${draft.id}`}
        onClose={() => setDrawerMode(null)}
        onSave={(value) => void save(value)}
        open={drawerMode === 'workspace'}
        saving={savingWorkspace}
        status={status}
      />
      <WorkspaceDetailDrawer
        identity={selectedIdentity}
        onClose={() => setDrawerMode(null)}
        onEdit={() => {
          if (!selectedWorkspace) return
          setDraft(selectedWorkspace)
          setDrawerMode('workspace')
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
        open={Boolean(selectedProject)}
        project={selectedProject}
        removing={removingProject}
        sshKey={selectedSshKey}
        workspace={selectedWorkspace}
      />
      <ProjectRemarkDrawer
        key={`${remarkDraft?.projectId}-${Boolean(remarkDraft)}`}
        open={Boolean(remarkDraft)}
        onClose={() => !savingRemark && setRemarkDraft(undefined)}
        onSave={(value) => void saveProjectRemark(value)}
        projectName={remarkDraft?.projectName ?? ''}
        saving={savingRemark}
        value={remarkDraft?.remark ?? ''}
      />
    </div>
  )
}
