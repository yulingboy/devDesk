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

const emptySettings = (dataDirectory: string): AppSettings => ({
  schemaVersion,
  general: { theme: 'light', launchAtLogin: false, minimizeToTray: false },
  data: { directory: dataDirectory },
  advanced: { logLevel: 'info', developerTools: false },
  node: {
    indexUrl: 'https://nodejs.org/dist/index.json',
    downloadSource: 'https://nodejs.org/dist',
    packageManager: 'pnpm',
    registry: 'https://registry.npmjs.org'
  }
})

export function initializeStore(paths: AppPaths): void {
  storeDirectory = paths.data
}

export function getStoreDirectory(): string {
  if (!storeDirectory) throw new Error('数据存储尚未初始化')
  return storeDirectory
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(join(getStoreDirectory(), fileName), 'utf8')
    return JSON.parse(raw) as T
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return fallback
    throw new Error(`读取数据文件失败：${fileName}`)
  }
}

async function writeJson<T>(fileName: string, value: T): Promise<void> {
  const directory = getStoreDirectory()
  await mkdir(directory, { recursive: true })
  const target = join(directory, fileName)
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, target)
}

export const store = {
  settings: {
    read: async (): Promise<AppSettings> =>
      readJson('settings.json', emptySettings(getStoreDirectory())),
    write: (value: AppSettings): Promise<void> =>
      writeJson('settings.json', { ...value, schemaVersion })
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
      templates: await store.templates.read()
    }
  },
  async importData(value: DataExport): Promise<void> {
    if (value.schemaVersion !== schemaVersion) throw new Error('不支持的数据版本')
    await store.settings.write(value.settings)
    await store.hosts.write(value.hosts)
    await store.sshKeys.write(value.sshKeys)
    await store.gitIdentities.write(value.gitIdentities)
    await store.workspaces.write(value.workspaces)
    await store.templates.write(value.templates)
  }
}
