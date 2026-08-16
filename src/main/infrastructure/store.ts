import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppPaths } from '@shared/types'
import type {
  AppSettings,
  DataExport,
  GitIdentity,
  HostRecord,
  NodeState,
  NodeReleaseCache,
  ProjectTemplate,
  SSHKey,
  SystemOverviewSnapshot,
  Workspace,
  EnvironmentCheckSnapshot
} from '@shared/domain'

const schemaVersion = 1 as const
let storeDirectory: string | undefined
let settingsDirectory: string | undefined
const pendingWrites = new Map<string, Promise<void>>()
// 所有存储操作共用一个可重入队列，跨文件变更期间不会混入普通业务读写。
let dataMutationQueue: Promise<void> = Promise.resolve()
const dataMutationContext = new AsyncLocalStorage<boolean>()

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

export async function withDataMutation<T>(mutation: () => Promise<T>): Promise<T> {
  return withStoreLock(mutation)
}

async function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  if (dataMutationContext.getStore()) return operation()
  const previous = dataMutationQueue
  let release!: () => void
  dataMutationQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous.catch(() => undefined)
  try {
    return await dataMutationContext.run(true, operation)
  } finally {
    release()
  }
}

function getSettingsDirectory(): string {
  if (!settingsDirectory) throw new Error('基础设置存储尚未初始化')
  return settingsDirectory
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 旧版本数据缺少新增字段时在读取边界补齐，避免一次功能升级要求用户清空数据目录。
 * 这里只处理设置的默认值；业务对象由各自服务在使用时继续校验。
 */
function normalizeSettings(value: unknown, dataDirectory: string): AppSettings {
  const fallback = emptySettings(dataDirectory)
  if (!isRecord(value)) return fallback
  const general = isRecord(value.general) ? value.general : {}
  const advanced = isRecord(value.advanced) ? value.advanced : {}
  const node = isRecord(value.node) ? value.node : {}
  const data = isRecord(value.data) ? value.data : {}
  return {
    schemaVersion,
    general: {
      theme:
        typeof general.theme === 'string'
          ? (general.theme as AppSettings['general']['theme'])
          : 'blue',
      launchAtLogin: Boolean(general.launchAtLogin),
      minimizeToTray: Boolean(general.minimizeToTray)
    },
    data: {
      directory:
        typeof data.directory === 'string' && data.directory ? data.directory : dataDirectory
    },
    advanced: {
      logLevel:
        advanced.logLevel === 'debug' ||
        advanced.logLevel === 'info' ||
        advanced.logLevel === 'warn' ||
        advanced.logLevel === 'error'
          ? advanced.logLevel
          : 'info',
      developerTools: Boolean(advanced.developerTools)
    },
    node: {
      indexUrl:
        typeof node.indexUrl === 'string' && node.indexUrl ? node.indexUrl : fallback.node.indexUrl,
      downloadSource:
        typeof node.downloadSource === 'string' && node.downloadSource
          ? node.downloadSource
          : fallback.node.downloadSource,
      packageManager:
        typeof node.packageManager === 'string' && node.packageManager
          ? node.packageManager
          : fallback.node.packageManager,
      registry:
        typeof node.registry === 'string' && node.registry ? node.registry : fallback.node.registry
    }
  }
}

async function quarantineCorruptJson(directory: string, fileName: string): Promise<void> {
  const source = join(directory, fileName)
  const target = `${source}.${new Date().toISOString().replace(/[:.]/g, '-')}.corrupt`
  await rename(source, target).catch(() => undefined)
}

async function readJsonFrom<T>(directory: string, fileName: string, fallback: T): Promise<T> {
  return withStoreLock(() => readJsonFromUnlocked(directory, fileName, fallback))
}

async function readJsonFromUnlocked<T>(
  directory: string,
  fileName: string,
  fallback: T
): Promise<T> {
  try {
    const raw = await readFile(join(directory, fileName), 'utf8')
    return JSON.parse(raw) as T
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return fallback
    if (error instanceof SyntaxError) {
      // JSON 损坏时保留原始文件供诊断，并让应用以安全默认值继续启动。
      await quarantineCorruptJson(directory, fileName)
      return fallback
    }
    throw new Error(`读取数据文件失败：${fileName}`)
  }
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  return withStoreLock(() => readJsonFromUnlocked(getStoreDirectory(), fileName, fallback))
}

async function writeJsonTo<T>(directory: string, fileName: string, value: T): Promise<void> {
  return withStoreLock(() => writeJsonToUnlocked(directory, fileName, value))
}

async function writeJsonToUnlocked<T>(
  directory: string,
  fileName: string,
  value: T
): Promise<void> {
  const target = join(directory, fileName)
  const previous = pendingWrites.get(target) ?? Promise.resolve()
  const write = previous
    .catch(() => undefined)
    .then(async () => {
      await mkdir(directory, { recursive: true })
      // 同一文件的状态更新可能同时抵达；临时名必须唯一并按目标文件串行提交。
      const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
      await rename(temporary, target)
    })
  pendingWrites.set(target, write)
  try {
    await write
  } finally {
    // 失败写入不能堵住后续更新，且不能清除已经排队的新任务。
    if (pendingWrites.get(target) === write) pendingWrites.delete(target)
  }
}

async function writeJson<T>(fileName: string, value: T): Promise<void> {
  return withStoreLock(() => writeJsonToUnlocked(getStoreDirectory(), fileName, value))
}

export const store = {
  settings: {
    read: async (): Promise<AppSettings> =>
      normalizeSettings(
        await readJsonFrom(
          getSettingsDirectory(),
          'settings.json',
          emptySettings(getStoreDirectory())
        ),
        getStoreDirectory()
      ),
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
  nodeReleases: {
    read: (): Promise<NodeReleaseCache | null> => readJson('node-releases.json', null),
    write: (value: NodeReleaseCache): Promise<void> => writeJson('node-releases.json', value)
  },
  environmentCheck: {
    read: (): Promise<EnvironmentCheckSnapshot | null> => readJson('environment-check.json', null),
    write: (value: EnvironmentCheckSnapshot): Promise<void> =>
      writeJson('environment-check.json', value)
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
      nodeReleases: await store.nodeReleases.read(),
      overview: await store.overview.read(),
      hostsBackup: await readFile(join(getStoreDirectory(), 'hosts.backup'), 'utf8').catch(
        () => undefined
      ),
      environmentCheck: await store.environmentCheck.read()
    }
  },
  async importData(value: DataExport): Promise<void> {
    validateDataExport(value)
    await withDataMutation(async () => {
      const previous = await store.exportData()
      try {
        await writeImportedData(value)
      } catch (error) {
        // 多文件存储无法由文件系统提供跨文件事务，失败时立即回滚到完整导入前快照。
        try {
          await writeImportedData(previous)
        } catch (rollbackError) {
          console.error('导入数据回滚失败', rollbackError)
          throw new Error(
            `导入数据失败且回滚失败，请立即检查数据目录：${
              error instanceof Error ? error.message : '未知错误'
            }`
          )
        }
        throw new Error(
          `导入数据失败，已恢复导入前数据：${error instanceof Error ? error.message : '未知错误'}`
        )
      }
    })
  }
}

function validateDataExport(value: unknown): asserts value is DataExport {
  if (!isRecord(value) || value.schemaVersion !== schemaVersion)
    throw new Error('备份文件版本不受支持')
  const arrayFields = ['hosts', 'sshKeys', 'gitIdentities', 'workspaces', 'templates'] as const
  if (!isRecord(value.settings) || arrayFields.some((field) => !Array.isArray(value[field]))) {
    throw new Error('备份文件结构无效，请选择由开发工坊导出的 JSON 文件')
  }
  for (const field of arrayFields) {
    const items = value[field]
    if (!Array.isArray(items) || items.some((item) => !isRecord(item))) {
      throw new Error(`备份文件中的 ${field} 数据无效`)
    }
  }
  const candidate = value as unknown as DataExport
  const hasStrings = (item: unknown, fields: string[]): boolean =>
    isRecord(item) && fields.every((field) => typeof item[field] === 'string')
  if (
    candidate.hosts.some(
      (item) =>
        !hasStrings(item, ['id', 'ip', 'domain', 'remark']) || typeof item.enabled !== 'boolean'
    ) ||
    candidate.sshKeys.some(
      (item) => !hasStrings(item, ['id', 'name', 'algorithm', 'source', 'publicKey', 'fingerprint'])
    ) ||
    candidate.gitIdentities.some(
      (item) => !hasStrings(item, ['id', 'name', 'username', 'email'])
    ) ||
    candidate.workspaces.some(
      (item) =>
        !hasStrings(item, ['id', 'name', 'rootPath', 'description']) ||
        !Array.isArray(item.projects) ||
        item.projects.some((project) => !hasStrings(project, ['id', 'workspaceId', 'name', 'path']))
    ) ||
    candidate.templates.some(
      (item) =>
        !hasStrings(item, ['id', 'name', 'description', 'type', 'source']) ||
        !['git', 'local'].includes(item.type)
    )
  ) {
    throw new Error('备份文件包含无效的业务字段，未导入任何数据')
  }
  if (
    candidate.environmentCheck != null &&
    (!isRecord(candidate.environmentCheck) ||
      typeof candidate.environmentCheck.checkedAt !== 'string' ||
      !Array.isArray(candidate.environmentCheck.checks))
  ) {
    throw new Error('备份文件中的环境检测快照无效')
  }
}

async function writeImportedData(value: DataExport): Promise<void> {
  // 导入备份不应偷偷改变本机的数据目录。
  await store.settings.write({
    ...normalizeSettings(value.settings, getStoreDirectory()),
    data: { directory: getStoreDirectory() }
  })
  await store.hosts.write(value.hosts)
  await store.sshKeys.write(value.sshKeys)
  await store.gitIdentities.write(value.gitIdentities)
  await store.workspaces.write(value.workspaces)
  await store.templates.write(value.templates)
  if (value.nodeState) await store.node.write(value.nodeState)
  else await removeImportedOptionalFile('node-manager.json')
  if (value.nodeReleases) await store.nodeReleases.write(value.nodeReleases)
  else await removeImportedOptionalFile('node-releases.json')
  if (value.overview) await store.overview.write(value.overview)
  else await removeImportedOptionalFile('system-overview-snapshot.json')
  if (value.hostsBackup) {
    await mkdir(getStoreDirectory(), { recursive: true })
    await writeFile(join(getStoreDirectory(), 'hosts.backup'), value.hostsBackup, 'utf8')
  } else await removeImportedOptionalFile('hosts.backup')
  if (value.environmentCheck) await store.environmentCheck.write(value.environmentCheck)
  else await removeImportedOptionalFile('environment-check.json')
}

async function removeImportedOptionalFile(fileName: string): Promise<void> {
  await rm(join(getStoreDirectory(), fileName), { force: true })
}
