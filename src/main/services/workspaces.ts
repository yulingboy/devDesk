import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { shell } from 'electron'
import type { Project, Workspace, WorkspaceScanResult } from '@shared/domain'
import { store } from '@main/infrastructure/store'
import { createId, requiredText } from './common'
import { syncGitRules } from './git'

const execFileAsync = promisify(execFile)

async function readGitStatus(
  path: string
): Promise<Pick<Project, 'branch' | 'dirty' | 'gitError'>> {
  try {
    const [{ stdout: branch }, { stdout: status }] = await Promise.all([
      execFileAsync('git', ['-C', path, 'branch', '--show-current']),
      execFileAsync('git', ['-C', path, 'status', '--porcelain'])
    ])
    return { branch: branch.trim() || '分离头指针', dirty: Boolean(status.trim()) }
  } catch (error) {
    return { gitError: error instanceof Error ? '无法读取 Git 状态' : 'Git 状态读取失败' }
  }
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return store.workspaces.read()
}

export async function saveWorkspace(input: Workspace): Promise<Workspace[]> {
  const name = requiredText(input.name, '工作区名称', 80)
  const rootPath = resolve(requiredText(input.rootPath, '工作区目录', 1_000))
  const existing = await store.workspaces.read()
  if (
    existing.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== input.id)
  )
    throw new Error(`工作区名称重复：${name}`)
  if (existing.some((item) => resolve(item.rootPath) === rootPath && item.id !== input.id))
    throw new Error('工作区目录已被使用')
  if (
    input.gitIdentityId &&
    !(await store.gitIdentities.read()).some((item) => item.id === input.gitIdentityId)
  )
    throw new Error('关联的 Git 身份不存在')
  const workspace: Workspace = {
    ...input,
    id: input.id || createId('workspace'),
    name,
    rootPath,
    description: (input.description ?? '').trim().slice(0, 200),
    projects: input.projects ?? []
  }
  await store.workspaces.write([...existing.filter((item) => item.id !== workspace.id), workspace])
  await syncGitRules()
  return listWorkspaces()
}

export async function removeWorkspace(id: string): Promise<Workspace[]> {
  const existing = await store.workspaces.read()
  if (!existing.some((item) => item.id === id)) throw new Error('工作区不存在')
  await store.workspaces.write(existing.filter((item) => item.id !== id))
  await syncGitRules()
  return listWorkspaces()
}

export async function scanWorkspace(id: string): Promise<Workspace[]> {
  return (await scanWorkspaceDetailed(id)).workspaces
}

/** 扫描仅检查工作区一级目录，避免大型目录树造成 UI 长时间阻塞。 */
export async function scanWorkspaceDetailed(id: string): Promise<WorkspaceScanResult> {
  const existing = await store.workspaces.read()
  const workspace = existing.find((item) => item.id === id)
  if (!workspace) throw new Error('工作区不存在')
  const entries = await readdir(workspace.rootPath, { withFileTypes: true }).catch(() => {
    throw new Error('无法读取工作区目录，请检查路径和权限')
  })
  const allCandidates = entries.filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith('.')
  )
  const candidates = allCandidates.slice(0, 500)
  const projects: Project[] = []
  for (const entry of candidates) {
    const path = resolve(workspace.rootPath, entry.name)
    const previous = workspace.projects.find((project) => project.path === path)
    projects.push({
      id: previous?.id ?? createId('project'),
      workspaceId: id,
      name: entry.name,
      path,
      ...(await readGitStatus(path))
    })
  }
  const updated = { ...workspace, projects }
  await store.workspaces.write(existing.map((item) => (item.id === id ? updated : item)))
  const knownPaths = new Set(workspace.projects.map((item) => item.path))
  const scannedPaths = new Set(projects.map((item) => item.path))
  return {
    workspaces: await listWorkspaces(),
    added: projects.filter((item) => !knownPaths.has(item.path)).length,
    removed: workspace.projects.filter((item) => !scannedPaths.has(item.path)).length,
    total: allCandidates.length,
    truncated: allCandidates.length > candidates.length,
    gitErrorCount: projects.filter((item) => Boolean(item.gitError)).length
  }
}

export async function openWorkspace(id: string): Promise<void> {
  const workspace = (await store.workspaces.read()).find((item) => item.id === id)
  if (!workspace) throw new Error('工作区不存在')
  const error = await shell.openPath(workspace.rootPath)
  if (error) throw new Error(`无法打开工作区目录：${error}`)
}

export async function openProject(path: string): Promise<void> {
  const error = await shell.openPath(resolve(requiredText(path, '项目路径', 1_000)))
  if (error) throw new Error(`无法打开项目目录：${error}`)
}

export async function openProjectEditor(pathInput: string): Promise<void> {
  const path = resolve(requiredText(pathInput, '项目路径', 1_000))
  try {
    await execFileAsync('code', [path], { timeout: 10_000 })
  } catch {
    throw new Error('无法打开编辑器，请确认 Visual Studio Code 已安装且 code 命令可用')
  }
}
