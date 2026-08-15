import { access, lstat, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  GlobalPackage,
  NodeCacheSnapshot,
  NodeInstall,
  NodeRegistry,
  NodeRegistryDraft,
  NodeRelease,
  NodeState
} from '@shared/domain'
import { store } from '@main/infrastructure/store'
import { createId, requiredText } from './common'

const execFileAsync = promisify(execFile)
const packageManagerNames = ['npm', 'pnpm', 'yarn', 'bun'] as const

const defaultRegistries = (): NodeRegistry[] => [
  { id: 'registry-npm', name: 'npm', url: 'https://registry.npmjs.org', isCurrent: true },
  {
    id: 'registry-npmmirror',
    name: 'npmmirror',
    url: 'https://registry.npmmirror.com',
    isCurrent: false
  }
]

const defaultState = (): NodeState => ({
  currentVersion: '',
  defaultVersion: '',
  nodePath: '',
  nvmAvailable: false,
  nrmAvailable: false,
  registry: 'https://registry.npmjs.org',
  packageManager: 'pnpm',
  packageManagerVersion: '',
  installed: [],
  tasks: [],
  packageManagers: [],
  registries: defaultRegistries(),
  globalPackages: [],
  caches: []
})

function normalizeState(value: NodeState | null): NodeState {
  const fallback = defaultState()
  return {
    ...fallback,
    ...value,
    packageManagers: value?.packageManagers ?? [],
    registries: value?.registries?.length ? value.registries : fallback.registries,
    globalPackages: value?.globalPackages ?? [],
    caches: value?.caches ?? []
  }
}

async function runCommand(command: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    env: { ...process.env, CI: '1', npm_config_yes: 'true' },
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024
  })
  return stdout.trim()
}

async function commandVersion(command: string): Promise<string> {
  return runCommand(command, ['--version']).catch(() => '')
}

async function installedVersions(): Promise<NodeInstall[]> {
  const nvmDirectory = join(homedir(), '.nvm', 'versions', 'node')
  const entries = await readdir(nvmDirectory).catch(() => [])
  const current = (await commandVersion('node')).replace(/^v/, '')
  return entries
    .filter((entry) => /^v?\d+\.\d+\.\d+$/.test(entry))
    .map((version) => ({
      version: version.replace(/^v/, ''),
      path: join(nvmDirectory, version),
      isCurrent: version.replace(/^v/, '') === current,
      isDefault: false
    }))
}

async function readPackageManagerRegistry(name: string): Promise<string> {
  return name === 'bun' ? '' : runCommand(name, ['config', 'get', 'registry']).catch(() => '')
}

async function packageManagerStatus(defaultName: string): Promise<NodeState['packageManagers']> {
  return Promise.all(
    packageManagerNames.map(async (name) => {
      const version = await commandVersion(name)
      return {
        name,
        available: Boolean(version),
        version,
        registry: version ? await readPackageManagerRegistry(name) : '',
        isDefault: name === defaultName
      }
    })
  )
}

/** 汇总真实命令状态，同时保留任务、镜像和缓存等持久化数据。 */
export async function getNodeState(): Promise<NodeState> {
  const saved = normalizeState(await store.node.read())
  const settings = await store.settings.read()
  const packageManager = settings.node.packageManager || saved.packageManager || 'pnpm'
  const installed = await installedVersions()
  const packageManagers = await packageManagerStatus(packageManager)
  const registry = settings.node.registry || saved.registry
  const state: NodeState = {
    ...saved,
    currentVersion: (await commandVersion('node')).replace(/^v/, ''),
    nodePath: process.env.PATH ?? '',
    nvmAvailable:
      Boolean(await commandVersion('nvm')) ||
      (await access(join(homedir(), '.nvm', 'nvm.sh'))
        .then(() => true)
        .catch(() => false)),
    nrmAvailable: Boolean(await commandVersion('nrm')),
    registry,
    packageManager,
    packageManagerVersion:
      packageManagers.find((item) => item.name === packageManager)?.version ?? '',
    packageManagers,
    registries: saved.registries.map((item) => ({ ...item, isCurrent: item.url === registry })),
    installed: installed.map((item) => ({
      ...item,
      isDefault: item.version === saved.defaultVersion
    }))
  }
  await store.node.write(state)
  return state
}

