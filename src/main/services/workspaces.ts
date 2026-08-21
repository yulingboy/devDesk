import { lstat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { shell } from 'electron'
import { PROJECT_EDITOR_OPTIONS, type ProjectEditorId } from '@shared/domain'
import type { Project, Workspace, WorkspaceScanResult, WorkspaceSubproject } from '@shared/domain'
import { store, withDataMutation } from '@main/infrastructure/store'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
import { createId, entityId, optionalText, requiredText } from './common'
import { syncGitRules } from './git-rules'
import { discoverWorkspaceProjectPaths } from './workspace-discovery'
import { getTopLevelProjectPath, normalizeWorkspaceProjectHierarchy } from './workspace-hierarchy'
import { scanDiscoveredProject, scanProjectWithSubprojects } from './workspace-scanner'

const execFileAsync = promisify(execFile)
const scanConcurrency = 6
const scanTokens = new Map<string, { cancelled: boolean }>()

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

function normalizeWorkspace(workspace: Workspace): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    rootPath: workspace.rootPath,
    description: workspace.description ?? '',
    gitIdentityId: workspace.gitIdentityId,
    scanDepth: Math.min(5, Math.max(1, Math.trunc(workspace.scanDepth ?? 3))),
    ignoredDirectories: Array.isArray(workspace.ignoredDirectories)
      ? [...new Set(workspace.ignoredDirectories.filter((item) => typeof item === 'string'))]
      : [],
    projects: workspace.projects.map((project) => ({
      id: project.id,
      workspaceId: workspace.id,
      name: project.name,
      path: project.path,
      source: project.source,
      branch: project.branch,
      dirty: project.dirty,
      gitError: project.gitError,
      gitStatus: project.gitStatus,
      lastScannedAt: project.lastScannedAt,
      directoryExists: project.directoryExists,
      remark: project.remark,
      subprojects: project.subprojects?.map((item) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        source: item.source,
        remark: item.remark,
        directoryExists: item.directoryExists,
        lastScannedAt: item.lastScannedAt
      }))
    }))
  }
}

async function findProject(
  workspaceId: string,
  projectId: string
): Promise<{
  workspace: Workspace
  project: Project | WorkspaceSubproject
}> {
  const id = requiredText(workspaceId, '工作区 ID', 120)
  const projectKey = requiredText(projectId, '项目 ID', 120)
  return findWorkspaceProject(await store.workspaces.read(), id, projectKey)
}

/** 只按持久化 ID 解析项目路径，不接受渲染层传入的文件系统路径。 */
export function findWorkspaceProject(
  workspaces: Workspace[],
  workspaceId: string,
  projectId: string
): { workspace: Workspace; project: Project | WorkspaceSubproject } {
  const workspace = workspaces.find((item) => item.id === workspaceId)
  if (!workspace) throw new Error('工作区不存在')
  const project = workspace.projects.find((item) => item.id === projectId)
  const subproject = workspace.projects
    .flatMap((item) => item.subprojects ?? [])
    .find((item) => item.id === projectId)
  if (!project && !subproject) throw new Error('项目不存在，请先扫描工作区')
  return { workspace, project: project ?? subproject! }
}

function sameScanConfiguration(left: Workspace, right: Workspace): boolean {
  return (
    resolve(left.rootPath) === resolve(right.rootPath) &&
    (left.scanDepth ?? 3) === (right.scanDepth ?? 3) &&
    JSON.stringify(left.ignoredDirectories ?? []) === JSON.stringify(right.ignoredDirectories ?? [])
  )
}

/** 扫描只更新磁盘派生信息；扫描期间用户填写的备注、ID 和手动记录以最新数据为准。 */
export function mergeScannedProject(scanned: Project, latest?: Project): Project {
  if (!latest) return scanned
  const latestSubprojects = new Map(
    (latest.subprojects ?? []).map((item) => [resolve(item.path), item])
  )
  const subprojects = (scanned.subprojects ?? []).map((item) => {
    const current = latestSubprojects.get(resolve(item.path))
    if (!current) return item
    latestSubprojects.delete(resolve(item.path))
    return {
      ...item,
      id: current.id,
      source: current.source ?? item.source,
      remark: current.remark
    }
  })
  // 扫描过程中由模板创建的子项目尚未出现在发现结果中，必须保留到下次扫描。
  for (const item of latestSubprojects.values()) {
    if (item.source === 'created') subprojects.push(item)
  }
  return {
    ...scanned,
    id: latest.id,
    source: latest.source ?? scanned.source,
    remark: latest.remark,
    subprojects
  }
}

