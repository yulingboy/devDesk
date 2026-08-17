import { access, lstat, readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  Project,
  ProjectPackageManager,
  ProjectScript,
  WorkspaceSubproject
} from '@shared/domain'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
import { createId } from './common'
import { parseProjectPackageManager } from './project-environment'
import {
  discoverProjectSubprojectPaths,
  type DiscoveredWorkspaceProject
} from './workspace-discovery'

const execFileAsync = promisify(execFile)

interface PackageJsonSnapshot {
  name?: unknown
  version?: unknown
  scripts?: unknown
  engines?: unknown
  packageManager?: unknown
  volta?: unknown
}

async function fileExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false)
}

export async function commandVersion(command: string): Promise<string> {
  const env = await getUserShellEnvironment()
  return execFileAsync(command, ['--version'], { timeout: 5_000, env })
    .then(({ stdout }) => stdout.trim().replace(/^v/, ''))
    .catch(() => '')
}

/** Electron 内置 Node 不是用户项目运行时，未找到外部 node 时应保持未检测状态。 */
export async function readCurrentNodeVersion(): Promise<string> {
  return commandVersion('node')
}

async function resolvePackageManager(
  path: string,
  packageManager: unknown
): Promise<ProjectPackageManager | undefined> {
  const configured = parseProjectPackageManager(packageManager)
  if (configured) return configured
  if (await fileExists(join(path, 'pnpm-lock.yaml'))) return 'pnpm'
  if (await fileExists(join(path, 'yarn.lock'))) return 'yarn'
  if ((await fileExists(join(path, 'bun.lockb'))) || (await fileExists(join(path, 'bun.lock'))))
    return 'bun'
  if (await fileExists(join(path, 'package-lock.json'))) return 'npm'
  return undefined
}

export async function readPackageSnapshot(path: string): Promise<{
  packageName?: string
  packageVersion?: string
  packageManager?: ProjectPackageManager
  nodeRequirement?: string
  hasPackageJson: boolean
  dependencyState: NonNullable<Project['dependencyState']>
  scripts: ProjectScript[]
  lockfileType?: ProjectPackageManager
  lockfileState: 'ready' | 'missing' | 'mismatch'
  nodeRequirementSource?: '.nvmrc' | '.node-version' | 'volta' | 'engines.node'
  nodeSource: 'process' | 'nvmrc' | 'node-version' | 'volta' | 'engines' | 'unknown'
}> {
  const raw = await readFile(join(path, 'package.json'), 'utf8').catch(() => '')
  if (!raw) {
    return {
      hasPackageJson: false,
      dependencyState: 'not-applicable',
      scripts: [],
      lockfileState: 'missing',
      nodeSource: 'unknown'
    }
  }
  let manifest: PackageJsonSnapshot
  try {
    manifest = JSON.parse(raw) as PackageJsonSnapshot
  } catch {
    // package.json 已存在但无效，仍以项目方式展示，避免扫描中断整个工作区。
    return {
      hasPackageJson: true,
      dependencyState: 'missing',
      scripts: [],
      lockfileState: 'missing',
      nodeSource: 'unknown'
    }
  }
  const scripts =
    manifest.scripts && typeof manifest.scripts === 'object'
      ? Object.entries(manifest.scripts as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .map(([name, command]) => ({ name, command }))
      : []
  const engines = manifest.engines && typeof manifest.engines === 'object' ? manifest.engines : {}
  const [packageManager, lockfileType, nvmrc, nodeVersionFile] = await Promise.all([
    resolvePackageManager(path, manifest.packageManager),
    resolvePackageManager(path, undefined),
    readFile(join(path, '.nvmrc'), 'utf8')
      .then((value) => value.trim())
      .catch(() => ''),
    readFile(join(path, '.node-version'), 'utf8')
      .then((value) => value.trim())
      .catch(() => '')
  ])
  const volta =
    manifest.volta && typeof manifest.volta === 'object'
      ? (manifest.volta as { node?: unknown }).node
      : undefined
  const engineRequirement = (engines as { node?: unknown }).node
  const nodeRequirement =
    nvmrc ||
    nodeVersionFile ||
    (typeof volta === 'string' ? volta : undefined) ||
    (typeof engineRequirement === 'string' ? engineRequirement : undefined)
  return {
    packageName: typeof manifest.name === 'string' ? manifest.name : undefined,
    packageVersion: typeof manifest.version === 'string' ? manifest.version : undefined,
    packageManager,
    nodeRequirement,
    lockfileType,
    lockfileState:
      packageManager && lockfileType && packageManager !== lockfileType
        ? 'mismatch'
        : lockfileType
          ? 'ready'
          : 'missing',
    nodeRequirementSource: nvmrc
      ? '.nvmrc'
      : nodeVersionFile
        ? '.node-version'
        : volta
          ? 'volta'
          : engineRequirement
            ? 'engines.node'
            : undefined,
    nodeSource: nvmrc
      ? 'nvmrc'
      : nodeVersionFile
        ? 'node-version'
        : volta
          ? 'volta'
          : nodeRequirement
            ? 'engines'
            : 'process',
    hasPackageJson: true,
    dependencyState: (await fileExists(join(path, 'node_modules'))) ? 'ready' : 'missing',
    scripts
  }
}

export async function readProjectRemote(path: string): Promise<string | undefined> {
  return execFileAsync('git', ['-C', path, 'remote', 'get-url', 'origin'], {
    timeout: 5_000,
    env: await getUserShellEnvironment()
  })
    .then(({ stdout }) => stdout.trim() || undefined)
    .catch(() => undefined)
}

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
): Promise<
  Pick<
    Project,
    | 'branch'
    | 'dirty'
    | 'gitError'
    | 'gitStatus'
    | 'gitAhead'
    | 'gitBehind'
    | 'gitChangedFiles'
    | 'lastCommit'
  >
> {
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
    const [{ stdout: branch }, { stdout: status }, { stdout: lastCommit }] = await Promise.all([
      execFileAsync('git', ['-C', path, 'branch', '--show-current'], { timeout: 8_000, env }),
      execFileAsync('git', ['-C', path, 'status', '--porcelain'], { timeout: 8_000, env }),
      execFileAsync('git', ['-C', path, 'log', '-1', '--pretty=%h · %s'], {
        timeout: 8_000,
        env
      }).catch(() => ({ stdout: '', stderr: '' }))
    ])
    let divergence = '0\t0'
    try {
      const result = await execFileAsync(
        'git',
        ['-C', path, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
        { timeout: 8_000, env }
      )
      divergence = result.stdout
    } catch {
      if (gitStatus === 'ready') gitStatus = 'no-upstream'
    }
    const changedFiles = status.split('\n').filter(Boolean).length
    const [ahead = 0, behind = 0] = divergence.trim().split(/\s+/).map(Number)
    return {
      branch: branch.trim() || '分离头指针',
      gitStatus,
      dirty: changedFiles > 0,
      gitChangedFiles: changedFiles,
      gitAhead: Number.isFinite(ahead) ? ahead : 0,
      gitBehind: Number.isFinite(behind) ? behind : 0,
      lastCommit: lastCommit.trim() || undefined
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
  previousProjects: Project[]
): Promise<Project> {
  const scanned = await scanProject(workspaceId, project.path, project)
  if (scanned.directoryExists === false) {
    return {
      ...scanned,
      subprojects: project.subprojects?.map((item) => ({ ...item, directoryExists: false }))
    }
  }
  const discovery = await discoverProjectSubprojectPaths(project.path)
  return {
    ...scanned,
    subprojects: await buildSubprojects(discovery.paths, previousProjects, project)
  }
}
