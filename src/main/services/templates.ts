import { access, cp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ProjectCreateOptions, ProjectTemplate, Workspace } from '@shared/domain'
import { store } from '@main/infrastructure/store'
import { createId, requiredText } from './common'
import { scanWorkspace } from './workspaces'

const execFileAsync = promisify(execFile)

export async function listTemplates(): Promise<ProjectTemplate[]> {
  return store.templates.read()
}

export async function saveTemplate(input: ProjectTemplate): Promise<ProjectTemplate[]> {
  const name = requiredText(input.name, '模板名称', 80)
  const source = requiredText(input.source, '模板来源', 1_000)
  if (input.type !== 'git' && input.type !== 'local') throw new Error('模板类型无效')
  const existing = await store.templates.read()
  if (
    existing.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== input.id)
  )
    throw new Error(`模板名称重复：${name}`)
  const template: ProjectTemplate = {
    ...input,
    id: input.id || createId('template'),
    name,
    source,
    description: (input.description ?? '').trim().slice(0, 200)
  }
  await store.templates.write([...existing.filter((item) => item.id !== template.id), template])
  return listTemplates()
}

export async function removeTemplate(id: string): Promise<ProjectTemplate[]> {
  await store.templates.write((await store.templates.read()).filter((item) => item.id !== id))
  return listTemplates()
}

function validateProjectName(value: string): string {
  const name = requiredText(value, '项目名称', 120)
  if (name === '.' || name === '..' || /[\\/:*?"<>|]/.test(name))
    throw new Error('项目名称包含不允许的路径字符')
  return name
}

export async function createProject(options: ProjectCreateOptions): Promise<Workspace[]> {
  const templates = await store.templates.read()
  const template = templates.find((item) => item.id === options.templateId)
  if (!template) throw new Error('项目模板不存在')
  const workspaces = await store.workspaces.read()
  const workspace = workspaces.find((item) => item.id === options.workspaceId)
  if (!workspace) throw new Error('工作区不存在')
  const projectName = validateProjectName(options.projectName)
  const target = resolve(join(workspace.rootPath, projectName))
  if (
    !target.startsWith(resolve(workspace.rootPath) + '/') &&
    target !== resolve(workspace.rootPath)
  )
    throw new Error('项目目标路径无效')
  if (
    await access(target)
      .then(() => true)
      .catch(() => false)
  )
    throw new Error('目标目录已经存在，无法覆盖')
  try {
    if (template.type === 'git')
      await execFileAsync('git', ['clone', '--depth', '1', '--no-tags', template.source, target])
    else {
      await cp(template.source, target, {
        recursive: true,
        filter: (source) => !/(^|[/\\])(?:\.git|node_modules|dist|build)(?:[/\\]|$)/.test(source)
      })
    }
    await rm(join(target, '.git'), { recursive: true, force: true })
  } catch {
    await rm(target, { recursive: true, force: true }).catch(() => undefined)
    throw new Error('创建项目失败，请检查模板来源、Git 网络和目录权限')
  }
  return scanWorkspace(workspace.id)
}