export function mergeWorkspaceScanResults(
  latestWorkspace: Workspace,
  discoveredProjects: Project[],
  manualProjects: Project[]
): Project[] {
  const latestByPath = new Map(latestWorkspace.projects.map((item) => [resolve(item.path), item]))
  const mergedDiscovered = discoveredProjects.map((item) =>
    mergeScannedProject(item, latestByPath.get(resolve(item.path)))
  )
  const discoveredPaths = new Set(mergedDiscovered.map((item) => resolve(item.path)))
  const scannedManualByPath = new Map(manualProjects.map((item) => [resolve(item.path), item]))
  const mergedManual = latestWorkspace.projects
    .filter((item) => item.source === 'manual' && !discoveredPaths.has(resolve(item.path)))
    .map((item) => {
      const scanned = scannedManualByPath.get(resolve(item.path))
      return scanned ? mergeScannedProject(scanned, item) : item
    })
  return [...mergedDiscovered, ...mergedManual]
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
  return withDataMutation(async () => {
    const stored = await store.workspaces.read()
    const normalized = stored.map(normalizeWorkspaceProjectHierarchy)
    const workspaces = normalized.map((item) => normalizeWorkspace(item.workspace))
    if (
      normalized.some((item) => item.changed) ||
      JSON.stringify(workspaces) !== JSON.stringify(stored)
    ) {
      // 一次性持久化兼容结果，保证后续详情、移除和深链接都使用同一组项目 ID。
      await store.workspaces.write(workspaces)
      return workspaces
    }
    return stored
  })
}

