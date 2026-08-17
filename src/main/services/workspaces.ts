import { lstat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promisify } from 'node:util'
import { BrowserWindow, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import { PROJECT_EDITOR_OPTIONS, type ProjectEditorId } from '@shared/domain'
import type {
  Project,
  ProjectDetail,
  ProjectTask,
  ProjectIssue,
  Workspace,
  WorkspaceScanResult
} from '@shared/domain'
import { store } from '@main/infrastructure/store'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
import { createId, optionalText, requiredText } from './common'
import { syncGitRules } from './git-rules'
import { isNodeRequirementSatisfied } from './project-environment'
import { discoverWorkspaceProjectPaths } from './workspace-discovery'
import { getTopLevelProjectPath, normalizeWorkspaceProjectHierarchy } from './workspace-hierarchy'
import {
  commandVersion,
  readCurrentNodeVersion,
  readGitStatus,
  readPackageSnapshot,
  readProjectRemote,
  scanDiscoveredProject,
  scanProjectWithSubprojects
} from './workspace-scanner'

const execFileAsync = promisify(execFile)
const scanConcurrency = 6
const projectTasks = new Map<string, ProjectTask>()
const projectProcesses = new Map<string, ChildProcessWithoutNullStreams>()
const maxTaskLogs = 500

const editorLaunchers: Record<
  ProjectEditorId,
  { macApplication: string; command: string; mode?: 'codex' }
> = {
  // Codex 通过官方 CLI 的 app 子命令打开工作区，确保进入 Codex 工作区而不是普通文件预览。
  codex: { macApplication: 'ChatGPT', command: 'codex', mode: 'codex' },
  vscode: { macApplication: 'Visual Studio Code', command: 'code' },
  cursor: { macApplication: 'Cursor', command: 'cursor' },
  windsurf: { macApplication: 'Windsurf', command: 'windsurf' },
  zed: { macApplication: 'Zed', command: 'zed' },
  webstorm: { macApplication: 'WebStorm', command: 'webstorm' },
  'intellij-idea': { macApplication: 'IntelliJ IDEA', command: 'idea' },
  pycharm: { macApplication: 'PyCharm', command: 'pycharm' },
  goland: { macApplication: 'GoLand', command: 'goland' }
}

function emitProjectTask(task: ProjectTask): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.workspaces.taskUpdated, task)
  }
}

