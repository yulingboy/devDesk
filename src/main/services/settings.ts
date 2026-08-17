import { app, dialog, shell } from 'electron'
import {
  access,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  statfs,
  writeFile
} from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  AppSettings,
  DataExport,
  DataStats,
  DialogOperationResult,
  EnvironmentCheck,
  EnvironmentCheckSnapshot,
  EnvironmentTool,
  LogStats,
  ThemeName
} from '@shared/domain'
import { isPathWithin } from './common'
import { getAppPaths } from '@main/infrastructure/paths'
import {
  getStoreDirectory,
  setStoreDirectory,
  store,
  withDataMutation
} from '@main/infrastructure/store'
import { setMinimizeToTray } from '@main/tray'
import { setLogLevel } from '@main/infrastructure/logger'
import {
  getUserShellEnvironment,
  resetUserShellEnvironment
} from '@main/infrastructure/shell-environment'
import { removeGitRuleInclude, syncGitRules } from '@main/services/git-rules'
import { listSshKeys } from '@main/services/ssh'

const execFileAsync = promisify(execFile)
const supportedThemes: ThemeName[] = [
  'blue',
  'purple',
  'green',
  'orange',
  'rose',
  'cyan',
  'indigo',
  'teal'
]

const normalizeTheme = (value: unknown): ThemeName =>
  supportedThemes.includes(value as ThemeName) ? (value as ThemeName) : 'blue'

export async function getSettings(): Promise<AppSettings> {
  const settings = await store.settings.read()
  return {
    ...settings,
    general: { ...settings.general, theme: normalizeTheme(settings.general.theme) }
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const current = await store.settings.read()
  const next: AppSettings = {
    ...settings,
    schemaVersion: 1,
    general: { ...settings.general, theme: normalizeTheme(settings.general.theme) },
    // 数据目录只能通过迁移接口修改，普通设置保存不能改变运行时存储指针。
    data: current.data,
    advanced: { ...settings.advanced, logLevel: settings.advanced.logLevel ?? 'info' },
    node: validateNodeSettings(settings.node)
  }
  await store.settings.write(next)
  app.setLoginItemSettings({ openAtLogin: next.general.launchAtLogin })
  setMinimizeToTray(next.general.minimizeToTray)
  setLogLevel(next.advanced.logLevel)
  return next
}

function validateHttpUrl(value: string, label: string): string {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.toString().replace(/\/$/, '')
  } catch {
    throw new Error(`${label}必须是有效的 HTTP 或 HTTPS 地址`)
  }
}

function validateNodeSettings(value: AppSettings['node']): AppSettings['node'] {
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(value.packageManager)) {
    throw new Error('默认包管理器无效')
  }
  return {
    indexUrl: validateHttpUrl(value.indexUrl, '版本索引'),
    downloadSource: validateHttpUrl(value.downloadSource, '下载源'),
    packageManager: value.packageManager,
    registry: validateHttpUrl(value.registry, 'Registry')
  }
}

export async function resetSettings(): Promise<AppSettings> {
  const current = await store.settings.read()
  return saveSettings({
    ...current,
    general: { theme: 'blue', launchAtLogin: false, minimizeToTray: false },
    advanced: { logLevel: 'info', developerTools: false }
  })
}

export function exportSettings(): Promise<DataExport> {
  return store.exportData()
}

