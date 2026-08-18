import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Boxes, GitBranch, Pencil, Play, Plus, Save, Trash2 } from 'lucide-react'
import type { ProjectTemplate, Workspace } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Drawer } from '@/components/ui/drawer'
import { DirectoryPickerInput } from '@/components/DirectoryPickerInput'
import { ProjectCreateDrawer } from '@/components/ProjectCreateDrawer'
import { ConfirmAction } from '@/components/ConfirmAction'
import { SearchInput } from '@/components/SearchInput'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { TooltipButton } from '@/components/TooltipButton'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
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
import { ResourcePanel } from '@/components/ResourcePanel'
import { usePageFeedback } from '@/hooks/usePageFeedback'
import { useInitialLoad } from '@/hooks/useInitialLoad'
import { useAsyncAction } from '@/hooks/useAsyncAction'

const emptyTemplate: ProjectTemplate = {
  id: '',
  name: '',
  description: '',
  type: 'local',
  source: ''
}

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
        if (templateValue) {
          setTemplates(templateValue)
        }
        if (workspaceValue) {
          setWorkspaces(workspaceValue)
        }
      })
      .catch(report)
      .finally(() => setLoading(false))
  }, [report])
  useInitialLoad(load)
  const save = async (): Promise<void> => {
    const value = await run('template-save', () => window.api!.templates.save(draft), {
      success: '模板已保存'
    })
    if (value) {
      setTemplates(value)
      setDraft(emptyTemplate)
      setDrawerMode(null)
      clearError()
    }
  }
  const filtered = useMemo(
    () =>
      templates.filter((template) =>
        `${template.name} ${template.description} ${template.source}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [query, templates]
  )

  if (loading) return <PageLoadingSkeleton />
  return (
    <div className="h-full space-y-2.5 overflow-auto p-3">
      <ResourcePanel
        actions={
          <div className="flex gap-1">
            <Button
              disabled={!templates.length || !workspaces.length}
              onClick={() => {
                setCreateTemplateId(undefined)
                setDrawerMode('project')
              }}
              size="sm"
              variant="secondary"
            >
              <Play size={14} />
              创建项目
            </Button>
            <Button
              onClick={() => {
                setDraft(emptyTemplate)
                setDrawerMode('template')
              }}
              size="sm"
              variant="success"
            >
              <Plus size={14} />
              新增模板
            </Button>
          </div>
        }
        contentClassName="space-y-3"
        description="Git 模板使用浅克隆，本地模板会排除 .git、node_modules 和构建目录。"
        title="项目模板"
      >
        <SearchInput
          onValueChange={setQuery}
          placeholder="搜索模板名称、描述或来源"
          value={query}
        />
        {filtered.map((template) => (
          <Item key={template.id}>
            <ItemMedia className="bg-slate-100 text-slate-600">
              {template.type === 'git' ? <GitBranch /> : <Boxes />}
            </ItemMedia>
            <ItemContent>
              <div className="flex items-center gap-2">
                <ItemTitle>{template.name}</ItemTitle>
                <Badge variant="secondary">{template.type === 'git' ? 'Git' : '本地'}</Badge>
              </div>
              <ItemDescription>{template.source}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <TooltipButton
                disabled={!workspaces.length}
                onClick={() => {
                  setCreateTemplateId(template.id)
                  setDrawerMode('project')
                }}
                size="icon"
                tooltip={workspaces.length ? '使用此模板创建项目' : '请先创建工作区'}
                variant="ghost"
              >
                <Play size={14} />
              </TooltipButton>
              <TooltipButton
                onClick={() => {
                  setDraft(template)
                  setDrawerMode('template')
                }}
                size="icon"
                tooltip="编辑模板"
                variant="ghost"
              >
                <Pencil size={15} />
              </TooltipButton>
              <ConfirmAction
                description={`删除模板“${template.name}”不会删除已经创建的项目，但模板记录无法恢复。`}
                onConfirm={async () => {
                  const value = await run(
                    `template-remove:${template.id}`,
                    () => window.api!.templates.remove(template.id),
                    { success: `模板“${template.name}”已删除` }
                  )
                  if (value) setTemplates(value)
                }}
                title="删除项目模板？"
                triggerTooltip="删除模板"
              >
                <Button aria-label="删除模板" size="icon" variant="ghost">
                  <Trash2 size={15} />
                </Button>
              </ConfirmAction>
            </ItemActions>
          </Item>
        ))}
        {!filtered.length && (
          <Empty>
            <EmptyTitle>{query ? '没有匹配模板' : '尚未添加项目模板'}</EmptyTitle>
            <EmptyDescription>
              {query
                ? '尝试修改搜索条件，或清空搜索框查看全部模板。'
                : '可添加 Git 仓库或本地目录作为项目模板。'}
            </EmptyDescription>
          </Empty>
        )}
      </ResourcePanel>
      {status && (
        <Alert variant="destructive">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      )}
      <Drawer
        description="支持 Git 仓库和本地目录两种来源，模板名称必须唯一。"
        footer={
          <>
            <Button onClick={() => setDrawerMode(null)} variant="secondary">
              取消
            </Button>
            <Button
              loading={isPending('template-save')}
              loadingText="保存中"
              onClick={() => void save()}
              variant="success"
            >
              <Save size={15} />
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'template'}
        title={draft.id ? '编辑模板' : '新增模板'}
      >
        <div className="space-y-3">
          <Field htmlFor="template-name" label="名称">
            <Input
              id="template-name"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              value={draft.name}
            />
          </Field>
          <Field htmlFor="template-type" label="类型">
            <Select
              value={draft.type}
              onValueChange={(value) =>
                setDraft({ ...draft, type: value as ProjectTemplate['type'] })
              }
            >
              <SelectTrigger id="template-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">本地目录</SelectItem>
                <SelectItem value="git">Git 仓库</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field htmlFor="template-source" label="来源">
            {draft.type === 'local' ? (
              <DirectoryPickerInput
                id="template-source"
                onChange={(source) => setDraft({ ...draft, source })}
                placeholder="选择本地模板目录"
                value={draft.source}
              />
            ) : (
              <Input
                id="template-source"
                onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                placeholder="https://github.com/user/template.git"
                value={draft.source}
              />
            )}
          </Field>
          <Field htmlFor="template-description" label="描述">
            <Textarea
              id="template-description"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              value={draft.description}
            />
          </Field>
        </div>
      </Drawer>
      <ProjectCreateDrawer
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
