import { access, cp, mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ProjectCreateOptions, ProjectTemplate, Workspace } from '@shared/domain'
import { store, withDataMutation } from '@main/infrastructure/store'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
import { createId, entityId, isPathWithin, optionalText, requiredText } from './common'
import { scanWorkspace } from './workspaces'

const execFileAsync = promisify(execFile)

export async function listTemplates(): Promise<ProjectTemplate[]> {
  return store.templates.read()
}

export async function saveTemplate(input: ProjectTemplate): Promise<ProjectTemplate[]> {
  const name = requiredText(input.name, '模板名称', 80)
  const source = requiredText(input.source, '模板来源', 1_000)
  if (input.type !== 'git' && input.type !== 'local') throw new Error('模板类型无效')
  const template: ProjectTemplate = {
    ...input,
    id: input.id ? entityId(input.id, '模板 ID') : createId('template'),
    name,
    source,
    description: optionalText(input.description, 200)
  }
  await withDataMutation(async () => {
    const existing = await store.templates.read()
    if (input.id && !existing.some((item) => item.id === template.id))
      throw new Error('项目模板不存在')
    if (
      existing.some(
        (item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== input.id
      )
    )
      throw new Error(`模板名称重复：${name}`)
    await store.templates.write([...existing.filter((item) => item.id !== template.id), template])
  })
  return listTemplates()
}

export async function removeTemplate(id: string): Promise<ProjectTemplate[]> {
  await withDataMutation(async () => {
    const existing = await store.templates.read()
    if (!existing.some((item) => item.id === id)) throw new Error('项目模板不存在')
    await store.templates.write(existing.filter((item) => item.id !== id))
  })
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
    return 'Git 未安装，请先安装并配置 Git'
  if (/authentication|credential|terminal prompts disabled|could not read username/.test(text))
    return 'Git 凭据验证失败，请检查访问令牌、SSH 密钥或仓库权限'
  if (/timed out|etimedout|timeout/.test(text)) return '克隆超时，请检查网络后重试'
  if (/permission denied|eacces|operation not permitted/.test(text))
    return '目标目录没有写入权限，请更换工作区或修正目录权限'
  return '克隆失败，请检查网络连接、仓库地址和访问权限'
}

export async function createProject(options: ProjectCreateOptions): Promise<Workspace[]> {
  const source = options.source ?? 'template'
  const template =
    source === 'template'
      ? (await store.templates.read()).find((item) => item.id === options.templateId)
      : undefined
  if (source === 'template' && !template) throw new Error('项目模板不存在')
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
  if (target === targetRoot || !isPathWithin(targetRoot, target))
    throw new Error('项目目标路径无效')
  if (
    await access(target)
      .then(() => true)
      .catch(() => false)
  )
    throw new Error('目标目录已经存在，无法覆盖')
  try {
    if (source === 'empty') {
      await mkdir(target)
    } else {
      // 上方已校验模板存在；此处按模板类型执行非交互克隆或本地复制。
      if (!template) throw new Error('项目模板不存在')
      if (template.type === 'git') {
        await execFileAsync(
          'git',
          ['clone', '--depth', '1', '--no-tags', template.source, target],
          {
            timeout: 120_000,
            env: { ...(await getUserShellEnvironment()), GIT_TERMINAL_PROMPT: '0' }
          }
        )
      } else {
        await cp(template.source, target, {
          recursive: true,
          filter: (source) => !/(^|[/\\])(?:\.git|node_modules|dist|build)(?:[/\\]|$)/.test(source)
        })
      }
      await rm(join(target, '.git'), { recursive: true, force: true })
    }
  } catch (error) {
    await rm(target, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(
      source === 'empty'
        ? '创建空目录失败，请检查工作区路径和目录权限'
        : template?.type === 'git'
          ? describeCloneFailure(error)
          : '复制本地模板失败，请检查模板路径和目录权限'
    )
  }
  await scanWorkspace(workspace.id).catch((error: unknown) => {
    throw new Error(
      `项目目录已创建，但工作区扫描失败；目录已保留，请手动重新扫描：${error instanceof Error ? error.message : '未知错误'}`
    )
  })
  const remark = optionalText(options.remark, 200)
  return withDataMutation(async () => {
    const latest = await store.workspaces.read()
    const currentWorkspace = latest.find((item) => item.id === workspace.id)
    if (!currentWorkspace) throw new Error('项目目录已创建，但工作区已被删除；目录已保留')
    const projects = currentWorkspace.projects.map((project) => {
      if (!parentProject) return resolve(project.path) === target ? { ...project, remark } : project
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
    if (!parentProject && !projects.some((project) => resolve(project.path) === target)) {
      throw new Error('项目目录已创建，但扫描未建立项目索引；目录已保留，请手动重新扫描')
    }
    if (parentProject && !projects.some((project) => project.id === parentProject.id)) {
      throw new Error('项目目录已创建，但父项目已被移除；目录已保留')
    }
    const updated = latest.map((item) =>
      item.id === workspace.id ? { ...currentWorkspace, projects } : item
    )
    await store.workspaces.write(updated)
    return updated
  })
}
