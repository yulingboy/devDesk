import { useEffect, useMemo, useState } from 'react'
import { Boxes, GitBranch, Pencil, Play, Plus, Save, Trash2 } from 'lucide-react'
import type { ProjectTemplate, Workspace } from '@shared/domain'
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
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(message)
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
  }
  useEffect(load, [])
  const save = (): void => {
    void window.api?.templates
      .save(draft)
      .then((value) => {
        setTemplates(value)
        setDraft(emptyTemplate)
        setDrawerMode(null)
        setStatus('模板已保存')
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

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        extra={
          <>
            <Button
              disabled={!templates.length || !workspaces.length}
              onClick={() => {
                setCreateTemplateId(undefined)
                setDrawerMode('project')
              }}
              variant="secondary"
            >
              <Play size={15} />
              创建项目
            </Button>
            <Button
              onClick={() => {
                setDraft(emptyTemplate)
                setDrawerMode('template')
              }}
              variant="success"
            >
              <Plus size={15} />
              新增模板
            </Button>
          </>
        }
        title="项目模板"
        subtitle="维护模板并快速创建新的工作区项目"
      />
      <Card>
        <CardHeader>
          <CardTitle>项目模板</CardTitle>
          <CardDescription>
            Git 模板使用浅克隆，本地模板会排除 .git、node_modules 和构建目录。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模板名称、描述或来源"
            value={query}
          />
          {filtered.map((template) => (
            <div
              className="flex items-center gap-3 rounded-md border border-slate-100 p-3"
              key={template.id}
            >
              <div className="grid size-9 place-items-center rounded-md bg-slate-100 text-slate-600">
                {template.type === 'git' ? <GitBranch size={17} /> : <Boxes size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{template.name}</p>
                  <Badge variant="secondary">{template.type === 'git' ? 'Git' : '本地'}</Badge>
                </div>
                <p className="truncate text-xs text-slate-500">{template.source}</p>
              </div>
              <Button
                disabled={!workspaces.length}
                onClick={() => {
                  setCreateTemplateId(template.id)
                  setDrawerMode('project')
                }}
                size="sm"
                title={workspaces.length ? '使用此模板创建项目' : '请先创建工作区'}
                variant="secondary"
              >
                <Play size={14} />
                创建项目
              </Button>
              <Button
                onClick={() => {
                  setDraft(template)
                  setDrawerMode('template')
                }}
                size="icon"
                title="编辑模板"
                variant="ghost"
              >
                <Pencil size={15} />
              </Button>
              <Button
                onClick={() => {
                  if (window.confirm(`删除模板“${template.name}”？`))
                    void window.api?.templates.remove(template.id).then(setTemplates).catch(report)
                }}
                size="icon"
                title="删除模板"
                variant="ghost"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          {!filtered.length && (
            <p className="py-8 text-center text-sm text-slate-400">
              {query ? '没有匹配模板' : '暂无模板，请先添加一个 Git 仓库或本地目录。'}
            </p>
          )}
        </CardContent>
      </Card>
      {status && <p className="text-xs text-slate-500">{status}</p>}
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
        <div className="space-y-5">
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
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              id="template-type"
              onChange={(event) =>
                setDraft({ ...draft, type: event.target.value as ProjectTemplate['type'] })
              }
              value={draft.type}
            >
              <option value="local">本地目录</option>
              <option value="git">Git 仓库</option>
            </select>
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
