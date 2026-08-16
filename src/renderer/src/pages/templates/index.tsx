import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Boxes, GitBranch, Pencil, Play, Plus, Save, Trash2 } from 'lucide-react'
import type { ProjectTemplate, Workspace } from '@shared/domain'
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
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [drawerMode, setDrawerMode] = useState<'template' | 'project' | null>(null)
  const [loading, setLoading] = useState(true)
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
    toast.error(message)
    rendererLogger.error('模板操作失败', { error: message })
  }
  const load = (): void => {
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
  }
  useEffect(load, [])
  const save = (): void => {
    void window.api?.templates
      .save(draft)
      .then((value) => {
        setTemplates(value)
        setDraft(emptyTemplate)
        setDrawerMode(null)
        setStatus('')
        toast.success('模板已保存')
      })
      .catch(report)
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
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>项目模板</CardTitle>
            <CardDescription>
              Git 模板使用浅克隆，本地模板会排除 .git、node_modules 和构建目录。
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              disabled={!templates.length || !workspaces.length}
              onClick={() => {
                setCreateTemplateId(undefined)
                setDrawerMode('project')
              }}
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
              variant="success"
            >
              <Plus size={14} />
              新增模板
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
                  size="sm"
                  tooltip={workspaces.length ? '使用此模板创建项目' : '请先创建工作区'}
                  variant="secondary"
                >
                  <Play size={14} />
                  创建项目
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
                  onConfirm={() =>
                    void window.api?.templates.remove(template.id).then(setTemplates).catch(report)
                  }
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
        </CardContent>
      </Card>
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
            <Button onClick={save} variant="success">
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
          <div className="space-y-2">
            <Label htmlFor="template-name">名称</Label>
            <Input
              id="template-name"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              value={draft.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-type">类型</Label>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-source">来源</Label>
            {draft.type === 'local' ? (
              <DirectoryPickerInput
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-description">描述</Label>
            <Textarea
              id="template-description"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              value={draft.description}
            />
          </div>
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