export async function listNodeReleases(filter?: {
  keyword?: string
  channel?: 'all' | 'lts' | 'current'
}): Promise<NodeRelease[]> {
  const settings = await store.settings.read()
  const response = await fetch(settings.node.indexUrl).catch(() => undefined)
  if (!response?.ok) throw new Error('Node 版本索引读取失败，请检查网络或下载源设置')
  const releases = (await response.json()) as NodeRelease[]
  return releases
    .filter((release) => {
      const keyword = filter?.keyword?.trim().toLowerCase()
      const matchKeyword = !keyword || release.version.toLowerCase().includes(keyword)
      const matchChannel =
        !filter?.channel ||
        filter.channel === 'all' ||
        (filter.channel === 'lts' ? Boolean(release.lts) : release.lts === false)
      return matchKeyword && matchChannel
    })
    .slice(0, 100)
}

async function runNvm(command: string): Promise<string> {
  if (process.platform === 'win32')
    throw new Error('当前版本暂不支持 Windows nvm 自动安装，请使用 nvm-windows 后重试')
  const script = `if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; else echo "未找到 nvm" >&2; exit 2; fi; ${command}`
  return runCommand('bash', ['-lc', script]).catch(() => {
    throw new Error('nvm 命令执行失败，请确认已安装 nvm，并检查版本是否存在')
  })
}

export async function installNode(
  versionInput: { version: string },
  onProgress?: (state: NodeState) => void
): Promise<NodeState> {
  const version = requiredText(versionInput.version, 'Node 版本', 40).replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Node 版本号无效')
  const before = normalizeState(await store.node.read())
  const task = {
    id: createId('node-task'),
    version,
    status: 'running' as const,
    progress: 10,
    message: '正在调用 nvm 安装',
    startedAt: new Date().toISOString(),
    logs: [`${new Date().toLocaleString()} 开始安装 Node ${version}`]
  }
  const started = { ...before, tasks: [...before.tasks, task] }
  await store.node.write(started)
  onProgress?.(started)
  try {
    const existing = (await getNodeState()).installed.some((item) => item.version === version)
    if (!existing) {
      const downloading = {
        ...(await getNodeState()),
        tasks: (await getNodeState()).tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                progress: 45,
                message: '正在下载并安装 Node',
                logs: [...item.logs, 'nvm 已开始下载和校验安装包']
              }
            : item
        )
      }
      await store.node.write(downloading)
      onProgress?.(downloading)
      await runNvm(`nvm install ${version}`)
    }
    const after = await getNodeState()
    const completed = {
      ...after,
      tasks: after.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: existing ? ('skipped' as const) : ('completed' as const),
              progress: 100,
              message: existing ? '版本已存在，跳过安装' : '安装完成',
              finishedAt: new Date().toISOString(),
              logs: [...item.logs, existing ? '检测到完整版本，已跳过' : 'nvm 安装完成']
            }
          : item
      )
    }
    await store.node.write(completed)
    onProgress?.(completed)
    return completed
  } catch (error) {
    const message = error instanceof Error ? error.message : '安装失败'
    const latest = normalizeState(await store.node.read())
    const failed = {
      ...latest,
      tasks: latest.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: 'failed' as const,
              progress: 100,
              message,
              finishedAt: new Date().toISOString(),
              logs: [...item.logs, message]
            }
          : item
      )
    }
    await store.node.write(failed)
    onProgress?.(failed)
    throw error
  }
}

export async function switchNode(versionInput: string, setDefault: boolean): Promise<NodeState> {
  const version = requiredText(versionInput, 'Node 版本', 40).replace(/^v/, '')
  await runNvm(`nvm use ${version}${setDefault ? ` && nvm alias default ${version}` : ''}`)
  const state = await getNodeState()
  const next = { ...state, defaultVersion: setDefault ? version : state.defaultVersion }
  await store.node.write(next)
  return next
}

export async function removeNode(versionInput: string): Promise<NodeState> {
  const version = requiredText(versionInput, 'Node 版本', 40).replace(/^v/, '')
  const state = await getNodeState()
  if (state.currentVersion === version)
    throw new Error('当前正在使用的 Node 版本不能删除，请先切换版本')
  await runNvm(`nvm uninstall ${version}`)
  const next = await getNodeState()
  if (state.defaultVersion === version) {
    next.defaultVersion = ''
    await store.node.write(next)
  }
  return next
}

export async function listNodeRegistries(): Promise<NodeRegistry[]> {
  return (await getNodeState()).registries
}

