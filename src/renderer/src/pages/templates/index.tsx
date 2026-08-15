import { useEffect, useMemo, useState } from 'react'
import { Boxes, GitBranch, Pencil, Play, Save, Trash2 } from 'lucide-react'
import type { ProjectTemplate, Workspace } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { rendererLogger } from '@/lib/logger'

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
  const [project, setProject] = useState({ templateId: '', workspaceId: '', projectName: '' })
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
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
          setProject((value) => ({
            ...value,
            templateId: value.templateId || templateValue[0]?.id || ''
          }))
        }
        if (workspaceValue) {
          setWorkspaces(workspaceValue)
          setProject((value) => ({
            ...value,
            workspaceId: value.workspaceId || workspaceValue[0]?.id || ''
          }))
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
        setStatus('模板已保存')
      })
      .catch(report)
  }
  const create = (): void => {
    void window.api?.templates
      .createProject(project)
      .then((value) => {
        setWorkspaces(value)
        setStatus('项目创建成功')
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
    <div className="mx-auto max-w-5xl space-y-5 px-8 py-8">
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
              className="flex items-center gap-3 rounded-md border border-[#e7e8e9] p-3"
              key={template.id}
            >
              <div className="grid size-9 place-items-center rounded-md bg-[#f2f2f0] text-[#62666a]">
                {template.type === 'git' ? <GitBranch size={17} /> : <Boxes size={17} />}
              </div>
              <Button
                onClick={() => setDraft(template)}
                size="icon"
                title="编辑模板"
                variant="ghost"
              >
                <Pencil size={15} />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{template.name}</p>
                  <Badge variant="secondary">{template.type === 'git' ? 'Git' : '本地'}</Badge>
                </div>
                <p className="truncate text-xs text-[#777b80]">{template.source}</p>
              </div>
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
            <p className="py-8 text-center text-sm text-[#85878a]">
              {query ? '没有匹配模板' : '暂无模板，请先添加一个 Git 仓库或本地目录。'}
            </p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{draft.id ? '编辑模板' : '添加模板'}</CardTitle>
            <CardDescription>模板名称必须唯一。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                className="h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm"
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
              <Input
                id="template-source"
                onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                placeholder="目录路径或 Git URL"
                value={draft.source}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">描述</Label>
              <Textarea
                id="template-description"
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                value={draft.description}
              />
            </div>
            <Button onClick={save} variant="success">
              <Save size={15} />
              保存模板
            </Button>
            {draft.id && (
              <Button onClick={() => setDraft(emptyTemplate)} variant="ghost">
                取消编辑
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>从模板创建项目</CardTitle>
            <CardDescription>目标目录必须不存在，失败时会自动回滚半成品。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="create-template">模板</Label>
              <select
                className="h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm"
                id="create-template"
                onChange={(event) => setProject({ ...project, templateId: event.target.value })}
                value={project.templateId}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-workspace">工作区</Label>
              <select
                className="h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm"
                id="create-workspace"
                onChange={(event) => setProject({ ...project, workspaceId: event.target.value })}
                value={project.workspaceId}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-name">项目名称</Label>
              <Input
                id="project-name"
                onChange={(event) => setProject({ ...project, projectName: event.target.value })}
                value={project.projectName}
              />
            </div>
            <Button
              disabled={!templates.length || !workspaces.length}
              onClick={create}
              variant="success"
            >
              <Play size={15} />
              创建项目
            </Button>
            <p className="text-xs text-[#777b80]">{status}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
