import { app, dialog, shell } from 'electron'
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AppSettings, DataExport } from '@shared/domain'
import type { DataStats, EnvironmentCheck } from '@shared/domain'
import { getAppPaths } from '@main/infrastructure/paths'
import { store } from '@main/infrastructure/store'
import { setMinimizeToTray } from '@main/tray'
import { setLogLevel } from '@main/infrastructure/logger'

const execFileAsync = promisify(execFile)

export async function getSettings(): Promise<AppSettings> {
  return store.settings.read()
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const next: AppSettings = {
    ...settings,
    schemaVersion: 1,
    general: { ...settings.general, theme: settings.general.theme ?? 'light' },
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
    general: { theme: 'light', launchAtLogin: false, minimizeToTray: false },
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
  return store.settings.read()
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
  const error = await shell.openPath(getAppPaths().data)
  if (error) throw new Error(`无法打开数据目录：${error}`)
}

export async function clearBusinessData(): Promise<AppSettings> {
  await store.hosts.write([])
  await store.sshKeys.write([])
  await store.gitIdentities.write([])
  await store.workspaces.write([])
  await store.templates.write([])
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
  const directory = getAppPaths().data
  const [stats, identities, workspaces, keys] = await Promise.all([
    directoryStats(directory),
    store.gitIdentities.read().catch(() => []),
    store.workspaces.read().catch(() => []),
    store.sshKeys.read().catch(() => [])
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

/** 逐项执行常见开发工具检测，并保留原始输出用于排障。 */
export async function runEnvironmentCheck(): Promise<EnvironmentCheck[]> {
  const results: EnvironmentCheck[] = []
  for (const item of environmentCommands) {
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
  }
  return results
}