export async function saveWorkspace(input: Workspace): Promise<Workspace[]> {
  const name = requiredText(input.name, '工作区名称', 80)
  const rootPath = resolve(requiredText(input.rootPath, '工作区目录', 1_000))
  const metadata = await lstat(rootPath).catch(() => undefined)
  if (!metadata?.isDirectory()) throw new Error('工作区目录不存在或不是有效目录')
  await withDataMutation(async () => {
    const existing = await store.workspaces.read()
    if (input.id && !existing.some((item) => item.id === input.id)) throw new Error('工作区不存在')
    if (
      input.gitIdentityId &&
      !(await store.gitIdentities.read()).some((item) => item.id === input.gitIdentityId)
    )
      throw new Error('关联的 Git 身份不存在')
    if (
      existing.some(
        (item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== input.id
      )
    )
      throw new Error(`工作区名称重复：${name}`)
    if (existing.some((item) => resolve(item.rootPath) === rootPath && item.id !== input.id))
      throw new Error('工作区目录已被使用')
    const workspace: Workspace = {
      ...input,
      id: input.id ? entityId(input.id, '工作区 ID') : createId('workspace'),
      name,
      rootPath,
      description: optionalText(input.description, 200),
      scanDepth: Math.min(5, Math.max(1, Math.trunc(input.scanDepth ?? 3))),
      ignoredDirectories: [
        ...new Set(
          (input.ignoredDirectories ?? []).map((item) => optionalText(item, 80)).filter(Boolean)
        )
      ],
      // 项目清单只能由扫描流程刷新；编辑工作区元数据不能覆盖既有扫描结果。
      projects: existing.find((item) => item.id === input.id)?.projects ?? []
    }
    await store.workspaces.write([
      ...existing.filter((item) => item.id !== workspace.id),
      workspace
    ])
    try {
      await syncGitRules()
    } catch (error) {
      await store.workspaces.write(existing)
      await syncGitRules().catch(() => undefined)
      throw new Error(
        `Git 工作区规则同步失败，工作区修改已撤销：${error instanceof Error ? error.message : '未知错误'}`
      )
    }
  })
  return listWorkspaces()
}

export async function removeWorkspace(id: string): Promise<Workspace[]> {
  await withDataMutation(async () => {
    const existing = await store.workspaces.read()
    if (!existing.some((item) => item.id === id)) throw new Error('工作区不存在')
    await store.workspaces.write(existing.filter((item) => item.id !== id))
    try {
      await syncGitRules()
    } catch (error) {
      await store.workspaces.write(existing)
      await syncGitRules().catch(() => undefined)
      throw new Error(
        `Git 工作区规则同步失败，删除操作已撤销：${error instanceof Error ? error.message : '未知错误'}`
      )
    }
  })
  return listWorkspaces()
}

export async function scanWorkspace(id: string): Promise<Workspace[]> {
  return (await scanWorkspaceDetailed(id)).workspaces
}

/** 扫描结果只平铺一级目录，识别到的下一层工程归入对应项目的 subprojects。 */
export async function scanWorkspaceDetailed(id: string): Promise<WorkspaceScanResult> {
  if (scanTokens.has(id)) throw new Error('当前工作区正在扫描中')
  const token = { cancelled: false }
  scanTokens.set(id, token)
  try {
    const existing = await store.workspaces.read()
    const workspace = existing.find((item) => item.id === id)
    if (!workspace) throw new Error('工作区不存在')
    const discovery = await discoverWorkspaceProjectPaths(
      workspace.rootPath,
      500,
      200,
      workspace.scanDepth ?? 3,
      workspace.ignoredDirectories ?? [],
      () => token.cancelled
    ).catch(() => {
      throw new Error('无法读取工作区目录，请检查路径和权限')
    })
    const discoveredProjects = await mapWithConcurrency(
      discovery.projects,
      scanConcurrency,
      async (discovered) =>
        token.cancelled
          ? (workspace.projects.find((project) => project.path === discovered.path) ?? {
              id: createId('project'),
              workspaceId: id,
              name: basename(discovered.path),
              path: discovered.path
            })
          : scanDiscoveredProject(id, discovered, workspace.projects)
    )
    if (token.cancelled) {
      return {
        workspaces: await listWorkspaces(),
        added: 0,
        removed: 0,
        total: discovery.total,
        truncated: discovery.truncated,
        gitErrorCount: 0,
        cancelled: true
      }
    }
    const discoveredPaths = new Set(
      discovery.projects.flatMap((project) => [project.path, ...project.subprojectPaths])
    )
    // 手动纳入的外部项目不在工作区一级目录中，扫描时保留并刷新其真实状态。
    const manualProjects = await mapWithConcurrency(
      workspace.projects.filter(
        (project) => project.source === 'manual' && !discoveredPaths.has(project.path)
      ),
      scanConcurrency,
      (project) =>
        scanProjectWithSubprojects(
          id,
          project,
          workspace.projects,
          workspace.scanDepth ?? 3,
          workspace.ignoredDirectories ?? []
        )
    )
    const projects = await withDataMutation(async () => {
      const latestWorkspaces = await store.workspaces.read()
      const latestWorkspace = latestWorkspaces.find((item) => item.id === id)
      if (!latestWorkspace) throw new Error('扫描期间工作区已被删除，扫描结果未保存')
      if (!sameScanConfiguration(workspace, latestWorkspace)) {
        throw new Error('扫描期间工作区配置已变化，请重新扫描')
      }
      const nextProjects = mergeWorkspaceScanResults(
        latestWorkspace,
        discoveredProjects,
        manualProjects
      )
      await store.workspaces.write(
        latestWorkspaces.map((item) =>
          item.id === id ? { ...latestWorkspace, projects: nextProjects } : item
        )
      )
      return nextProjects
    })
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
  } finally {
    scanTokens.delete(id)
  }
}

export function cancelWorkspaceScan(id: string): void {
  const token = scanTokens.get(id)
  if (token) token.cancelled = true
}

export async function openWorkspace(id: string): Promise<void> {
  const workspace = (await store.workspaces.read()).find((item) => item.id === id)
  if (!workspace) throw new Error('工作区不存在')
  const error = await shell.openPath(workspace.rootPath)
  if (error) throw new Error(`无法打开工作区目录：${error}`)
}

export async function openProject(workspaceId: string, projectId: string): Promise<void> {
  const { project } = await findProject(workspaceId, projectId)
  const error = await shell.openPath(resolve(project.path))
  if (error) throw new Error(`无法打开项目目录：${error}`)
}

export async function openProjectEditor(
  workspaceId: string,
  projectId: string,
  editorInput: string = 'vscode'
): Promise<void> {
  const { project } = await findProject(workspaceId, projectId)
  const path = resolve(project.path)
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

/** 项目备注属于用户数据，目录扫描和环境刷新均不得覆盖。 */
export async function saveProjectRemark(
  workspaceId: string,
  projectId: string,
  remarkInput: string
): Promise<Workspace[]> {
  const workspaceKey = requiredText(workspaceId, '工作区 ID', 120)
  const projectKey = requiredText(projectId, '项目 ID', 120)
  const remark = optionalText(remarkInput, 200)
  await withDataMutation(async () => {
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
  })
  return listWorkspaces()
}

/** 手动纳入项目只写应用内工作区记录，不移动、复制或删除用户磁盘文件。 */
export async function addProjectToWorkspace(
  workspaceId: string,
  pathInput: string
): Promise<Workspace[]> {
  const id = requiredText(workspaceId, '工作区 ID', 120)
  const path = resolve(requiredText(pathInput, '项目目录', 1_000))
  const workspace = (await store.workspaces.read()).find((item) => item.id === id)
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
    workspace.projects,
    workspace.scanDepth ?? 3,
    workspace.ignoredDirectories ?? []
  )
  await withDataMutation(async () => {
    const latest = await store.workspaces.read()
    const current = latest.find((item) => item.id === id)
    if (!current) throw new Error('扫描项目期间工作区已被删除')
    if (current.projects.some((item) => resolve(item.path) === path))
      throw new Error('该目录已在当前工作区中')
    await store.workspaces.write(
      latest.map((item) =>
        item.id === id ? { ...item, projects: [...item.projects, project] } : item
      )
    )
  })
  return listWorkspaces()
}

/** 从工作区移除项目只删除应用内引用，项目目录与 Git 仓库均保持原样。 */
export async function removeProjectFromWorkspace(
  workspaceId: string,
  projectId: string
): Promise<Workspace[]> {
  const workspaceKey = requiredText(workspaceId, '工作区 ID', 120)
  const projectKey = requiredText(projectId, '项目 ID', 120)
  await withDataMutation(async () => {
    const workspaces = await store.workspaces.read()
    const workspace = workspaces.find((item) => item.id === workspaceKey)
    if (!workspace) throw new Error('工作区不存在')
    if (!workspace.projects.some((item) => item.id === projectKey))
      throw new Error('只能从工作区移除一级项目')
    await store.workspaces.write(
      workspaces.map((item) =>
        item.id === workspace.id
          ? { ...item, projects: item.projects.filter((candidate) => candidate.id !== projectKey) }
          : item
      )
    )
  })
  return listWorkspaces()
}
