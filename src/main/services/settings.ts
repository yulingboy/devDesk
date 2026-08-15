import { app, dialog, shell } from 'electron'
import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AppSettings, DataExport, ThemeName } from '@shared/domain'
import type { DataStats, EnvironmentCheck } from '@shared/domain'
import { getAppPaths } from '@main/infrastructure/paths'
import { getStoreDirectory, setStoreDirectory, store } from '@main/infrastructure/store'
import { setMinimizeToTray } from '@main/tray'
import { setLogLevel } from '@main/infrastructure/logger'
import { syncGitRules } from '@main/services/git'
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
  const next: AppSettings = {
    ...settings,
    schemaVersion: 1,
    general: { ...settings.general, theme: normalizeTheme(settings.general.theme) },
    advanced: { ...settings.advanced, logLevel: settings.advanced.logLevel ?? 'info' },
    node: { ...settings.node }
  }
  await store.settings.write(next)
  app.setLoginItemSettings({ openAtLogin: next.general.launchAtLogin })
  setMinimizeToTray(next.general.minimizeToTray)
  setLogLevel(next.advanced.logLevel)
  return next
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

export async function exportSettingsFile(): Promise<void> {
  const result = await dialog.showSaveDialog({
    title: '导出开发工坊数据',
    defaultPath: 'env-tool-backup.json',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return
  await writeFile(result.filePath, `${JSON.stringify(await store.exportData(), null, 2)}\n`, 'utf8')
}

export async function importSettings(data: DataExport): Promise<AppSettings> {
  await store.importData(data)
  await syncGitRules()
  return saveSettings(await store.settings.read())
}

export async function importSettingsFile(): Promise<AppSettings> {
  const result = await dialog.showOpenDialog({
    title: '导入开发工坊数据',
    properties: ['openFile'],
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePaths[0]) return store.settings.read()
  const data = JSON.parse(await readFile(result.filePaths[0], 'utf8')) as DataExport
  return importSettings(data)
}

export async function openDataDirectory(): Promise<void> {
  const settings = await getSettings()
  const error = await shell.openPath(settings.data.directory || getAppPaths().data)
  if (error) throw new Error(`无法打开数据目录：${error}`)
}

/** 先复制完整数据，再更新设置和运行时目录，避免迁移中断造成半切换。 */
export async function changeDataDirectory(): Promise<AppSettings> {
  const current = await getSettings()
  const result = await dialog.showOpenDialog({
    title: '选择新的数据目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return current
  const source = resolve(getStoreDirectory())
  const target = resolve(result.filePaths[0])
  if (target === source) return current
  const targetFromSource = relative(source, target)
  if (targetFromSource && !targetFromSource.startsWith('..') && !isAbsolute(targetFromSource)) {
    throw new Error('新数据目录不能位于当前数据目录内部')
  }
  await mkdir(target, { recursive: true })
  const businessFiles = [
    'hosts.json',
    'ssh-keys.json',
    'git-configs.json',
    'workspaces.json',
    'templates.json',
    'hosts.backup',
    'system-overview-snapshot.json',
    'node-manager.json',
    'git-rules'
  ]
  try {
    await Promise.all(
      businessFiles.map((fileName) =>
        cp(join(source, fileName), join(target, fileName), {
          recursive: true,
          force: true
        }).catch((error: unknown) => {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
          throw error
        })
      )
    )
  } catch {
    throw new Error('数据目录迁移失败，请检查目标目录权限和剩余空间')
  }
  const next = { ...current, data: { directory: target } }
  // 先在新目录重建 Git 路径规则，成功后再更新固定位置的目录指针。
  setStoreDirectory(target)
  try {
    await syncGitRules()
    await store.settings.write(next)
  } catch (error) {
    setStoreDirectory(source)
    throw error
  }
  return next
}

export async function clearBusinessData(): Promise<AppSettings> {
  await store.hosts.write([])
  await store.sshKeys.write([])
  await store.gitIdentities.write([])
  await store.workspaces.write([])
  await store.templates.write([])
  await syncGitRules()
  return store.settings.read()
}

async function directoryStats(path: string): Promise<{ sizeBytes: number; fileCount: number }> {
  const metadata = await lstat(path).catch(() => undefined)
  if (!metadata) return { sizeBytes: 0, fileCount: 0 }
  if (!metadata.isDirectory()) return { sizeBytes: metadata.size, fileCount: 1 }
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  const children = await Promise.all(
    entries.map((entry) =>
      entry.isSymbolicLink()
        ? Promise.resolve({ sizeBytes: 0, fileCount: 0 })
        : directoryStats(join(path, entry.name))
    )
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
  const [stats, identities, workspaces, keys] = await Promise.all([
    directoryStats(directory),
    store.gitIdentities.read().catch(() => []),
    store.workspaces.read().catch(() => []),
    listSshKeys().catch(() => [])
  ])
  return {
    directory,
    ...stats,
    gitIdentityCount: identities.length,
    workspaceCount: workspaces.length,
    sshKeyCount: keys.length
  }
}

const environmentCommands: Array<{ id: string; name: string; command: string; args: string[] }> = [
  { id: 'git', name: 'Git', command: 'git', args: ['--version'] },
  { id: 'node', name: 'Node.js', command: 'node', args: ['--version'] },
  { id: 'npm', name: 'npm', command: 'npm', args: ['--version'] },
  { id: 'pnpm', name: 'pnpm', command: 'pnpm', args: ['--version'] },
  { id: 'yarn', name: 'Yarn', command: 'yarn', args: ['--version'] },
  { id: 'bun', name: 'Bun', command: 'bun', args: ['--version'] },
  { id: 'ssh', name: 'OpenSSH', command: 'ssh', args: ['-V'] },
  { id: 'python', name: 'Python', command: 'python3', args: ['--version'] },
  { id: 'docker', name: 'Docker', command: 'docker', args: ['--version'] }
]

const environmentGuides: Record<string, string> = {
  git: 'https://git-scm.com/downloads',
  node: 'https://nodejs.org/zh-cn/download',
  npm: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm',
  pnpm: 'https://pnpm.io/zh/installation',
  yarn: 'https://yarnpkg.com/getting-started/install',
  bun: 'https://bun.sh/docs/installation',
  ssh: 'https://www.openssh.com/',
  python: 'https://www.python.org/downloads/',
  docker: 'https://docs.docker.com/desktop/setup/install/mac-install/'
}

/** 缺失工具只打开官方安装指引，避免未经确认执行远程 shell 脚本。 */
export async function openEnvironmentGuide(id: string): Promise<void> {
  const url = environmentGuides[id]
  if (!url) throw new Error('暂无该工具的安装指引')
  await shell.openExternal(url)
}

/** 逐项执行常见开发工具检测，并保留原始输出用于排障。 */
export async function runEnvironmentCheck(
  shouldStop: () => boolean = () => false,
  onUpdated?: (results: EnvironmentCheck[]) => void
): Promise<EnvironmentCheck[]> {
  const results: EnvironmentCheck[] = []
  for (const [index, item] of environmentCommands.entries()) {
    if (shouldStop()) {
      const skipped = environmentCommands.slice(index).map((remaining) => ({
        id: remaining.id,
        name: remaining.name,
        command: `${remaining.command} ${remaining.args.join(' ')}`,
        status: 'skipped' as const,
        detail: '用户已停止后续检测'
      }))
      results.push(...skipped)
      onUpdated?.([...results])
      break
    }
    try {
      const { stdout, stderr } = await execFileAsync(item.command, item.args, {
        timeout: 10_000,
        maxBuffer: 1024 * 1024
      })
      const detail = `${stdout}${stderr}`.trim()
      results.push({
        id: item.id,
        name: item.name,
        command: `${item.command} ${item.args.join(' ')}`,
        status: 'passed',
        version: detail.split('\n')[0],
        detail
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : '检测命令执行失败'
      results.push({
        id: item.id,
        name: item.name,
        command: `${item.command} ${item.args.join(' ')}`,
        status: 'failed',
        detail
      })
    }
    // 每项完成就推送快照，页面不必等待全部命令结束。
    onUpdated?.([...results])
  }
  return results
}
