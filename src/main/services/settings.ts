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
import type {
  AppSettings,
  DataExport,
  DataStats,
  DialogOperationResult,
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
import { setMinimizeToTray } from '@main/app/tray'
import { setLogLevel } from '@main/infrastructure/logger'
import { resetUserShellEnvironment } from '@main/infrastructure/shell-environment'
import { removeGitRuleInclude, syncGitRules } from '@main/services/git-rules'
import { listSshKeys } from '@main/services/ssh'

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
    title: '导出 DevDesk 数据',
    defaultPath: 'devdesk-backup.json',
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
    title: '导入 DevDesk 数据',
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
    'git-rules'
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

    const staging = join(target, `.devdesk-migration-${Date.now()}-${process.pid}`)
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
