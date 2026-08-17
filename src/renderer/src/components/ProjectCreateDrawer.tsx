import { useState } from 'react'
import { FolderKanban, FolderTree, Rocket } from 'lucide-react'
import type { ProjectTemplate, Workspace } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormMessage } from '@/components/ui/form'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ProjectCreateDrawerProps {
  defaultTemplateId?: string
  defaultWorkspaceId?: string
  defaultParentProjectId?: string
  onClose: () => void
  onCreated: (workspaces: Workspace[]) => void
  onError: (error: unknown) => void
  open: boolean
  templates: ProjectTemplate[]
  workspaces: Workspace[]
}

/** 工作区和模板页共用的创建项目抽屉，保证两个入口的校验与交互一致。 */
export function ProjectCreateDrawer({
  defaultTemplateId,
  defaultWorkspaceId,
  defaultParentProjectId,
  onClose,
  onCreated,
  onError,
  open,
  templates,
  workspaces
}: ProjectCreateDrawerProps): React.JSX.Element {
  const [templateId, setTemplateId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [remark, setRemark] = useState('')
  const [createMode, setCreateMode] = useState<'project' | 'subproject'>('project')
  const [parentProjectId, setParentProjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const fixedTemplate = templates.find((item) => item.id === defaultTemplateId)
  const fixedWorkspace = workspaces.find((item) => item.id === defaultWorkspaceId)
  const selectedTemplateId = templateId || defaultTemplateId || templates[0]?.id || ''
  const selectedWorkspaceId = workspaceId || defaultWorkspaceId || workspaces[0]?.id || ''
  const selectedWorkspace = workspaces.find((item) => item.id === selectedWorkspaceId)
  const fixedParentProject = selectedWorkspace?.projects.find(
    (item) => item.id === defaultParentProjectId
  )
  const effectiveMode = defaultParentProjectId ? 'subproject' : createMode
  const selectedParentProjectId =
    parentProjectId && selectedWorkspace?.projects.some((item) => item.id === parentProjectId)
      ? parentProjectId
      : (fixedParentProject?.id ?? selectedWorkspace?.projects[0]?.id ?? '')

  const close = (): void => {
    setTemplateId('')
    setWorkspaceId('')
    setProjectName('')
    setRemark('')
    setCreateMode('project')
    setParentProjectId('')
    setSubmitting(false)
    setErrorMessage('')
    onClose()
  }

  const createProject = (): void => {
    const reject = (message: string): void => {
      setErrorMessage(message)
      onError(new Error(message))
    }
    if (!selectedTemplateId) return reject('请选择项目模板')
    if (!selectedWorkspaceId) return reject('请选择目标工作区')
    if (effectiveMode === 'subproject' && !selectedParentProjectId) return reject('请选择父项目')
    const name = projectName.trim()
    if (!name) return reject('请输入项目名称')
    if (/[/\\:*?"<>|]/.test(name)) return reject('项目名称不能包含路径特殊字符')

    setErrorMessage('')
    setSubmitting(true)
    void window.api?.templates
      .createProject({
        templateId: selectedTemplateId,
        workspaceId: selectedWorkspaceId,
        projectName: name,
        parentProjectId: effectiveMode === 'subproject' ? selectedParentProjectId : undefined,
        remark
      })
      .then((value) => {
        onCreated(value)
        close()
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : '创建项目失败')
        onError(error)
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <Drawer
      description="从模板创建一级项目或子项目；目标已存在时不会覆盖。"
      footer={
        <>
          <Button disabled={submitting} onClick={close} variant="secondary">
            取消
          </Button>
          <Button disabled={submitting} onClick={createProject} variant="success">
            <Rocket size={15} />
            {submitting ? '创建中...' : '创建项目'}
          </Button>
        </>
      }
      onClose={close}
      open={open}
      title="从模板创建项目"
    >
      <div className="space-y-3">
        <Field htmlFor="create-project-template" label="项目模板">
          {fixedTemplate ? (
            <Item className="bg-slate-50">
              <ItemContent>
                <ItemTitle>{fixedTemplate.name}</ItemTitle>
                <ItemDescription>
                  {fixedTemplate.type === 'git' ? 'Git 模板' : '本地目录模板'}
                </ItemDescription>
              </ItemContent>
            </Item>
          ) : (
            <Select
              disabled={submitting}
              onValueChange={setTemplateId}
              value={selectedTemplateId || undefined}
            >
              <SelectTrigger id="create-project-template">
                <SelectValue placeholder="请选择模板" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}（{template.type === 'git' ? 'Git' : '本地'}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field
          description={
            effectiveMode === 'subproject'
              ? '用于确定子项目所属的工作区。'
              : '项目将作为工作区根目录下的一级目录。'
          }
          htmlFor="create-project-workspace"
          label="目标工作区"
        >
          {fixedWorkspace ? (
            <Item className="bg-slate-50">
              <ItemContent>
                <ItemTitle>{fixedWorkspace.name}</ItemTitle>
                <ItemDescription>{fixedWorkspace.rootPath}</ItemDescription>
              </ItemContent>
            </Item>
          ) : (
            <Select
              disabled={submitting}
              onValueChange={(value) => {
                setWorkspaceId(value)
                setParentProjectId('')
              }}
              value={selectedWorkspaceId || undefined}
            >
              <SelectTrigger id="create-project-workspace">
                <SelectValue placeholder="请选择工作区" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="创建类型">
          {fixedParentProject ? (
            <Item className="bg-slate-50">
              <FolderTree className="shrink-0 text-slate-400" size={15} />
              <ItemContent>
                <ItemTitle>子项目</ItemTitle>
                <ItemDescription>父项目：{fixedParentProject.name}</ItemDescription>
              </ItemContent>
            </Item>
          ) : (
            <ToggleGroup
              className="grid grid-cols-2"
              disabled={submitting}
              onValueChange={(value) => {
                if (value === 'project' || value === 'subproject') setCreateMode(value)
              }}
              type="single"
              value={effectiveMode}
            >
              <ToggleGroupItem className="justify-center" value="project">
                <FolderKanban />
                一级项目
              </ToggleGroupItem>
              <ToggleGroupItem className="justify-center" value="subproject">
                <FolderTree />
                子项目
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </Field>
        {effectiveMode === 'subproject' && !fixedParentProject && (
          <Field
            description="子项目将创建在所选一级项目目录下。"
            htmlFor="create-parent-project"
            label="父项目"
          >
            <Select
              disabled={submitting || !selectedWorkspace?.projects.length}
              onValueChange={setParentProjectId}
              value={selectedParentProjectId || undefined}
            >
              <SelectTrigger id="create-parent-project">
                <SelectValue placeholder="请选择父项目" />
              </SelectTrigger>
              <SelectContent>
                {selectedWorkspace?.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedWorkspace?.projects.length && (
              <FormMessage>当前工作区还没有一级项目</FormMessage>
            )}
          </Field>
        )}
        <Field htmlFor="create-project-name" label="项目名称">
          <Input
            autoFocus
            disabled={submitting}
            id="create-project-name"
            onChange={(event) => setProjectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createProject()
            }}
            placeholder="例如 my-app"
            value={projectName}
          />
        </Field>
        <Field
          htmlFor="create-project-remark"
          label="项目备注"
          labelExtra={
            <span className="text-[10px] tabular-nums text-slate-400">{remark.length}/200</span>
          }
        >
          <Textarea
            disabled={submitting}
            id="create-project-remark"
            maxLength={200}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="例如：后台服务或个人实验项目"
            value={remark}
          />
        </Field>
        {errorMessage && <FormMessage>{errorMessage}</FormMessage>}
      </div>
    </Drawer>
  )
}