export async function exportSettingsFile(): Promise<DialogOperationResult> {
  const result = await dialog.showSaveDialog({
    title: '导出开发工坊数据',
    defaultPath: 'env-tool-backup.json',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { cancelled: true }
  await writeFile(result.filePath, `${JSON.stringify(await store.exportData(), null, 2)}\n`, 'utf8')
  return { cancelled: false }
}

export async function importSettings(data: DataExport): Promise<AppSettings> {
  return withDataMutation(async () => {
    await store.importData(data)
    await syncGitRules()
    resetUserShellEnvironment()
    return saveSettings(await store.settings.read())
  })
}

export async function importSettingsFile(): Promise<DialogOperationResult<AppSettings>> {
  const result = await dialog.showOpenDialog({
    title: '导入开发工坊数据',
    properties: ['openFile'],
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePaths[0]) return { cancelled: true }
  let data: DataExport
  try {
    data = JSON.parse(await readFile(result.filePaths[0], 'utf8')) as DataExport
  } catch {
    throw new Error('备份文件不是有效的 JSON，请重新选择导出的备份文件')
  }
  return { cancelled: false, value: await importSettings(data) }
}

export async function openDataDirectory(): Promise<void> {
  const settings = await getSettings()
  const error = await shell.openPath(settings.data.directory || getAppPaths().data)
  if (error) throw new Error(`无法打开数据目录：${error}`)
}

/** 先复制完整数据，再更新设置和运行时目录，避免迁移中断造成半切换。 */
export async function changeDataDirectory(): Promise<DialogOperationResult<AppSettings>> {
  const current = await getSettings()
  const result = await dialog.showOpenDialog({
    title: '选择新的数据目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return { cancelled: true }
  const source = resolve(getStoreDirectory())
  const target = resolve(result.filePaths[0])
  if (target === source) return { cancelled: true }
  if (isPathWithin(source, target)) {
    throw new Error('新数据目录不能位于当前数据目录内部')
  }
  if (isPathWithin(target, source)) {
    throw new Error('新数据目录不能包含当前数据目录')
  }
  const businessFiles = [
    'hosts.json',
    'ssh-keys.json',
    'git-configs.json',
    'workspaces.json',
    'templates.json',
    'hosts.backup',
    'system-overview-snapshot.json',
    'node-manager.json',
    'node-releases.json',
    'git-rules',
    'environment-check.json'
  ]
  return withDataMutation(async () => {
    await mkdir(target, { recursive: true })
    await access(target, constants.R_OK | constants.W_OK).catch(() => {
      throw new Error('目标目录不可读写，请重新选择目录或检查权限')
    })
    const [sourceStats, targetFileSystem] = await Promise.all([
      directoryStats(source),
      statfs(target)
    ])
    const availableBytes = targetFileSystem.bavail * targetFileSystem.bsize
    if (availableBytes < sourceStats.sizeBytes + 10 * 1024 * 1024) {
      throw new Error('目标磁盘剩余空间不足，请至少预留数据大小之外的 10 MB 空间')
    }
    const conflicts = (
      await Promise.all(
        businessFiles.map(async (fileName) =>
          (await lstat(join(target, fileName)).catch(() => undefined)) ? fileName : undefined
        )
      )
    ).filter((fileName): fileName is string => Boolean(fileName))
    if (conflicts.length) {
      throw new Error(`目标目录已包含工作台数据：${conflicts.slice(0, 3).join('、')}`)
    }

    const staging = join(target, `.env-tool-migration-${Date.now()}-${process.pid}`)
    const moved: string[] = []
    try {
      await mkdir(staging, { recursive: true })
      await Promise.all(
        businessFiles.map((fileName) =>
          cp(join(source, fileName), join(staging, fileName), { recursive: true }).catch(
            (error: unknown) => {
              if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
              throw error
            }
          )
        )
      )
      for (const fileName of await readdir(staging)) {
        await rename(join(staging, fileName), join(target, fileName))
        moved.push(fileName)
      }
      const next = { ...current, data: { directory: target } }
      await removeGitRuleInclude(join(source, 'git-rules', 'workspace-rules.inc'))
      setStoreDirectory(target)
      try {
        await syncGitRules()
        await store.settings.write(next)
      } catch (error) {
        setStoreDirectory(source)
        await syncGitRules().catch(() => undefined)
        throw error
      }
      return { cancelled: false, value: next }
    } catch (error) {
      setStoreDirectory(source)
      await Promise.all(
        moved.map((fileName) => rm(join(target, fileName), { recursive: true, force: true }))
      )
      throw new Error(
        `数据目录迁移失败，原目录未改变：${error instanceof Error ? error.message : '未知错误'}`
      )
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined)
    }
  })
}

export async function clearBusinessData(): Promise<AppSettings> {
  return withDataMutation(async () => {
    await store.hosts.write([])
    await store.sshKeys.write([])
    await store.gitIdentities.write([])
    await store.workspaces.write([])
    await store.templates.write([])
    await syncGitRules()
    return store.settings.read()
  })
}

async function directoryStats(
  path: string,
  budget: { entries: number; scanned: number; truncated: boolean; errors: string[] } = {
    entries: 20_000,
    scanned: 0,
    truncated: false,
    errors: []
  },
  depth = 0
): Promise<{ sizeBytes: number; fileCount: number }> {
  const metadata = await lstat(path).catch((error: unknown) => {
    budget.errors.push(error instanceof Error ? error.message : '无法读取目录')
    return undefined
  })
  if (!metadata) return { sizeBytes: 0, fileCount: 0 }
  budget.scanned += 1
  if (!metadata.isDirectory()) return { sizeBytes: metadata.size, fileCount: 1 }
  if (budget.entries-- <= 0 || depth >= 24) {
    budget.truncated = true
    return { sizeBytes: 0, fileCount: 0 }
  }
  const entries = await readdir(path, { withFileTypes: true }).catch((error: unknown) => {
    budget.errors.push(error instanceof Error ? error.message : '无法读取目录')
    return []
  })
  if (entries.length > 1_000) budget.truncated = true
  const children = await Promise.all(
    entries.slice(0, 1_000).map(async (entry) => {
      if (entry.isSymbolicLink()) return { sizeBytes: 0, fileCount: 0 }
      return directoryStats(join(path, entry.name), budget, depth + 1)
    })
  )
  return children.reduce(
    (total, item) => ({
      sizeBytes: total.sizeBytes + item.sizeBytes,
      fileCount: total.fileCount + item.fileCount
    }),
    { sizeBytes: 0, fileCount: 0 }
  )
}

/** 统计数据目录和主要业务对象，单项失败时使用安全默认值。 */
export async function getDataStats(): Promise<DataStats> {
  const directory = getStoreDirectory()
  const budget = { entries: 20_000, scanned: 0, truncated: false, errors: [] as string[] }
  const [stats, identities, workspaces, keys] = await Promise.all([
    directoryStats(directory, budget),
    store.gitIdentities.read().catch(() => []),
    store.workspaces.read().catch(() => []),
    listSshKeys().catch(() => [])
  ])
  return {
    directory,
    ...stats,
    gitIdentityCount: identities.length,
    workspaceCount: workspaces.length,
    sshKeyCount: keys.length,
    scannedEntries: budget.scanned,
    truncated: budget.truncated,
    updatedAt: new Date().toISOString(),
    error: budget.errors[0]
  }
}

export async function getLogStats(): Promise<LogStats> {
  const directory = getAppPaths().logs
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const sizes = await Promise.all(
    entries.filter((entry) => entry.isFile()).map((entry) => stat(join(directory, entry.name)))
  )
  return {
    directory,
    fileCount: sizes.length,
    sizeBytes: sizes.reduce((total, item) => total + item.size, 0)
  }
}

export async function openLogDirectory(): Promise<void> {
  const error = await shell.openPath(getAppPaths().logs)
  if (error) throw new Error(`无法打开日志目录：${error}`)
}

export async function clearLogArchives(): Promise<LogStats> {
  const directory = getAppPaths().logs
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name !== 'main.log')
      .map((entry) => rm(join(directory, entry.name), { force: true }))
  )
  return getLogStats()
}

type EnvironmentCommand = {
  id: string
  name: string
  group: EnvironmentTool['group']
  command: string
  args: string[]
  daemon?: boolean
}

const environmentCommands: EnvironmentCommand[] = [
  { id: 'git', name: 'Git', group: 'base', command: 'git', args: ['--version'] },
  { id: 'ssh', name: 'OpenSSH', group: 'base', command: 'ssh', args: ['-V'] },
  { id: 'node', name: 'Node.js', group: 'node', command: 'node', args: ['--version'] },
  { id: 'npm', name: 'npm', group: 'node', command: 'npm', args: ['--version'] },
  { id: 'pnpm', name: 'pnpm', group: 'node', command: 'pnpm', args: ['--version'] },
  { id: 'yarn', name: 'Yarn', group: 'node', command: 'yarn', args: ['--version'] },
  { id: 'bun', name: 'Bun', group: 'node', command: 'bun', args: ['--version'] },
  { id: 'corepack', name: 'Corepack', group: 'node', command: 'corepack', args: ['--version'] },
  { id: 'java', name: 'Java', group: 'java', command: 'java', args: ['-version'] },
  { id: 'javac', name: 'Java 编译器', group: 'java', command: 'javac', args: ['-version'] },
  { id: 'maven', name: 'Maven', group: 'java', command: 'mvn', args: ['--version'] },
  { id: 'gradle', name: 'Gradle', group: 'java', command: 'gradle', args: ['--version'] },
  { id: 'python', name: 'Python', group: 'python', command: 'python3', args: ['--version'] },
  { id: 'pip', name: 'pip', group: 'python', command: 'pip3', args: ['--version'] },
  { id: 'uv', name: 'uv', group: 'python', command: 'uv', args: ['--version'] },
  { id: 'poetry', name: 'Poetry', group: 'python', command: 'poetry', args: ['--version'] },
  { id: 'go', name: 'Go', group: 'go', command: 'go', args: ['version'] },
  { id: 'docker', name: 'Docker CLI', group: 'container', command: 'docker', args: ['--version'] },
  {
    id: 'docker-daemon',
    name: 'Docker 服务',
    group: 'container',
    command: 'docker',
    args: ['info', '--format', '{{.ServerVersion}}'],
    daemon: true
  }
]

const environmentGuides: Record<string, string> = {
  git: 'https://git-scm.com/downloads',
  node: 'https://nodejs.org/zh-cn/download',
  npm: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm',
  pnpm: 'https://pnpm.io/zh/installation',
  yarn: 'https://yarnpkg.com/getting-started/install',
  corepack: 'https://nodejs.org/api/corepack.html',
  java: 'https://adoptium.net/zh-CN/temurin/releases/',
  javac: 'https://adoptium.net/zh-CN/temurin/releases/',
  maven: 'https://maven.apache.org/install.html',
  gradle: 'https://gradle.org/install/',
  bun: 'https://bun.sh/docs/installation',
  ssh: 'https://www.openssh.com/',
  python: 'https://www.python.org/downloads/',
  pip: 'https://pip.pypa.io/en/stable/installation/',
  uv: 'https://docs.astral.sh/uv/getting-started/installation/',
  poetry: 'https://python-poetry.org/docs/#installation',
  go: 'https://go.dev/doc/install',
  docker: 'https://docs.docker.com/desktop/setup/install/mac-install/',
  'docker-daemon': 'https://docs.docker.com/desktop/'
}

const autoInstallCommands: Record<string, { command: string; args: string[] }> = {
  pnpm: { command: 'npm', args: ['install', '-g', 'pnpm'] },
  yarn: { command: 'corepack', args: ['prepare', 'yarn@stable', '--activate'] }
}

/** 工具能力由主进程定义，渲染层不能自行拼接任意安装命令。 */
export function listEnvironmentTools(): EnvironmentTool[] {
  return environmentCommands.map((item) => ({
    id: item.id,
    name: item.name,
    group: item.group,
    command: `${item.command} ${item.args.join(' ')}`,
    installable: Boolean(autoInstallCommands[item.id]),
    installCommand: autoInstallCommands[item.id]
      ? `${autoInstallCommands[item.id].command} ${autoInstallCommands[item.id].args.join(' ')}`
      : undefined,
    prerequisite:
      item.id === 'pnpm' ? '需要 npm 可用' : item.id === 'yarn' ? '需要 Corepack 可用' : undefined,
    guideUrl: environmentGuides[item.id]
  }))
}

/** 缺失工具只打开官方安装指引，避免未经确认执行远程 shell 脚本。 */
export async function openEnvironmentGuide(id: string): Promise<void> {
  const url = environmentGuides[id]
  if (!url) throw new Error('暂无该工具的安装指引')
  await shell.openExternal(url)
}

/** 仅允许执行审查过的本地安装命令，其他工具必须走官方安装说明。 */
export async function installEnvironmentTool(id: string): Promise<EnvironmentCheck> {
  const tool = environmentCommands.find((item) => item.id === id)
  const installer = autoInstallCommands[id]
  if (!tool) throw new Error('未知的环境工具')
  if (!installer) throw new Error(`${tool.name} 不支持自动安装，请使用官方安装指引`)
  try {
    const env = await getUserShellEnvironment()
    await execFileAsync(installer.command, installer.args, {
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...env, CI: '1', npm_config_yes: 'true' }
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : '安装命令执行失败'
    throw new Error(`${tool.name} 安装失败，请检查网络、权限和运行时环境：${detail}`)
  }
  let result: EnvironmentCheck
  try {
    resetUserShellEnvironment()
    const { stdout, stderr } = await execFileAsync(tool.command, tool.args, {
      timeout: 10_000,
      env: await getUserShellEnvironment()
    })
    const detail = `${stdout}${stderr}`.trim()
    result = {
      id: tool.id,
      name: tool.name,
      command: `${tool.command} ${tool.args.join(' ')}`,
      status: 'passed',
      version: detail.split('\n')[0],
      detail,
      checkedAt: new Date().toISOString()
    }
  } catch {
    throw new Error(`${tool.name} 安装完成，但当前进程仍未检测到该命令，请重启应用后重试`)
  }
  await persistEnvironmentCheck(result)
  return result
}

/** 逐项执行常见开发工具检测，并保留原始输出用于排障。 */
export async function runEnvironmentCheck(
  shouldStop: () => boolean = () => false,
  onUpdated?: (results: EnvironmentCheck[]) => void,
  onProcess?: (process: ChildProcess | undefined) => void,
  commands: EnvironmentCommand[] = environmentCommands,
  persist = true
): Promise<EnvironmentCheck[]> {
  const results: EnvironmentCheck[] = []
  for (const [index, item] of commands.entries()) {
    if (shouldStop()) {
      const skipped = commands.slice(index).map((remaining) => ({
        id: remaining.id,
        name: remaining.name,
        command: `${remaining.command} ${remaining.args.join(' ')}`,
        status: 'skipped' as const,
        detail: '用户已停止后续检测',
        checkedAt: new Date().toISOString()
      }))
      results.push(...skipped)
      onUpdated?.([...results])
      break
    }
    try {
      const env = await getUserShellEnvironment()
      const { stdout, stderr, cancelled } = await runEnvironmentCommand(
        item.command,
        item.args,
        env,
        shouldStop,
        onProcess
      )
      const detail = `${stdout}${stderr}`.trim()
      if (cancelled) {
        results.push({
          id: item.id,
          name: item.name,
          command: `${item.command} ${item.args.join(' ')}`,
          status: 'cancelled',
          detail: '用户已停止当前检测',
          checkedAt: new Date().toISOString()
        })
        const skipped = commands.slice(index + 1).map((remaining) => ({
          id: remaining.id,
          name: remaining.name,
          command: `${remaining.command} ${remaining.args.join(' ')}`,
          status: 'skipped' as const,
          detail: '用户已停止后续检测',
          checkedAt: new Date().toISOString()
        }))
        results.push(...skipped)
        onUpdated?.([...results])
        break
      }
      results.push({
        id: item.id,
        name: item.name,
        command: `${item.command} ${item.args.join(' ')}`,
        status: 'passed',
        version: detail.split('\n')[0],
        detail,
        checkedAt: new Date().toISOString()
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : '检测命令执行失败'
      results.push({
        id: item.id,
        name: item.name,
        command: `${item.command} ${item.args.join(' ')}`,
        status: classifyEnvironmentFailure(error, item),
        detail,
        checkedAt: new Date().toISOString()
      })
    }
    // 每项完成就推送快照，页面不必等待全部命令结束。
    onUpdated?.([...results])
  }
  if (persist) {
    await store.environmentCheck.write({ checkedAt: new Date().toISOString(), checks: results })
  }
  return results
}

function classifyEnvironmentFailure(
  error: unknown,
  item: EnvironmentCommand
): EnvironmentCheck['status'] {
  const code = error instanceof Error && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (code === 'ENOENT' || message.includes('enoent')) return 'missing'
  if (code === 'EACCES' || message.includes('permission denied')) return 'permission-denied'
  if (message.includes('命令执行超时')) return 'timeout'
  if (item.daemon) return 'daemon-unavailable'
  return 'failed'
}

export function getEnvironmentCheckSnapshot(): Promise<EnvironmentCheckSnapshot | null> {
  return store.environmentCheck.read()
}

export async function checkEnvironmentTool(id: string): Promise<EnvironmentCheck> {
  const tool = environmentCommands.find((item) => item.id === id)
  if (!tool) throw new Error('未知的环境工具')
  const [result] = await runEnvironmentCheck(() => false, undefined, undefined, [tool], false)
  if (!result) throw new Error('环境检测没有返回结果')
  await persistEnvironmentCheck(result)
  return result
}

async function persistEnvironmentCheck(result: EnvironmentCheck): Promise<void> {
  const previous = await store.environmentCheck.read()
  const checks = environmentCommands
    .map((item) =>
      item.id === result.id ? result : previous?.checks.find((check) => check.id === item.id)
    )
    .filter((item): item is EnvironmentCheck => Boolean(item))
  await store.environmentCheck.write({ checkedAt: new Date().toISOString(), checks })
}

/** 使用可终止的子进程执行检测，避免停止按钮只能阻止下一项而无法终止当前命令。 */
async function runEnvironmentCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  shouldStop: () => boolean,
  onProcess?: (process: ChildProcess | undefined) => void
): Promise<{ stdout: string; stderr: string; cancelled: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, 10_000)
    onProcess?.(child)
    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout = `${stdout}${chunk}`.slice(-1024 * 1024)
    })
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr = `${stderr}${chunk}`.slice(-1024 * 1024)
    })
    child.once('error', (error) => {
      clearTimeout(timeout)
      onProcess?.(undefined)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timeout)
      onProcess?.(undefined)
      if (shouldStop() && !timedOut) {
        resolve({ stdout, stderr, cancelled: true })
        return
      }
      if (code === 0 && !timedOut) {
        resolve({ stdout, stderr, cancelled: false })
        return
      }
      const suffix = timedOut ? '命令执行超时' : `进程退出（${signal ?? code ?? '未知'}）`
      reject(new Error(stderr.trim() || suffix))
    })
  })
}