function validateRegistryUrl(value: string): string {
  const url = requiredText(value, '镜像地址', 500)
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error('镜像地址必须使用 HTTP 或 HTTPS')
  return parsed.toString().replace(/\/$/, '')
}

export async function saveNodeRegistry(draft: NodeRegistryDraft): Promise<NodeRegistry[]> {
  const state = await getNodeState()
  const name = requiredText(draft.name, '镜像名称', 60)
  const url = validateRegistryUrl(draft.url)
  if (
    state.registries.some(
      (item) => item.id !== draft.id && item.name.toLowerCase() === name.toLowerCase()
    )
  )
    throw new Error('镜像名称已存在')
  const nextItem: NodeRegistry = {
    id: draft.id || createId('registry'),
    name,
    url,
    isCurrent: state.registry === url
  }
  const registries = draft.id
    ? state.registries.map((item) => (item.id === draft.id ? nextItem : item))
    : [...state.registries, nextItem]
  if (state.nrmAvailable) await runCommand('nrm', ['add', name, url]).catch(() => undefined)
  await store.node.write({ ...state, registries })
  return registries
}

export async function removeNodeRegistry(id: string): Promise<NodeRegistry[]> {
  const state = await getNodeState()
  const target = state.registries.find((item) => item.id === id)
  if (!target) throw new Error('镜像不存在')
  if (target.isCurrent) throw new Error('当前正在使用的镜像不能删除，请先切换镜像')
  if (state.registries.length <= 1) throw new Error('至少需要保留一个镜像')
  if (state.nrmAvailable) await runCommand('nrm', ['del', target.name]).catch(() => undefined)
  const registries = state.registries.filter((item) => item.id !== id)
  await store.node.write({ ...state, registries })
  return registries
}

export async function useNodeRegistry(id: string): Promise<NodeState> {
  const state = await getNodeState()
  const target = state.registries.find((item) => item.id === id)
  if (!target) throw new Error('镜像不存在')
  if (state.nrmAvailable) await runCommand('nrm', ['use', target.name])
  else if (state.packageManager === 'bun')
    throw new Error('当前默认包管理器不支持自动切换 registry')
  else await runCommand(state.packageManager, ['config', 'set', 'registry', target.url])
  const settings = await store.settings.read()
  await store.settings.write({ ...settings, node: { ...settings.node, registry: target.url } })
  const next = await getNodeState()
  next.registry = target.url
  next.registries = next.registries.map((item) => ({ ...item, isCurrent: item.id === id }))
  await store.node.write(next)
  return next
}

export async function testNodeRegistry(id: string): Promise<NodeRegistry[]> {
  const state = await getNodeState()
  const target = state.registries.find((item) => item.id === id)
  if (!target) throw new Error('镜像不存在')
  const startedAt = Date.now()
  const response = await fetch(target.url, {
    method: 'HEAD',
    signal: AbortSignal.timeout(10_000)
  }).catch(() => undefined)
  if (!response?.ok) throw new Error('镜像测速失败，请检查地址和网络连接')
  const registries = state.registries.map((item) =>
    item.id === id ? { ...item, latencyMs: Date.now() - startedAt } : item
  )
  await store.node.write({ ...state, registries })
  return registries
}

function validatePackageName(value: string): string {
  const name = requiredText(value, '包名', 214)
  if (!/^(?:@[-a-z0-9_.]+\/)?[-a-z0-9_.]+$/i.test(name)) throw new Error('包名格式无效')
  return name
}

async function readGlobalPackages(manager: string): Promise<GlobalPackage[]> {
  if (manager === 'npm') {
    const parsed = JSON.parse(
      await runCommand('npm', ['ls', '-g', '--depth=0', '--json']).catch(() => '{}')
    ) as { dependencies?: Record<string, { version?: string }> }
    const outdated = JSON.parse(
      await runCommand('npm', ['outdated', '-g', '--json']).catch(() => '{}')
    ) as Record<string, { wanted?: string; latest?: string }>
    return Object.entries(parsed.dependencies ?? {}).map(([name, value]) => ({
      name,
      current: value.version ?? '',
      wanted: outdated[name]?.wanted,
      latest: outdated[name]?.latest
    }))
  }
  if (manager === 'pnpm') {
    const parsed = JSON.parse(
      await runCommand('pnpm', ['list', '-g', '--depth=0', '--json']).catch(() => '[]')
    ) as Array<{
      dependencies?: Record<string, { version?: string }>
      devDependencies?: Record<string, { version?: string }>
    }>
    const dependencies = {
      ...(parsed[0]?.dependencies ?? {}),
      ...(parsed[0]?.devDependencies ?? {})
    }
    return Object.entries(dependencies).map(([name, value]) => ({
      name,
      current: value.version ?? ''
    }))
  }
  return []
}

