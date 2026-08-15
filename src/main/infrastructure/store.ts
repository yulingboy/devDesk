import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppPaths } from '@shared/types'
import type {
  AppSettings,
  DataExport,
  GitIdentity,
  HostRecord,
  NodeState,
  ProjectTemplate,
  SSHKey,
  SystemOverviewSnapshot,
  Workspace
} from '@shared/domain'

const schemaVersion = 1 as const
let storeDirectory: string | undefined
let settingsDirectory: string | undefined

const emptySettings = (dataDirectory: string): AppSettings => ({
  schemaVersion,
  general: { theme: 'blue', launchAtLogin: false, minimizeToTray: false },
  data: { directory: dataDirectory },
  advanced: { logLevel: 'info', developerTools: false },
  node: {
    indexUrl: 'https://nodejs.org/dist/index.json',
    downloadSource: 'https://nodejs.org/dist',
    packageManager: 'pnpm',
    registry: 'https://registry.npmjs.org'
  }
})

export async function initializeStore(paths: AppPaths): Promise<void> {
  settingsDirectory = paths.data
  storeDirectory = paths.data

  // 基础设置始终留在 Electron 默认目录，它同时是自定义业务目录的指针。
  const settings = await readJsonFrom(paths.data, 'settings.json', emptySettings(paths.data))
  if (settings.data.directory) storeDirectory = settings.data.directory
}

export function getStoreDirectory(): string {
  if (!storeDirectory) throw new Error('数据存储尚未初始化')
  return storeDirectory
}

/** 数据目录迁移完成后切换后续读写目标。 */
export function setStoreDirectory(directory: string): void {
  storeDirectory = directory
}

function getSettingsDirectory(): string {
  if (!settingsDirectory) throw new Error('基础设置存储尚未初始化')
  return settingsDirectory
}

async function readJsonFrom<T>(directory: string, fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(join(directory, fileName), 'utf8')
    return JSON.parse(raw) as T
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return fallback
    throw new Error(`读取数据文件失败：${fileName}`)
  }
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  return readJsonFrom(getStoreDirectory(), fileName, fallback)
}

async function writeJsonTo<T>(directory: string, fileName: string, value: T): Promise<void> {
  await mkdir(directory, { recursive: true })
  const target = join(directory, fileName)
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, target)
}

async function writeJson<T>(fileName: string, value: T): Promise<void> {
  return writeJsonTo(getStoreDirectory(), fileName, value)
}

export const store = {
  settings: {
    read: async (): Promise<AppSettings> =>
      readJsonFrom(getSettingsDirectory(), 'settings.json', emptySettings(getStoreDirectory())),
    write: (value: AppSettings): Promise<void> =>
      writeJsonTo(getSettingsDirectory(), 'settings.json', { ...value, schemaVersion })
  },
  hosts: {
    read: (): Promise<HostRecord[]> => readJson('hosts.json', []),
    write: (value: HostRecord[]): Promise<void> => writeJson('hosts.json', value)
  },
  sshKeys: {
    read: (): Promise<SSHKey[]> => readJson('ssh-keys.json', []),
    write: (value: SSHKey[]): Promise<void> => writeJson('ssh-keys.json', value)
  },
  gitIdentities: {
    read: (): Promise<GitIdentity[]> => readJson('git-configs.json', []),
    write: (value: GitIdentity[]): Promise<void> => writeJson('git-configs.json', value)
  },
  workspaces: {
    read: (): Promise<Workspace[]> => readJson('workspaces.json', []),
    write: (value: Workspace[]): Promise<void> => writeJson('workspaces.json', value)
  },
  templates: {
    read: (): Promise<ProjectTemplate[]> => readJson('templates.json', []),
    write: (value: ProjectTemplate[]): Promise<void> => writeJson('templates.json', value)
  },
  overview: {
    read: (): Promise<SystemOverviewSnapshot | null> =>
      readJson('system-overview-snapshot.json', null),
    write: (value: SystemOverviewSnapshot): Promise<void> =>
      writeJson('system-overview-snapshot.json', value)
  },
  node: {
    read: (): Promise<NodeState | null> => readJson('node-manager.json', null),
    write: (value: NodeState): Promise<void> => writeJson('node-manager.json', value)
  },
  async exportData(): Promise<DataExport> {
    return {
      schemaVersion,
      exportedAt: new Date().toISOString(),
      settings: await store.settings.read(),
      hosts: await store.hosts.read(),
      sshKeys: await store.sshKeys.read(),
      gitIdentities: await store.gitIdentities.read(),
      workspaces: await store.workspaces.read(),
      templates: await store.templates.read(),
      nodeState: await store.node.read(),
      overview: await store.overview.read(),
      hostsBackup: await readFile(join(getStoreDirectory(), 'hosts.backup'), 'utf8').catch(
        () => undefined
      )
    }
  },
  async importData(value: DataExport): Promise<void> {
    if (value.schemaVersion !== schemaVersion) throw new Error('不支持的数据版本')
    // 导入备份不应偷偷改变本机的数据目录。
    await store.settings.write({
      ...value.settings,
      data: { directory: getStoreDirectory() }
    })
    await store.hosts.write(value.hosts)
    await store.sshKeys.write(value.sshKeys)
    await store.gitIdentities.write(value.gitIdentities)
    await store.workspaces.write(value.workspaces)
    await store.templates.write(value.templates)
    if (value.nodeState) await store.node.write(value.nodeState)
    if (value.overview) await store.overview.write(value.overview)
    if (value.hostsBackup) {
      await mkdir(getStoreDirectory(), { recursive: true })
      await writeFile(join(getStoreDirectory(), 'hosts.backup'), value.hostsBackup, 'utf8')
    }
  }
}
