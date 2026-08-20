import { lstat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Project, WorkspaceSubproject } from '@shared/domain'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
import { createId } from './common'
import {
  discoverProjectSubprojectPaths,
  type DiscoveredWorkspaceProject
} from './workspace-discovery'

const execFileAsync = promisify(execFile)

function classifyGitError(error: unknown): Pick<Project, 'gitError' | 'gitStatus'> {
  const value = error as NodeJS.ErrnoException & { stderr?: string }
  const detail = `${value.stderr ?? ''} ${value.message ?? ''}`.toLowerCase()
  if (value.code === 'ENOENT' || detail.includes('command not found')) {
    return { gitStatus: 'git-missing', gitError: '未找到 Git，请先安装 Git' }
  }
  if (detail.includes('not a git repository')) {
    return { gitStatus: 'not-repository' }
  }
  if (detail.includes('permission denied') || detail.includes('operation not permitted')) {
    return { gitStatus: 'error', gitError: '没有权限读取 Git 状态' }
  }
  return { gitStatus: 'error', gitError: '无法读取 Git 状态' }
}

export async function readGitStatus(
  path: string
): Promise<Pick<Project, 'branch' | 'dirty' | 'gitError' | 'gitStatus'>> {
  const env = await getUserShellEnvironment()
  try {
    await execFileAsync('git', ['-C', path, 'rev-parse', '--is-inside-work-tree'], {
      timeout: 8_000,
      env
    })
  } catch (error) {
    return classifyGitError(error)
  }
  let gitStatus: Project['gitStatus'] = 'ready'
  try {
    await execFileAsync('git', ['-C', path, 'remote', 'get-url', 'origin'], {
      timeout: 8_000,
      env
    })
  } catch {
    gitStatus = 'no-remote'
  }
  try {
    const [{ stdout: branch }, { stdout: status }] = await Promise.all([
      execFileAsync('git', ['-C', path, 'branch', '--show-current'], { timeout: 8_000, env }),
      execFileAsync('git', ['-C', path, 'status', '--porcelain'], { timeout: 8_000, env })
    ])
    const changedFiles = status.split('\n').filter(Boolean).length
    return {
      branch: branch.trim() || '分离头指针',
      gitStatus,
      dirty: changedFiles > 0
    }
  } catch (error) {
    return classifyGitError(error)
  }
}

/** 工作区扫描只建立目录索引，不假设项目使用某种语言或构建工具。 */
async function scanProject(
  workspaceId: string,
  path: string,
  previous?: Project
): Promise<Project> {
  const metadata = await lstat(path).catch(() => undefined)
  // 手动纳入的目录可能在扫描间被移动。保留记录，交由界面提示用户处理。
  if (!metadata?.isDirectory()) {
    return {
      ...previous,
      id: previous?.id ?? createId('project'),
      workspaceId,
      name: previous?.name ?? basename(path),
      path,
      source: previous?.source ?? 'scanned',
      directoryExists: false,
      lastScannedAt: new Date().toISOString()
    }
  }
  const gitSnapshot = await readGitStatus(path)
  return {
    ...previous,
    id: previous?.id ?? createId('project'),
    workspaceId,
    name: previous?.name ?? basename(path),
    path,
    source: previous?.source ?? 'scanned',
    ...gitSnapshot,
    directoryExists: true,
    lastScannedAt: new Date().toISOString()
  }
}

function findPreviousSubproject(
  path: string,
  previousProjects: Project[]
): WorkspaceSubproject | undefined {
  for (const project of previousProjects) {
    const previous = project.subprojects?.find((item) => resolve(item.path) === path)
    if (previous) return previous
  }
  // 旧版把二级项目平铺在 projects 中；扫描时复用其标识并迁移到父项目下。
  const legacyProject = previousProjects.find((project) => resolve(project.path) === path)
  return legacyProject
    ? {
        id: legacyProject.id,
        name: legacyProject.name,
        path: legacyProject.path,
        directoryExists: legacyProject.directoryExists,
        lastScannedAt: legacyProject.lastScannedAt
      }
    : undefined
}

async function buildSubprojects(
  paths: string[],
  previousProjects: Project[],
  previousParent?: Project
): Promise<WorkspaceSubproject[]> {
  const scannedAt = new Date().toISOString()
  const pathSet = new Set(paths.map((path) => resolve(path)))
  // 模板创建的子项目可能不含语言标记文件，不能在下次扫描时被丢弃。
  for (const subproject of previousParent?.subprojects ?? []) {
    if (subproject.source === 'created') pathSet.add(resolve(subproject.path))
  }
  return Promise.all(
    [...pathSet].map(async (path) => {
      const previous = findPreviousSubproject(path, previousProjects)
      const metadata = await lstat(path).catch(() => undefined)
      return {
        ...previous,
        id: previous?.id ?? createId('subproject'),
        name: basename(path),
        path,
        source: previous?.source ?? 'scanned',
        directoryExists: Boolean(metadata?.isDirectory()),
        lastScannedAt: scannedAt
      }
    })
  )
}

export async function scanDiscoveredProject(
  workspaceId: string,
  discovered: DiscoveredWorkspaceProject,
  previousProjects: Project[]
): Promise<Project> {
  const previous = previousProjects.find((project) => resolve(project.path) === discovered.path)
  const project = await scanProject(workspaceId, discovered.path, previous)
  return {
    ...project,
    name: basename(discovered.path),
    path: discovered.path,
    subprojects: await buildSubprojects(discovered.subprojectPaths, previousProjects, previous)
  }
}

export async function scanProjectWithSubprojects(
  workspaceId: string,
  project: Project,
  previousProjects: Project[],
  scanDepth = 3,
  ignoredDirectories: string[] = []
): Promise<Project> {
  const scanned = await scanProject(workspaceId, project.path, project)
  if (scanned.directoryExists === false) {
    return {
      ...scanned,
      subprojects: project.subprojects?.map((item) => ({ ...item, directoryExists: false }))
    }
  }
  const discovery = await discoverProjectSubprojectPaths(
    project.path,
    200,
    scanDepth,
    ignoredDirectories
  )
  return {
    ...scanned,
    subprojects: await buildSubprojects(discovery.paths, previousProjects, project)
  }
}
