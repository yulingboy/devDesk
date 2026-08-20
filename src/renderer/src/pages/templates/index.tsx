import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { ProjectTemplate, Workspace } from '@shared/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { ProjectCreateDrawer } from '@/components/project/ProjectCreateDrawer'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useInitialLoad } from '@/hooks/useInitialLoad'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { TemplateEditorDrawer } from './components/TemplateEditorDrawer'
import { TemplateList } from './components/TemplateList'
import { TemplateToolbar } from './components/TemplateToolbar'

const emptyTemplate: ProjectTemplate = {
  id: '',
  name: '',
  description: '',
  type: 'local',
  source: ''
}

/** 模板页面入口只组合列表、工具栏和两个业务抽屉。 */
export function TemplatesPage(): React.JSX.Element {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [draft, setDraft] = useState<ProjectTemplate>(emptyTemplate)
  const [createTemplateId, setCreateTemplateId] = useState<string>()
  const [query, setQuery] = useState('')
  const [drawerMode, setDrawerMode] = useState<'template' | 'project' | null>(null)
  const [loading, setLoading] = useState(true)
  const { status, report, clearError } = usePageFeedback('模板操作失败')
  const { isPending, run } = useAsyncAction(report)
  const load = useCallback((): void => {
    void Promise.all([window.api?.templates.list(), window.api?.workspaces.list()])
      .then(([templateValue, workspaceValue]) => {
        if (templateValue) setTemplates(templateValue)
        if (workspaceValue) setWorkspaces(workspaceValue)
      })
      .catch(report)
      .finally(() => setLoading(false))
  }, [report])
  useInitialLoad(load)
  const filtered = useMemo(() => {
    const keyword = query.toLowerCase()
    return templates.filter((template) =>
      `${template.name} ${template.description} ${template.source}`.toLowerCase().includes(keyword)
    )
  }, [query, templates])
  const save = async (valueToSave: ProjectTemplate = draft): Promise<void> => {
    const value = await run('template-save', () => window.api!.templates.save(valueToSave), {
      success: '模板已保存'
    })
    if (value) {
      setTemplates(value)
      setDraft(emptyTemplate)
      setDrawerMode(null)
      clearError()
    }
  }
  const remove = async (template: ProjectTemplate): Promise<void> => {
    const value = await run(
      `template-remove:${template.id}`,
      () => window.api!.templates.remove(template.id),
      { success: `模板“${template.name}”已删除` }
    )
    if (value) setTemplates(value)
  }
  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <TemplateToolbar
        canCreateProject={Boolean(workspaces.length)}
        onCreateProject={() => {
          setCreateTemplateId(undefined)
          setDrawerMode('project')
        }}
        onCreateTemplate={() => {
          setDraft(emptyTemplate)
          setDrawerMode('template')
        }}
        onQueryChange={setQuery}
        query={query}
      >
        <TemplateList
          onCreateProject={(template) => {
            setCreateTemplateId(template.id)
            setDrawerMode('project')
          }}
          onEdit={(template) => {
            setDraft(template)
            setDrawerMode('template')
          }}
          onRemove={remove}
          query={query}
          templates={filtered}
          workspaces={workspaces}
        />
      </TemplateToolbar>
      {status && (
        <Alert variant="destructive">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      )}
      <TemplateEditorDrawer
        draft={draft}
        key={`${drawerMode}-${draft.id}`}
        onClose={() => setDrawerMode(null)}
        onSave={(value) => void save(value)}
        open={drawerMode === 'template'}
        saving={isPending('template-save')}
      />
      <ProjectCreateDrawer
        defaultSource={createTemplateId ? 'template' : 'empty'}
        defaultTemplateId={createTemplateId}
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
  )
}
