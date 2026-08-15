import { useState } from 'react'
import { Rocket } from 'lucide-react'
import type { ProjectTemplate, Workspace } from '@shared/domain'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface ProjectCreateDrawerProps {
  defaultTemplateId?: string
  defaultWorkspaceId?: string
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
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const fixedTemplate = templates.find((item) => item.id === defaultTemplateId)
  const fixedWorkspace = workspaces.find((item) => item.id === defaultWorkspaceId)
  const selectedTemplateId = templateId || defaultTemplateId || templates[0]?.id || ''
  const selectedWorkspaceId = workspaceId || defaultWorkspaceId || workspaces[0]?.id || ''

  const close = (): void => {
    setTemplateId('')
    setWorkspaceId('')
    setProjectName('')
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
    const name = projectName.trim()
    if (!name) return reject('请输入项目名称')
    if (/[/\\:*?"<>|]/.test(name)) return reject('项目名称不能包含路径特殊字符')

    setErrorMessage('')
    setSubmitting(true)
    void window.api?.templates
      .createProject({
        templateId: selectedTemplateId,
        workspaceId: selectedWorkspaceId,
        projectName: name
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
      description="项目会创建在工作区根目录下；目标已存在时不会覆盖。"
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
        <FormItem>
          <FormLabel htmlFor="create-project-template">项目模板</FormLabel>
          {fixedTemplate ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {fixedTemplate.name}
              <span className="ml-2 text-xs text-slate-400">
                {fixedTemplate.type === 'git' ? 'Git' : '本地目录'}
              </span>
            </div>
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
        </FormItem>
        <FormItem>
          <FormLabel htmlFor="create-project-workspace">目标工作区</FormLabel>
          {fixedWorkspace ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p>{fixedWorkspace.name}</p>
              <p className="mt-1 truncate text-xs text-slate-400">{fixedWorkspace.rootPath}</p>
            </div>
          ) : (
            <Select
              disabled={submitting}
              onValueChange={setWorkspaceId}
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
          <FormDescription>项目将作为工作区根目录下的一级目录。</FormDescription>
        </FormItem>
        <FormItem>
          <FormLabel htmlFor="create-project-name">项目名称</FormLabel>
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
        </FormItem>
        {errorMessage && <FormMessage>{errorMessage}</FormMessage>}
      </div>
    </Drawer>
  )
}
