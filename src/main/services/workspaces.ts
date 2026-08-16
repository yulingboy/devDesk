import { access, lstat, readFile, readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { shell } from 'electron'
import type {
  Project,
  ProjectDetail,
  ProjectPackageManager,
  ProjectScript,
  Workspace,
  WorkspaceScanResult
} from '@shared/domain'
import { store } from '@main/infrastructure/store'
import { createId, requiredText } from './common'
import { syncGitRules } from './git'
import { isNodeRequirementSatisfied, parseProjectPackageManager } from './project-environment'

const execFileAsync = promisify(execFile)
const scanConcurrency = 6

interface PackageJsonSnapshot {
  name?: unknown
  version?: unknown
  scripts?: unknown
  engines?: unknown
  packageManager?: unknown
}

async function fileExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false)
}

async function commandVersion(command: string): Promise<string> {
  return execFileAsync(command, ['--version'], { timeout: 5_000 })
    .then(({ stdout }) => stdout.trim().replace(/^v/, ''))
    .catch(() => '')
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

async function readPackageSnapshot(path: string): Promise<{
  packageName?: string
  packageVersion?: string
  packageManager?: ProjectPackageManager
  nodeRequirement?: string
  hasPackageJson: boolean
  dependencyState: NonNullable<Project['dependencyState']>
  scripts: ProjectScript[]
}> {
  const raw = await readFile(join(path, 'package.json'), 'utf8').catch(() => '')
  if (!raw) {
    return {
      hasPackageJson: false,
      dependencyState: 'not-applicable',
      scripts: []
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
      scripts: []
    }
  }
  const scripts =
    manifest.scripts && typeof manifest.scripts === 'object'
      ? Object.entries(manifest.scripts as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .map(([name, command]) => ({ name, command }))
      : []
  const engines = manifest.engines && typeof manifest.engines === 'object' ? manifest.engines : {}
  return {
    packageName: typeof manifest.name === 'string' ? manifest.name : undefined,
    packageVersion: typeof manifest.version === 'string' ? manifest.version : undefined,
    packageManager: await resolvePackageManager(path, manifest.packageManager),
    nodeRequirement:
      typeof (engines as { node?: unknown }).node === 'string'
        ? (engines as { node: string }).node
        : undefined,
    hasPackageJson: true,
    dependencyState: (await fileExists(join(path, 'node_modules'))) ? 'ready' : 'missing',
    scripts
  }
}

async function readProjectRemote(path: string): Promise<string | undefined> {
  return execFileAsync('git', ['-C', path, 'remote', 'get-url', 'origin'], { timeout: 5_000 })
    .then(({ stdout }) => stdout.trim() || undefined)
    .catch(() => undefined)
}

async function readGitStatus(
  path: string
): Promise<Pick<Project, 'branch' | 'dirty' | 'gitError'>> {
  try {
    const [{ stdout: branch }, { stdout: status }] = await Promise.all([
      execFileAsync('git', ['-C', path, 'branch', '--show-current'], { timeout: 8_000 }),
      execFileAsync('git', ['-C', path, 'status', '--porcelain'], { timeout: 8_000 })
    ])
    return { branch: branch.trim() || '分离头指针', dirty: Boolean(status.trim()) }
  } catch (error) {
    return { gitError: error instanceof Error ? '无法读取 Git 状态' : 'Git 状态读取失败' }
  }
}

/** 项目卡片只保存轻量快照；详情抽屉再读取 scripts 与环境兼容性。 */
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
  const [git, packageSnapshot, remote] = await Promise.all([
    readGitStatus(path),
    readPackageSnapshot(path),
    readProjectRemote(path)
  ])
  return {
    id: previous?.id ?? createId('project'),
    workspaceId,
    name: previous?.name ?? basename(path),
    path,
    source: previous?.source ?? 'scanned',
    ...git,
    packageName: packageSnapshot.packageName,
    packageVersion: packageSnapshot.packageVersion,
    packageManager: packageSnapshot.packageManager,
    nodeRequirement: packageSnapshot.nodeRequirement,
    hasPackageJson: packageSnapshot.hasPackageJson,
    dependencyState: packageSnapshot.dependencyState,
    remote,
    scriptCount: packageSnapshot.scripts.length,
    directoryExists: true,
    lastScannedAt: new Date().toISOString()
  }
}

async function findProject(
  workspaceId: string,
  projectId: string
): Promise<{
  workspace: Workspace
  project: Project
}> {
  const id = requiredText(workspaceId, '工作区 ID', 120)
  const projectKey = requiredText(projectId, '项目 ID', 120)
  const workspace = (await store.workspaces.read()).find((item) => item.id === id)
  if (!workspace) throw new Error('工作区不存在')
  const project = workspace.projects.find((item) => item.id === projectKey)
  if (!project) throw new Error('项目不存在，请先扫描工作区')
  return { workspace, project }
}

async function buildProjectDetail(project: Project, workspace: Workspace): Promise<ProjectDetail> {
  const [packageSnapshot, currentNodeVersion, metadata, identities] = await Promise.all([
    readPackageSnapshot(project.path),
    commandVersion('node'),
    lstat(project.path).catch(() => undefined),
    store.gitIdentities.read()
  ])
  const directoryExists = Boolean(metadata?.isDirectory())
  const gitIdentity = identities.find((identity) => identity.id === workspace.gitIdentityId)
  const packageManagerAvailable = packageSnapshot.packageManager
    ? Boolean(await commandVersion(packageSnapshot.packageManager))
    : false
  const nextProject = {
    ...project,
    packageName: packageSnapshot.packageName,
    packageVersion: packageSnapshot.packageVersion,
    packageManager: packageSnapshot.packageManager,
    nodeRequirement: packageSnapshot.nodeRequirement,
    hasPackageJson: packageSnapshot.hasPackageJson,
    dependencyState: packageSnapshot.dependencyState,
    scriptCount: packageSnapshot.scripts.length,
    directoryExists
  }
  return {
    project: nextProject,
    scripts: packageSnapshot.scripts,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      rootPath: workspace.rootPath,
      gitIdentity: gitIdentity
        ? {
            id: gitIdentity.id,
            name: gitIdentity.name,
            username: gitIdentity.username,
            email: gitIdentity.email
          }
        : undefined
    },
    environment: {
      directoryExists,
      currentNodeVersion,
      nodeRequirement: packageSnapshot.nodeRequirement,
      nodeCompatible: isNodeRequirementSatisfied(
        currentNodeVersion,
        packageSnapshot.nodeRequirement
      ),
      packageManager: packageSnapshot.packageManager,
      packageManagerAvailable,
      dependencyState: packageSnapshot.dependencyState
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const result = new Array<R>(items.length)
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      result[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return result
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return store.workspaces.read()
}

export async function saveWorkspace(input: Workspace): Promise<Workspace[]> {
  const name = requiredText(input.name, '工作区名称', 80)
  const rootPath = resolve(requiredText(input.rootPath, '工作区目录', 1_000))
  const metadata = await lstat(rootPath).catch(() => undefined)
  if (!metadata?.isDirectory()) throw new Error('工作区目录不存在或不是有效目录')
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
    // 项目清单只能由扫描流程刷新；编辑工作区元数据不能覆盖既有扫描结果。
    projects: existing.find((item) => item.id === input.id)?.projects ?? []
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
  const discoveredProjects = await mapWithConcurrency(
    candidates,
    scanConcurrency,
    async (entry) => {
      const path = resolve(workspace.rootPath, entry.name)
      const previous = workspace.projects.find((project) => project.path === path)
      return scanProject(id, path, { ...previous, name: entry.name, path } as Project)
    }
  )
  const discoveredPaths = new Set(discoveredProjects.map((item) => item.path))
  // 手动纳入的外部项目不在工作区一级目录中，扫描时保留并刷新其真实状态。
  const manualProjects = await mapWithConcurrency(
    workspace.projects.filter(
      (project) => project.source === 'manual' && !discoveredPaths.has(project.path)
    ),
    scanConcurrency,
    async (project) => {
      if (!(await fileExists(project.path))) return project
      return scanProject(id, project.path, project)
    }
  )
  const projects = [...discoveredProjects, ...manualProjects]
  const updated = { ...workspace, projects }
  await store.workspaces.write(existing.map((item) => (item.id === id ? updated : item)))
  const knownPaths = new Set(workspace.projects.map((item) => item.path))
  const scannedPaths = new Set(projects.map((item) => item.path))
  return {
    workspaces: await listWorkspaces(),
    added: projects.filter((item) => !knownPaths.has(item.path)).length,
    removed: workspace.projects.filter(
      (item) => item.source !== 'manual' && !scannedPaths.has(item.path)
    ).length,
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

/** 详情读取不写入数据文件，适合在抽屉打开时刷新真实项目环境。 */
export async function getProjectDetail(
  workspaceId: string,
  projectId: string
): Promise<ProjectDetail> {
  const { workspace, project } = await findProject(workspaceId, projectId)
  return buildProjectDetail(project, workspace)
}

/** 单项目刷新只更新目标项目，避免用户为一次依赖安装重新扫描整个工作区。 */
export async function refreshProject(
  workspaceId: string,
  projectId: string
): Promise<ProjectDetail> {
  const { workspace, project } = await findProject(workspaceId, projectId)
  const nextProject = await scanProject(workspace.id, project.path, project)
  const nextWorkspace = {
    ...workspace,
    projects: workspace.projects.map((item) => (item.id === project.id ? nextProject : item))
  }
  const workspaces = await store.workspaces.read()
  await store.workspaces.write(
    workspaces.map((item) => (item.id === workspace.id ? nextWorkspace : item))
  )
  return buildProjectDetail(nextProject, nextWorkspace)
}

/** 手动纳入项目只写应用内工作区记录，不移动、复制或删除用户磁盘文件。 */
export async function addProjectToWorkspace(
  workspaceId: string,
  pathInput: string
): Promise<Workspace[]> {
  const id = requiredText(workspaceId, '工作区 ID', 120)
  const path = resolve(requiredText(pathInput, '项目目录', 1_000))
  const workspaces = await store.workspaces.read()
  const workspace = workspaces.find((item) => item.id === id)
  if (!workspace) throw new Error('工作区不存在')
  const metadata = await lstat(path).catch(() => undefined)
  if (!metadata?.isDirectory()) throw new Error('项目目录不存在或不是有效目录')
  if (workspace.projects.some((item) => resolve(item.path) === path))
    throw new Error('该目录已在当前工作区中')
  const project = await scanProject(id, path, {
    id: createId('project'),
    workspaceId: id,
    name: basename(path),
    path,
    source: 'manual'
  })
  await store.workspaces.write(
    workspaces.map((item) =>
      item.id === id ? { ...item, projects: [...item.projects, project] } : item
    )
  )
  return listWorkspaces()
}

/** 从工作区移除项目只删除应用内引用，项目目录与 Git 仓库均保持原样。 */
export async function removeProjectFromWorkspace(
  workspaceId: string,
  projectId: string
): Promise<Workspace[]> {
  const { workspace, project } = await findProject(workspaceId, projectId)
  const workspaces = await store.workspaces.read()
  await store.workspaces.write(
    workspaces.map((item) =>
      item.id === workspace.id
        ? { ...item, projects: item.projects.filter((candidate) => candidate.id !== project.id) }
        : item
    )
  )
  return listWorkspaces()
}

/** 安装命令根据项目锁文件和 packageManager 字段推导，禁止渲染层传入自定义命令。 */
export async function installProjectDependencies(
  workspaceId: string,
  projectId: string
): Promise<ProjectDetail> {
  const { workspace, project } = await findProject(workspaceId, projectId)
  const detail = await buildProjectDetail(project, workspace)
  if (!detail.project.hasPackageJson)
    throw new Error('当前项目没有 package.json，无法安装 JavaScript 依赖')
  const manager = detail.environment.packageManager
  if (!manager) throw new Error('未识别项目包管理器，请添加锁文件或 packageManager 字段')
  if (!detail.environment.packageManagerAvailable)
    throw new Error(`项目需要 ${manager}，但本机未检测到该包管理器`)
  await execFileAsync(manager, ['install'], {
    cwd: project.path,
    timeout: 10 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, CI: '1' }
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    throw new Error(
      message.includes('ETIMEDOUT')
        ? '安装依赖超时，请检查网络和 Registry 设置'
        : `使用 ${manager} 安装依赖失败，请检查终端输出、网络和目录权限`
    )
  })
  return refreshProject(workspaceId, projectId)
}

function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** macOS 将长期运行的脚本放入新的 Terminal 会话，应用不会持有或截断开发服务进程。 */
export async function runProjectScript(
  workspaceId: string,
  projectId: string,
  scriptInput: string
): Promise<void> {
  if (process.platform !== 'darwin') throw new Error('当前平台请在项目目录的终端中手动运行脚本')
  const script = requiredText(scriptInput, '脚本名称', 120)
  const { workspace, project } = await findProject(workspaceId, projectId)
  const detail = await buildProjectDetail(project, workspace)
  if (!detail.scripts.some((item) => item.name === script)) throw new Error('项目脚本不存在')
  const manager = detail.environment.packageManager
  if (!manager || !detail.environment.packageManagerAvailable)
    throw new Error('项目包管理器不可用，无法运行脚本')
  const command = `cd ${quoteShellArgument(project.path)} && ${manager} run ${quoteShellArgument(script)}; exec $SHELL -l`
  await execFileAsync('osascript', [
    '-e',
    `tell application "Terminal" to do script ${JSON.stringify(command)}`
  ]).catch(() => {
    throw new Error('无法启动 Terminal，请确认系统允许开发工坊自动化控制 Terminal')
  })
}
