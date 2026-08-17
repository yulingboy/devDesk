import { access, cp, rm } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ProjectCreateOptions, ProjectTemplate, Workspace } from '@shared/domain'
import { store } from '@main/infrastructure/store'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
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

function describeCloneFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  const text = message.toLowerCase()
  if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT')
    return 'Git 未安装，请先在环境检测中安装或配置 Git'
  if (/authentication|credential|terminal prompts disabled|could not read username/.test(text))
    return 'Git 凭据验证失败，请检查访问令牌、SSH 密钥或仓库权限'
  if (/timed out|etimedout|timeout/.test(text)) return '克隆超时，请检查网络后重试'
  if (/permission denied|eacces|operation not permitted/.test(text))
    return '目标目录没有写入权限，请更换工作区或修正目录权限'
  return '克隆失败，请检查网络连接、仓库地址和访问权限'
}

export async function createProject(options: ProjectCreateOptions): Promise<Workspace[]> {
  const templates = await store.templates.read()
  const template = templates.find((item) => item.id === options.templateId)
  if (!template) throw new Error('项目模板不存在')
  const workspaces = await store.workspaces.read()
  const workspace = workspaces.find((item) => item.id === options.workspaceId)
  if (!workspace) throw new Error('工作区不存在')
  const projectName = validateProjectName(options.projectName)
  const parentProject = options.parentProjectId
    ? workspace.projects.find((item) => item.id === options.parentProjectId)
    : undefined
  if (options.parentProjectId && !parentProject) throw new Error('父项目不存在')
  if (parentProject?.directoryExists === false) throw new Error('父项目目录不存在，无法创建子项目')
  const targetRoot = resolve(parentProject?.path ?? workspace.rootPath)
  const targetRootAvailable = await access(targetRoot)
    .then(() => true)
    .catch(() => false)
  if (!targetRootAvailable)
    throw new Error(parentProject ? '父项目目录不存在，无法创建子项目' : '工作区目录不存在')
  const target = resolve(targetRoot, projectName)
  const relativeTarget = relative(targetRoot, target)
  if (
    !relativeTarget ||
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(relativeTarget)
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
      await execFileAsync('git', ['clone', '--depth', '1', '--no-tags', template.source, target], {
        timeout: 120_000,
        env: { ...(await getUserShellEnvironment()), GIT_TERMINAL_PROMPT: '0' }
      })
    else {
      await cp(template.source, target, {
        recursive: true,
        filter: (source) => !/(^|[/\\])(?:\.git|node_modules|dist|build)(?:[/\\]|$)/.test(source)
      })
    }
    await rm(join(target, '.git'), { recursive: true, force: true })
  } catch (error) {
    await rm(target, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(
      template.type === 'git'
        ? describeCloneFailure(error)
        : '复制本地模板失败，请检查模板路径和目录权限'
    )
  }
  const scannedWorkspaces = await scanWorkspace(workspace.id)
  const remark = (options.remark ?? '').trim().slice(0, 200)
  const updatedWorkspaces = scannedWorkspaces.map((item) => {
    if (item.id !== workspace.id) return item
    if (!parentProject) {
      return {
        ...item,
        projects: item.projects.map((project) =>
          resolve(project.path) === target ? { ...project, remark } : project
        )
      }
    }
    return {
      ...item,
      projects: item.projects.map((project) => {
        if (project.id !== parentProject.id) return project
        const existing = project.subprojects?.find(
          (subproject) => resolve(subproject.path) === target
        )
        const createdSubproject = {
          ...existing,
          id: existing?.id ?? createId('subproject'),
          name: projectName,
          path: target,
          source: 'created' as const,
          remark,
          directoryExists: true,
          lastScannedAt: new Date().toISOString()
        }
        return {
          ...project,
          subprojects: [
            ...(project.subprojects ?? []).filter(
              (subproject) => resolve(subproject.path) !== target
            ),
            createdSubproject
          ].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
        }
      })
    }
  })
  await store.workspaces.write(updatedWorkspaces)
  return updatedWorkspaces
}