export async function listGlobalPackages(keyword = ''): Promise<GlobalPackage[]> {
  const state = await getNodeState()
  if (!state.packageManagerVersion) throw new Error(`默认包管理器 ${state.packageManager} 不可用`)
  const packages = await readGlobalPackages(state.packageManager)
  await store.node.write({ ...state, globalPackages: packages })
  const query = keyword.trim().toLowerCase()
  return query ? packages.filter((item) => item.name.toLowerCase().includes(query)) : packages
}

async function mutateGlobalPackage(
  action: 'install' | 'remove' | 'update',
  input: string
): Promise<GlobalPackage[]> {
  const name = validatePackageName(input)
  const state = await getNodeState()
  const manager = state.packageManager
  if (!state.packageManagerVersion) throw new Error(`默认包管理器 ${manager} 不可用`)
  const args =
    manager === 'npm'
      ? [action === 'remove' ? 'uninstall' : action, '-g', name]
      : [action === 'remove' ? 'remove' : action === 'install' ? 'add' : 'update', '-g', name]
  await runCommand(manager, args).catch(() => {
    throw new Error(`${manager} 全局包操作失败，请检查网络、权限和 registry 设置`)
  })
  return listGlobalPackages()
}
export const installGlobalPackage = (name: string): Promise<GlobalPackage[]> =>
  mutateGlobalPackage('install', name)
export const removeGlobalPackage = (name: string): Promise<GlobalPackage[]> =>
  mutateGlobalPackage('remove', name)
export const updateGlobalPackage = (name: string): Promise<GlobalPackage[]> =>
  mutateGlobalPackage('update', name)

async function directorySize(path: string): Promise<number> {
  const metadata = await lstat(path).catch(() => undefined)
  if (!metadata) return 0
  if (!metadata.isDirectory()) return metadata.size
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  const sizes = await Promise.all(
    entries.map((entry) => (entry.isSymbolicLink() ? 0 : directorySize(join(path, entry.name))))
  )
  return sizes.reduce((total, size) => total + size, 0)
}

async function resolveCachePaths(): Promise<Array<{ name: string; path: string }>> {
  const npmPath = await runCommand('npm', ['config', 'get', 'cache']).catch(() =>
    join(homedir(), '.npm')
  )
  const pnpmPath = await runCommand('pnpm', ['store', 'path']).catch(() =>
    join(homedir(), '.local', 'share', 'pnpm', 'store')
  )
  const yarnPath = await runCommand('yarn', ['cache', 'dir']).catch(() =>
    join(homedir(), '.cache', 'yarn')
  )
  return [
    { name: 'npm 缓存', path: npmPath },
    { name: 'pnpm Store', path: pnpmPath },
    { name: 'yarn 缓存', path: yarnPath },
    { name: 'nvm 版本目录', path: join(homedir(), '.nvm', 'versions', 'node') }
  ]
}

export async function scanNodeCaches(): Promise<NodeState> {
  const state = await getNodeState()
  const caches: NodeCacheSnapshot[] = await Promise.all(
    (await resolveCachePaths()).map(async (item) => {
      const exists = await access(item.path)
        .then(() => true)
        .catch(() => false)
      return { ...item, exists, sizeBytes: exists ? await directorySize(item.path) : 0 }
    })
  )
  const next = { ...state, caches }
  await store.node.write(next)
  return next
}

export async function clearNodeCaches(): Promise<NodeState> {
  const state = await getNodeState()
  const commands: Array<[string, string[]]> = [
    ['npm', ['cache', 'clean', '--force']],
    ['pnpm', ['store', 'prune']],
    ['yarn', ['cache', 'clean']],
    ['bun', ['pm', 'cache', 'rm']]
  ]
  for (const [command, args] of commands)
    if (state.packageManagers.some((item) => item.name === command && item.available))
      await runCommand(command, args).catch(() => undefined)
  return scanNodeCaches()
}