function appendTaskLog(task: ProjectTask, chunk: string): void {
  const lines = chunk.replace(/\r/g, '').split('\n').filter(Boolean)
  if (!lines.length) return
  task.logs = [...task.logs, ...lines].slice(-maxTaskLogs)
  emitProjectTask(task)
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

function buildProjectIssues(
  project: Project,
  environment: ProjectDetail['environment'],
  git: ProjectDetail['git']
): ProjectIssue[] {
  const issues: ProjectIssue[] = []
  if (!environment.directoryExists) {
    issues.push({
      id: 'directory-missing',
      type: 'directory',
      severity: 'error',
      title: '项目目录不可用',
      description: '目录可能已移动、删除或当前用户没有访问权限。',
      action: 'refresh'
    })
    return issues
  }
  if (environment.nodeCompatible === false) {
    issues.push({
      id: 'node-incompatible',
      type: 'node',
      severity: 'error',
      title: 'Node 版本不兼容',
      description: `当前 ${environment.currentNodeVersion || '未检测到'}，项目要求 ${environment.nodeRequirement}。`,
      action: 'open-node'
    })
  }
  if (environment.packageManager && !environment.packageManagerAvailable) {
    issues.push({
      id: 'package-manager-missing',
      type: 'package-manager',
      severity: 'error',
      title: `缺少 ${environment.packageManager}`,
      description: '项目声明的包管理器当前不可用，无法安装依赖或运行脚本。',
      action: 'open-node'
    })
  }
  if (environment.lockfileState === 'mismatch') {
    issues.push({
      id: 'lockfile-mismatch',
      type: 'lockfile',
      severity: 'warning',
      title: '包管理器与锁文件不一致',
      description: `项目声明 ${environment.packageManager}，但检测到 ${environment.lockfileType} 锁文件。`
    })
  } else if (project.hasPackageJson && environment.lockfileState === 'missing') {
    issues.push({
      id: 'lockfile-missing',
      type: 'lockfile',
      severity: 'info',
      title: '项目没有锁文件',
      description: '建议提交锁文件，以确保不同环境安装出一致依赖。'
    })
  }
  if (project.hasPackageJson && environment.dependencyState === 'missing') {
    issues.push({
      id: 'dependencies-missing',
      type: 'dependency',
      severity: 'warning',
      title: '项目依赖尚未安装',
      description: '未检测到 node_modules，可以在当前项目中直接安装依赖。',
      action: 'install-dependencies'
    })
  }
  if (git.error) {
    issues.push({
      id: 'git-unavailable',
      type: 'git',
      severity: 'warning',
      title: 'Git 状态不可用',
      description: git.error,
      action: 'open-git'
    })
  }
  return issues
}

export function listProjectTasks(projectId?: string): ProjectTask[] {
  return [...projectTasks.values()]
    .filter((task) => !projectId || task.projectId === projectId)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
}

async function buildProjectDetail(project: Project, workspace: Workspace): Promise<ProjectDetail> {
  const [packageSnapshot, currentNodeVersion, metadata, identities, gitSnapshot, remote] =
    await Promise.all([
      readPackageSnapshot(project.path),
      readCurrentNodeVersion(),
      lstat(project.path).catch(() => undefined),
      store.gitIdentities.read(),
      readGitStatus(project.path),
      readProjectRemote(project.path)
    ])
  const directoryExists = Boolean(metadata?.isDirectory())
  const gitIdentity = identities.find((identity) => identity.id === workspace.gitIdentityId)
  const packageManagerAvailable = packageSnapshot.packageManager
    ? Boolean(await commandVersion(packageSnapshot.packageManager))
    : false
  const nextProject = {
    ...project,
    ...gitSnapshot,
    remote,
    packageName: packageSnapshot.packageName,
    packageVersion: packageSnapshot.packageVersion,
    packageManager: packageSnapshot.packageManager,
    nodeRequirement: packageSnapshot.nodeRequirement,
    hasPackageJson: packageSnapshot.hasPackageJson,
    dependencyState: packageSnapshot.dependencyState,
    lockfileType: packageSnapshot.lockfileType,
    lockfileState: packageSnapshot.lockfileState,
    scriptCount: packageSnapshot.scripts.length,
    directoryExists
  }
  const environment: ProjectDetail['environment'] = {
    directoryExists,
    currentNodeVersion,
    nodeSource: packageSnapshot.nodeSource,
    nodeRequirement: packageSnapshot.nodeRequirement,
    nodeRequirementSource: packageSnapshot.nodeRequirementSource,
    nodeCompatible: isNodeRequirementSatisfied(currentNodeVersion, packageSnapshot.nodeRequirement),
    packageManager: packageSnapshot.packageManager,
    packageManagerAvailable,
    dependencyState: packageSnapshot.dependencyState,
    lockfileType: packageSnapshot.lockfileType,
    lockfileState: packageSnapshot.lockfileState
  }
  const git: ProjectDetail['git'] = {
    branch: nextProject.branch,
    remote: nextProject.remote,
    status: nextProject.gitStatus,
    dirty: Boolean(nextProject.dirty),
    changedFiles: nextProject.gitChangedFiles ?? 0,
    ahead: nextProject.gitAhead ?? 0,
    behind: nextProject.gitBehind ?? 0,
    lastCommit: nextProject.lastCommit,
    error: nextProject.gitError
  }
  return {
    project: nextProject,
    scripts: packageSnapshot.scripts,
    issues: buildProjectIssues(nextProject, environment, git),
    tasks: listProjectTasks(project.id),
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
    environment,
    git
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
  const stored = await store.workspaces.read()
  const normalized = stored.map(normalizeWorkspaceProjectHierarchy)
  if (normalized.some((item) => item.changed)) {
    const workspaces = normalized.map((item) => item.workspace)
    // 一次性持久化兼容结果，保证后续详情、移除和深链接都使用同一组项目 ID。
    await store.workspaces.write(workspaces)
    return workspaces
  }
  return stored
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
    description: optionalText(input.description, 200),
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

/** 扫描结果只平铺一级目录，识别到的下一层工程归入对应项目的 subprojects。 */
export async function scanWorkspaceDetailed(id: string): Promise<WorkspaceScanResult> {
  const existing = await store.workspaces.read()
  const workspace = existing.find((item) => item.id === id)
  if (!workspace) throw new Error('工作区不存在')
  const discovery = await discoverWorkspaceProjectPaths(workspace.rootPath).catch(() => {
    throw new Error('无法读取工作区目录，请检查路径和权限')
  })
  const discoveredProjects = await mapWithConcurrency(
    discovery.projects,
    scanConcurrency,
    (discovered) => scanDiscoveredProject(id, discovered, workspace.projects)
  )
  const discoveredPaths = new Set(
    discovery.projects.flatMap((project) => [project.path, ...project.subprojectPaths])
  )
  // 手动纳入的外部项目不在工作区一级目录中，扫描时保留并刷新其真实状态。
  const manualProjects = await mapWithConcurrency(
    workspace.projects.filter(
      (project) => project.source === 'manual' && !discoveredPaths.has(project.path)
    ),
    scanConcurrency,
    (project) => scanProjectWithSubprojects(id, project, workspace.projects)
  )
  const projects = [...discoveredProjects, ...manualProjects]
  const updated = { ...workspace, projects }
  await store.workspaces.write(existing.map((item) => (item.id === id ? updated : item)))
  const knownTopLevelPaths = new Set(
    workspace.projects.map((item) => getTopLevelProjectPath(workspace.rootPath, item.path))
  )
  const knownScannedTopLevelPaths = new Set(
    workspace.projects
      .filter((item) => item.source !== 'manual')
      .map((item) => getTopLevelProjectPath(workspace.rootPath, item.path))
  )
  const scannedTopLevelPaths = new Set(discoveredProjects.map((item) => item.path))
  return {
    workspaces: await listWorkspaces(),
    added: discoveredProjects.filter((item) => !knownTopLevelPaths.has(item.path)).length,
    removed: [...knownScannedTopLevelPaths].filter((path) => !scannedTopLevelPaths.has(path))
      .length,
    total: discovery.total,
    truncated: discovery.truncated,
    gitErrorCount: projects.filter((project) => Boolean(project.gitError)).length
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

export async function openProjectEditor(
  pathInput: string,
  editorInput: string = 'vscode'
): Promise<void> {
  const path = resolve(requiredText(pathInput, '项目路径', 1_000))
  const editor = PROJECT_EDITOR_OPTIONS.find((item) => item.id === editorInput)
  if (!editor) throw new Error('不支持指定的项目编辑器')
  const launcher = editorLaunchers[editor.id]
  try {
    if (launcher.mode === 'codex') {
      await execFileAsync(launcher.command, ['app', path], {
        env: await getUserShellEnvironment(),
        timeout: 10_000
      })
    } else if (process.platform === 'darwin') {
      await execFileAsync('open', ['-a', launcher.macApplication, path], { timeout: 10_000 })
    } else {
      await execFileAsync(launcher.command, [path], { timeout: 10_000 })
    }
  } catch {
    throw new Error(`无法使用 ${editor.label} 打开项目，请确认该编辑器已安装`)
  }
}

/** 保留项目环境详情兼容接口，调用时重新读取磁盘快照。 */
export async function getProjectDetail(
  workspaceId: string,
  projectId: string
): Promise<ProjectDetail> {
  const { workspace, project } = await findProject(workspaceId, projectId)
  const nextProject = { ...project, lastOpenedAt: new Date().toISOString() }
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

/** 单项目刷新只更新目标项目，避免用户为一次依赖安装重新扫描整个工作区。 */
export async function refreshProject(
  workspaceId: string,
  projectId: string
): Promise<ProjectDetail> {
  const { workspace, project } = await findProject(workspaceId, projectId)
  const nextProject = await scanProjectWithSubprojects(workspace.id, project, workspace.projects)
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

/** 项目备注属于用户数据，目录扫描和环境刷新均不得覆盖。 */
export async function saveProjectRemark(
  workspaceId: string,
  projectId: string,
  remarkInput: string
): Promise<Workspace[]> {
  const workspaceKey = requiredText(workspaceId, '工作区 ID', 120)
  const projectKey = requiredText(projectId, '项目 ID', 120)
  const remark = optionalText(remarkInput, 200)
  const workspaces = await store.workspaces.read()
  const workspace = workspaces.find((item) => item.id === workspaceKey)
  if (!workspace) throw new Error('工作区不存在')
  const projectExists = workspace.projects.some(
    (project) =>
      project.id === projectKey || project.subprojects?.some((item) => item.id === projectKey)
  )
  if (!projectExists) throw new Error('项目不存在，请先扫描工作区')
  await store.workspaces.write(
    workspaces.map((item) =>
      item.id === workspace.id
        ? {
            ...item,
            projects: item.projects.map((candidate) =>
              candidate.id === projectKey
                ? { ...candidate, remark }
                : {
                    ...candidate,
                    subprojects: candidate.subprojects?.map((subproject) =>
                      subproject.id === projectKey ? { ...subproject, remark } : subproject
                    )
                  }
            )
          }
        : item
    )
  )
  return listWorkspaces()
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
  const project = await scanProjectWithSubprojects(
    id,
    {
      id: createId('project'),
      workspaceId: id,
      name: basename(path),
      path,
      source: 'manual'
    },
    workspace.projects
  )
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
  const env = await getUserShellEnvironment()
  await execFileAsync(manager, ['install'], {
    cwd: project.path,
    timeout: 10 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...env, CI: '1' }
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

/** 运行器只接收已声明脚本名称，不接受渲染层传入任意命令。 */
export async function runProjectScript(
  workspaceId: string,
  projectId: string,
  scriptInput: string
): Promise<ProjectTask> {
  const script = requiredText(scriptInput, '脚本名称', 120)
  const { workspace, project } = await findProject(workspaceId, projectId)
  const detail = await buildProjectDetail(project, workspace)
  if (!detail.scripts.some((item) => item.name === script)) throw new Error('项目脚本不存在')
  const manager = detail.environment.packageManager
  if (!manager || !detail.environment.packageManagerAvailable)
    throw new Error('项目包管理器不可用，无法运行脚本')
  if (listProjectTasks(project.id).some((task) => task.status === 'running')) {
    throw new Error('该项目已有运行中的任务，请先停止后再启动')
  }

  const task: ProjectTask = {
    id: createId('project-task'),
    workspaceId: workspace.id,
    projectId: project.id,
    projectName: project.name,
    script,
    command: `${manager} run ${script}`,
    status: 'running',
    startedAt: new Date().toISOString(),
    logs: [`$ ${manager} run ${script}`]
  }
  const env = await getUserShellEnvironment()
  const child = spawn(manager, ['run', script], {
    cwd: project.path,
    env: { ...env, FORCE_COLOR: '0' },
    stdio: 'pipe'
  })
  task.pid = child.pid
  projectTasks.set(task.id, task)
  projectProcesses.set(task.id, child)
  child.stdout.on('data', (chunk: Buffer) => appendTaskLog(task, chunk.toString()))
  child.stderr.on('data', (chunk: Buffer) => appendTaskLog(task, chunk.toString()))
  child.once('error', (error) => {
    task.status = 'failed'
    task.error = `无法启动项目任务：${error.message}`
    task.finishedAt = new Date().toISOString()
    appendTaskLog(task, task.error)
    projectProcesses.delete(task.id)
    emitProjectTask(task)
  })
  child.once('close', (code) => {
    if (task.status === 'running') {
      task.status = code === 0 ? 'completed' : 'failed'
      task.exitCode = code ?? undefined
      if (code !== 0) task.error = `任务已退出，退出码 ${code ?? '未知'}`
    }
    task.finishedAt ??= new Date().toISOString()
    projectProcesses.delete(task.id)
    emitProjectTask(task)
  })
  emitProjectTask(task)
  return task
}

export async function stopProjectTask(taskIdInput: string): Promise<ProjectTask> {
  const taskId = requiredText(taskIdInput, '任务 ID', 160)
  const task = projectTasks.get(taskId)
  if (!task) throw new Error('项目任务不存在或应用已经重启')
  if (task.status !== 'running') return task
  const child = projectProcesses.get(task.id)
  task.status = 'cancelled'
  task.finishedAt = new Date().toISOString()
  appendTaskLog(task, '任务已由用户停止')
  child?.kill('SIGTERM')
  if (child) {
    const forceTimer = setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
    }, 3_000)
    forceTimer.unref()
  }
  emitProjectTask(task)
  return task
}

/** 应用退出前终止所有子进程，避免开发服务脱离工作台继续运行。 */
export function stopAllProjectTasks(): void {
  for (const [taskId, child] of projectProcesses) {
    const task = projectTasks.get(taskId)
    if (task?.status === 'running') {
      task.status = 'cancelled'
      task.finishedAt = new Date().toISOString()
    }
    child.kill('SIGTERM')
  }
  projectProcesses.clear()
}
