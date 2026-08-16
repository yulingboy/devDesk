import { access, lstat, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { shell } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Worker } from 'node:worker_threads'
import type {
  GlobalPackage,
  NodeCacheSnapshot,
  NodeEnvironmentPath,
  NodeInstall,
  NodeRegistry,
  NodeRegistryDraft,
  NodeRelease,
  NodeState,
  NodeTask
} from '@shared/domain'
import { getStoreDirectory, store } from '@main/infrastructure/store'
import { createId, requiredText } from './common'
import createNodeInstallWorker from '@main/workers/node-install-worker?nodeWorker'

const execFileAsync = promisify(execFile)
const packageManagerNames = ['npm', 'pnpm', 'yarn', 'bun'] as const
type PackageManagerName = (typeof packageManagerNames)[number]
const activeInstallWorkers = new Map<string, Worker>()
const activeInstallVersions = new Set<string>()
const cancelledTaskIds = new Set<string>()

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
  const nvmDirectory = getNodeVersionsDirectory()
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

function getNodeVersionsDirectory(): string {
  if (process.platform === 'win32') {
    return process.env.NVM_HOME || join(homedir(), 'AppData', 'Roaming', 'nvm')
  }
  return process.env.NVM_DIR
    ? join(process.env.NVM_DIR, 'versions', 'node')
    : join(homedir(), '.nvm', 'versions', 'node')
}

function getNvmDirectory(): string {
  return process.env.NVM_DIR || join(homedir(), '.nvm')
}

/** nvm 是 shell 函数而非独立命令，必须从实际脚本位置加载。 */
async function findNvmScript(): Promise<string | undefined> {
  if (process.platform === 'win32') return undefined
  const candidates = [
    join(getNvmDirectory(), 'nvm.sh'),
    join(homedir(), '.nvm', 'nvm.sh'),
    '/opt/homebrew/opt/nvm/nvm.sh',
    '/usr/local/opt/nvm/nvm.sh'
  ]
  for (const candidate of [...new Set(candidates)]) {
    if (
      await access(candidate)
        .then(() => true)
        .catch(() => false)
    )
      return candidate
  }
  return undefined
}

function resolveArchive(version: string): { fileName: string; fileTokens: string[] } {
  const arch = process.arch === 'ia32' ? 'x86' : process.arch
  if (!['x64', 'arm64', 'x86'].includes(arch)) throw new Error(`不支持的系统架构：${process.arch}`)
  if (process.platform === 'win32') {
    const token = `win-${arch}`
    return { fileName: `node-v${version}-${token}.zip`, fileTokens: [token, `${token}-zip`] }
  }
  if (process.platform === 'darwin') {
    const token = `darwin-${arch}`
    const osxToken = arch === 'arm64' ? 'osx-arm64-tar' : 'osx-x64-tar'
    return { fileName: `node-v${version}-${token}.tar.gz`, fileTokens: [token, osxToken] }
  }
  if (process.platform === 'linux') {
    const token = `linux-${arch}`
    return { fileName: `node-v${version}-${token}.tar.gz`, fileTokens: [token] }
  }
  throw new Error(`不支持的系统平台：${process.platform}`)
}

type InstallWorkerEvent =
  | { type: 'progress'; progress: number; message: string }
  | { type: 'log'; message: string }
  | { type: 'completed' }
  | { type: 'failed'; message: string }

function waitForWorker(
  worker: Worker,
  onEvent: (event: InstallWorkerEvent) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    let queue = Promise.resolve()
    let failure = ''
    worker.on('message', (event: InstallWorkerEvent) => {
      if (event.type === 'failed') failure = event.message
      queue = queue.then(() => onEvent(event))
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      void queue
        .then(() => {
          if (code === 0 && !failure) resolve()
          else reject(new Error(failure || `Node 安装 worker 异常退出（${code}）`))
        })
        .catch(reject)
    })
  })
}

async function readPackageManagerRegistry(name: string): Promise<string> {
  if (name !== 'bun') return runCommand(name, ['config', 'get', 'registry']).catch(() => '')
  const content = await readFile(join(homedir(), '.bunfig.toml'), 'utf8').catch(() => '')
  let inInstallSection = false
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (/^\[.+\]$/.test(line)) inInstallSection = line === '[install]'
    const dotted = line.match(/^install\.registry\s*=\s*["'](.+)["']$/)?.[1]
    const section = inInstallSection ? line.match(/^registry\s*=\s*["'](.+)["']$/)?.[1] : undefined
    if (dotted || section) return dotted || section || ''
  }
  return ''
}

async function writeBunRegistry(registry: string): Promise<void> {
  const path = join(homedir(), '.bunfig.toml')
  const lines = (await readFile(path, 'utf8').catch(() => '')).split(/\r?\n/)
  const installStart = lines.findIndex((line) => line.trim() === '[install]')
  if (installStart < 0) {
    if (lines.some((line) => line.trim())) lines.push('')
    lines.push('[install]', `registry = "${registry}"`)
  } else {
    let installEnd = lines.findIndex(
      (line, index) => index > installStart && /^\s*\[.+\]\s*$/.test(line)
    )
    if (installEnd < 0) installEnd = lines.length
    const registryLine = lines.findIndex(
      (line, index) => index > installStart && index < installEnd && /^\s*registry\s*=/.test(line)
    )
    if (registryLine >= 0) lines[registryLine] = `registry = "${registry}"`
    else lines.splice(installStart + 1, 0, `registry = "${registry}"`)
  }
  await writeFile(path, `${lines.join('\n').trimEnd()}\n`, 'utf8')
}

function validatePackageManager(value: string): PackageManagerName {
  if (!packageManagerNames.includes(value as PackageManagerName))
    throw new Error(`不支持的包管理器：${value}`)
  return value as PackageManagerName
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

async function readNvmDefaultVersion(): Promise<string> {
  if (!(await findNvmScript())) return ''
  const output = await runNvm('nvm version default').catch(() => '')
  const version = output.trim().replace(/^v/, '')
  return /^\d+\.\d+\.\d+$/.test(version) ? version : ''
}

/** 汇总真实命令状态，同时保留任务、镜像和缓存等持久化数据。 */
export async function getNodeState(): Promise<NodeState> {
  const saved = normalizeState(await store.node.read())
  const settings = await store.settings.read()
  const packageManager = settings.node.packageManager || saved.packageManager || 'pnpm'
  const installed = await installedVersions()
  const packageManagers = await packageManagerStatus(packageManager)
  const registry = settings.node.registry || saved.registry
  const defaultVersion = (await readNvmDefaultVersion()) || saved.defaultVersion
  const state: NodeState = {
    ...saved,
    currentVersion: (await commandVersion('node')).replace(/^v/, ''),
    defaultVersion,
    nodePath: process.env.PATH ?? '',
    nvmAvailable: Boolean(await findNvmScript()),
    nrmAvailable: Boolean(await commandVersion('nrm')),
    registry,
    packageManager,
    packageManagerVersion:
      packageManagers.find((item) => item.name === packageManager)?.version ?? '',
    packageManagers,
    registries: saved.registries.map((item) => ({ ...item, isCurrent: item.url === registry })),
    installed: installed.map((item) => ({
      ...item,
      isDefault: item.version === defaultVersion
    }))
  }
  await store.node.write(state)
  return state
}

export async function listNodeReleases(filter?: {
  keyword?: string
  channel?: 'all' | 'lts' | 'current'
  refresh?: boolean
}): Promise<NodeRelease[]> {
  const settings = await store.settings.read()
  const cached = await store.nodeReleases.read()
  const cacheValid =
    cached && Date.now() - Date.parse(cached.fetchedAt) < 60 * 60 * 1_000 && cached.items.length > 0
  let releases: NodeRelease[]
  if (!filter?.refresh && cacheValid) {
    releases = cached.items
  } else {
    try {
      releases = await fetchNodeReleaseIndex(settings.node.indexUrl)
      await store.nodeReleases.write({ fetchedAt: new Date().toISOString(), items: releases })
    } catch (error) {
      // 网络短暂不可用时保留上次完整解析结果，安装流程仍会重新校验目标版本。
      if (cached?.items.length) releases = cached.items
      else throw error
    }
  }
  return releases.filter((release) => {
    const keyword = filter?.keyword?.trim().toLowerCase()
    const matchKeyword =
      !keyword ||
      release.version.toLowerCase().includes(keyword) ||
      release.lts?.toString().toLowerCase().includes(keyword) ||
      release.npm?.toLowerCase().includes(keyword)
    const matchChannel =
      !filter?.channel ||
      filter.channel === 'all' ||
      (filter.channel === 'lts' ? Boolean(release.lts) : release.lts === false)
    return matchKeyword && matchChannel
  })
}

/** 直接请求 Node 官方 index.json，并在主进程统一校验超时、HTTP 状态和数据结构。 */
async function fetchNodeReleaseIndex(indexUrl: string): Promise<NodeRelease[]> {
  let response: Response
  try {
    response = await fetch(indexUrl, { signal: AbortSignal.timeout(15_000) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new Error('请求 Node 版本索引超时，请检查网络或下载源设置')
    throw new Error('无法请求 Node 版本索引，请检查网络或下载源设置')
  }
  if (!response.ok) throw new Error(`Node 版本索引请求失败（HTTP ${response.status}）`)
  let value: unknown
  try {
    value = await response.json()
  } catch {
    throw new Error('Node 版本索引不是有效的 JSON 数据')
  }
  if (!Array.isArray(value)) throw new Error('Node 版本索引格式无效')

  const archive = resolveArchive('0.0.0')
  const releases = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as {
      version?: unknown
      date?: unknown
      lts?: unknown
      npm?: unknown
      security?: unknown
      files?: unknown
    }
    const version = typeof raw.version === 'string' ? raw.version.replace(/^v/, '') : ''
    if (!/^\d+\.\d+\.\d+$/.test(version)) return []
    const files = Array.isArray(raw.files)
      ? raw.files.filter((file): file is string => typeof file === 'string')
      : []
    const lts: string | false = typeof raw.lts === 'string' ? raw.lts : false
    return [
      {
        version: `v${version}`,
        date: typeof raw.date === 'string' ? raw.date : undefined,
        lts,
        npm: typeof raw.npm === 'string' ? raw.npm : undefined,
        security: raw.security === true,
        files,
        platformSupported:
          !files.length || archive.fileTokens.some((token) => files.includes(token))
      }
    ]
  })
  if (!releases.length) throw new Error('Node 版本索引中没有可识别的版本数据')
  return releases
}

async function runNvm(command: string): Promise<string> {
  if (process.platform === 'win32')
    throw new Error('当前版本暂不支持 Windows nvm 自动安装，请使用 nvm-windows 后重试')
  const nvmScript = await findNvmScript()
  if (!nvmScript) throw new Error('未找到 nvm 脚本，请安装 nvm 后重试')
  const script = `. ${JSON.stringify(nvmScript)}; ${command}`
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
  if (activeInstallVersions.has(version)) throw new Error(`Node ${version} 已有安装任务正在执行`)
  activeInstallVersions.add(version)
  const before = await store.node
    .read()
    .then(normalizeState)
    .catch((error: unknown) => {
      activeInstallVersions.delete(version)
      throw error
    })
  const task = {
    id: createId('node-task'),
    version,
    status: 'waiting' as const,
    progress: 0,
    message: '等待安装',
    startedAt: new Date().toISOString(),
    logs: [`${new Date().toLocaleString()} 开始安装 Node ${version}`]
  }
  const started = { ...before, tasks: [...before.tasks, task] }
  await store.node.write(started).catch((error: unknown) => {
    activeInstallVersions.delete(version)
    throw error
  })
  onProgress?.(started)
  try {
    const existingInstall = (await getNodeState()).installed.find(
      (item) => item.version === version
    )
    let existing = false
    if (existingInstall) {
      const executable =
        process.platform === 'win32'
          ? join(existingInstall.path, 'node.exe')
          : join(existingInstall.path, 'bin', 'node')
      existing =
        (await execFileAsync(executable, ['--version'])
          .then(({ stdout }) => stdout.trim().replace(/^v/, '') === version)
          .catch(() => false)) === true
    }
    if (!existing) {
      const settings = await store.settings.read()
      const releases = await listNodeReleases({ refresh: true })
      const release = releases.find((item) => item.version.replace(/^v/, '') === version)
      if (!release) throw new Error(`未找到 Node ${version} 的发布信息`)
      const archive = resolveArchive(version)
      if (
        release.files?.length &&
        !archive.fileTokens.some((token) => release.files?.includes(token))
      )
        throw new Error(`Node ${version} 没有适用于当前系统和架构的安装包`)
      const source = settings.node.downloadSource.replace(/\/+$/, '')
      const downloads = join(getStoreDirectory(), 'node-downloads')
      const worker = createNodeInstallWorker({
        workerData: {
          // 同版本的并发重试也必须使用独立归档，避免 worker 覆盖彼此的下载内容。
          archivePath: join(downloads, `${task.id}-${archive.fileName}`),
          checksumUrl: `${source}/v${version}/SHASUMS256.txt`,
          downloadUrl: `${source}/v${version}/${archive.fileName}`,
          extractPath: join(downloads, `extract-${version}-${task.id}`),
          fileName: archive.fileName,
          installPath: join(getNodeVersionsDirectory(), `v${version}`),
          version
        }
      })
      activeInstallWorkers.set(task.id, worker)
      try {
        await waitForWorker(worker, async (event) => {
          if (event.type === 'failed' || event.type === 'completed') return
          const latest = normalizeState(await store.node.read())
          const next = {
            ...latest,
            tasks: latest.tasks.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status:
                      event.type === 'progress' && event.progress >= 76
                        ? ('extracting' as const)
                        : ('downloading' as const),
                    progress: event.type === 'progress' ? event.progress : item.progress,
                    message: event.type === 'progress' ? event.message : item.message,
                    logs: event.type === 'log' ? [...item.logs, event.message] : item.logs
                  }
                : item
            )
          }
          await store.node.write(next)
          onProgress?.(next)
        })
      } finally {
        activeInstallWorkers.delete(task.id)
      }
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
    activeInstallVersions.delete(version)
    return completed
  } catch (error) {
    const cancelled = cancelledTaskIds.delete(task.id)
    const message = cancelled
      ? '用户已取消安装'
      : error instanceof Error
        ? error.message
        : '安装失败'
    const latest = normalizeState(await store.node.read())
    const failed = {
      ...latest,
      tasks: latest.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: cancelled ? ('cancelled' as const) : ('failed' as const),
              progress: cancelled ? item.progress : 100,
              message,
              finishedAt: new Date().toISOString(),
              logs: [...item.logs, message]
            }
          : item
      )
    }
    await store.node.write(failed)
    onProgress?.(failed)
    activeInstallVersions.delete(version)
    throw error
  } finally {
    activeInstallVersions.delete(version)
  }
}

/** 仅终止当前应用创建的 worker，已完成任务不能被取消。 */
export async function cancelNodeTask(id: string): Promise<NodeState> {
  const taskId = requiredText(id, '任务 ID', 120)
  const worker = activeInstallWorkers.get(taskId)
  if (!worker) throw new Error('该安装任务未在运行，无法取消')
  cancelledTaskIds.add(taskId)
  await worker.terminate()
  return getNodeState()
}

export async function retryNodeTask(id: string): Promise<NodeState> {
  const task = (await listNodeTasks()).find((item) => item.id === requiredText(id, '任务 ID', 120))
  if (!task) throw new Error('安装任务不存在')
  if (!['failed', 'cancelled'].includes(task.status))
    throw new Error('只有失败或已取消的任务可以重试')
  return installNode({ version: task.version })
}

export async function clearNodeTasks(): Promise<NodeState> {
  const state = normalizeState(await store.node.read())
  const tasks = state.tasks.filter((task) =>
    ['waiting', 'downloading', 'extracting'].includes(task.status)
  )
  const next = { ...state, tasks }
  await store.node.write(next)
  return next
}

export async function switchNode(versionInput: string, setDefault: boolean): Promise<NodeState> {
  const version = requiredText(versionInput, 'Node 版本', 40).replace(/^v/, '')
  if (!setDefault) throw new Error('桌面应用无法修改父终端环境，请使用“在终端中使用”或设为默认版本')
  await runNvm(`nvm alias default ${version}`)
  const state = await getNodeState()
  const next = { ...state, defaultVersion: version }
  await store.node.write(next)
  return next
}

/** 在新的 macOS Terminal 会话中加载 nvm 并启用指定版本，避免伪造进程级切换结果。 */
export async function useNodeInTerminal(versionInput: string): Promise<void> {
  const version = requiredText(versionInput, 'Node 版本', 40).replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Node 版本号无效')
  if (process.platform !== 'darwin')
    throw new Error('当前平台暂不支持从应用直接启动带 Node 环境的终端，请在终端执行 nvm use')
  const nvmScript = await findNvmScript()
  if (!nvmScript) throw new Error('未找到 nvm 脚本，请安装 nvm 后重试')
  const command = `bash -lc ${JSON.stringify(`. ${JSON.stringify(nvmScript)}; nvm use ${version}; exec $SHELL -l`)}`
  await execFileAsync('osascript', [
    '-e',
    `tell application "Terminal" to do script ${JSON.stringify(command)}`
  ]).catch(() => {
    throw new Error('无法启动 Terminal，请确认系统允许开发工坊自动化控制 Terminal')
  })
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
    const outdated = parseOutdatedPackages(
      await runCommand('pnpm', ['outdated', '-g', '--format', 'json']).catch(() => '')
    )
    return Object.entries(dependencies).map(([name, value]) => ({
      name,
      current: value.version ?? '',
      wanted: outdated.get(name)?.wanted,
      latest: outdated.get(name)?.latest
    }))
  }
  if (manager === 'yarn') {
    const output = await runCommand('yarn', ['global', 'list', '--json']).catch(() => '')
    return output.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/info\s+"([^@]+)@([^" ]+)"/)
      return match ? [{ name: match[1], current: match[2] }] : []
    })
  }
  if (manager === 'bun') {
    const output = await runCommand('bun', ['pm', 'ls', '-g', '--json']).catch(() => '')
    try {
      const parsed = JSON.parse(output) as { packages?: Array<{ name?: string; version?: string }> }
      return (parsed.packages ?? []).flatMap((item) =>
        item.name ? [{ name: item.name, current: item.version ?? '' }] : []
      )
    } catch {
      return []
    }
  }
  return []
}

function parseOutdatedPackages(raw: string): Map<string, Pick<GlobalPackage, 'wanted' | 'latest'>> {
  if (!raw.trim()) return new Map()
  try {
    const parsed = JSON.parse(raw) as unknown
    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null
        ? Object.entries(parsed).map(([name, value]) => ({
            name,
            ...(typeof value === 'object' && value !== null ? value : {})
          }))
        : []
    return new Map(
      rows.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const row = item as { name?: unknown; wanted?: unknown; latest?: unknown }
        return typeof row.name === 'string'
          ? [[row.name, { wanted: String(row.wanted ?? ''), latest: String(row.latest ?? '') }]]
          : []
      })
    )
  } catch {
    return new Map()
  }
}

export async function listGlobalPackages(keyword = ''): Promise<GlobalPackage[]> {
  const state = await getNodeState()
  if (!state.packageManagerVersion) throw new Error(`默认包管理器 ${state.packageManager} 不可用`)
  const packages = await readGlobalPackages(state.packageManager)
  await store.node.write({ ...state, globalPackages: packages })
  const query = keyword.trim().toLowerCase()
  return query ? packages.filter((item) => item.name.toLowerCase().includes(query)) : packages
}

/** 刷新默认包管理器的过期信息；不支持的命令仅返回当前已读取版本。 */
export async function checkGlobalOutdated(): Promise<GlobalPackage[]> {
  const state = await getNodeState()
  if (!state.packageManagerVersion) throw new Error(`默认包管理器 ${state.packageManager} 不可用`)
  const packages = await readGlobalPackages(state.packageManager)
  await store.node.write({ ...state, globalPackages: packages })
  return packages
}

/** 路径快照同时保留不存在的候选目录，帮助用户诊断运行时配置。 */
export async function getNodeEnvironmentPaths(): Promise<NodeEnvironmentPath[]> {
  // Electron 的 process.execPath 指向应用本体，必须通过 Node 子进程读取真实运行时路径。
  const nodeExecutable = await runCommand('node', ['-p', 'process.execPath']).catch(() => '')
  const npmCache = await runCommand('npm', ['config', 'get', 'cache']).catch(() =>
    join(homedir(), '.npm')
  )
  const pnpmStore = await runCommand('pnpm', ['store', 'path']).catch(() =>
    join(homedir(), '.pnpm-store')
  )
  const paths = [
    { name: 'Node 可执行文件', path: nodeExecutable || '未找到 Node 可执行文件' },
    { name: 'nvm 根目录', path: process.env.NVM_DIR || join(homedir(), '.nvm') },
    { name: 'Node 版本目录', path: getNodeVersionsDirectory() },
    { name: 'npm 缓存', path: npmCache },
    { name: 'pnpm Store', path: pnpmStore },
    { name: 'Yarn 缓存', path: join(homedir(), 'Library', 'Caches', 'Yarn') },
    { name: 'Bun 缓存', path: join(homedir(), '.bun', 'install', 'cache') }
  ]
  return Promise.all(
    paths.map(async (item) => ({
      ...item,
      exists:
        nodeExecutable || item.name !== 'Node 可执行文件'
          ? await access(item.path)
              .then(() => true)
              .catch(() => false)
          : false
    }))
  )
}

/** 任务信息持久化在 Node 状态文件中，读取时按最近开始时间排序。 */
export async function listNodeTasks(): Promise<NodeTask[]> {
  return normalizeState(await store.node.read()).tasks.sort(
    (left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)
  )
}

/** 环境页只允许打开已展示的本地路径，失败时返回平台相关中文错误。 */
export async function openNodePath(pathInput: string): Promise<void> {
  const path = resolve(requiredText(pathInput, '环境路径', 1_000))
  const error = await shell.openPath(path)
  if (error) throw new Error(`无法打开环境路径：${error}`)
}

/** 更改默认包管理器时同步设置文件，Node 概览和全局包操作随即使用新值。 */
export async function setPackageManager(managerInput: string): Promise<NodeState> {
  const manager = validatePackageManager(managerInput)
  if (!(await commandVersion(manager))) throw new Error(`包管理器 ${manager} 尚未安装`)
  const settings = await store.settings.read()
  await store.settings.write({
    ...settings,
    node: { ...settings.node, packageManager: manager }
  })
  return getNodeState()
}

/** npm、pnpm 和 yarn 通过各自 CLI 维护 Registry，bun 写入用户级 bunfig.toml。 */
export async function setPackageManagerRegistry(
  managerInput: string,
  registryInput: string
): Promise<NodeState> {
  const manager = validatePackageManager(managerInput)
  const registry = validateRegistryUrl(registryInput)
  if (!(await commandVersion(manager))) throw new Error(`包管理器 ${manager} 尚未安装`)
  if (manager === 'bun') await writeBunRegistry(registry)
  else
    await runCommand(manager, ['config', 'set', 'registry', registry]).catch(() => {
      throw new Error(`设置 ${manager} Registry 失败，请检查配置文件权限`)
    })
  const settings = await store.settings.read()
  await store.settings.write({
    ...settings,
    node: {
      ...settings.node,
      registry: settings.node.packageManager === manager ? registry : settings.node.registry
    }
  })
  return getNodeState()
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

type CacheId = NonNullable<NodeCacheSnapshot['id']>

async function resolveCachePaths(): Promise<
  Array<Pick<NodeCacheSnapshot, 'id' | 'name' | 'path' | 'clearable'>>
> {
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
    { id: 'npm', name: 'npm 缓存', path: npmPath, clearable: true },
    { id: 'pnpm', name: 'pnpm Store', path: pnpmPath, clearable: true },
    { id: 'yarn', name: 'yarn 缓存', path: yarnPath, clearable: true },
    {
      id: 'bun',
      name: 'Bun 缓存',
      path: join(homedir(), '.bun', 'install', 'cache'),
      clearable: true
    },
    {
      id: 'nvm',
      name: 'nvm 版本目录',
      path: getNodeVersionsDirectory(),
      clearable: false
    }
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

async function clearPackageManagerCache(id: CacheId): Promise<void> {
  const commands: Record<Exclude<CacheId, 'nvm'>, [string, string[]]> = {
    npm: ['npm', ['cache', 'clean', '--force']],
    pnpm: ['pnpm', ['store', 'prune']],
    yarn: ['yarn', ['cache', 'clean']],
    bun: ['bun', ['pm', 'cache', 'rm']]
  }
  if (id === 'nvm') throw new Error('nvm 版本目录不是缓存，不能在此清理')
  const [command, args] = commands[id]
  if (!(await commandVersion(command))) throw new Error(`${command} 不可用，无法清理对应缓存`)
  await runCommand(command, args).catch(() => {
    throw new Error(`${command} 缓存清理失败，请检查权限和当前任务状态`)
  })
}

/** 清理指定缓存；保留原有全量方法以兼容旧界面和预加载契约。 */
export async function clearNodeCache(id: CacheId): Promise<NodeState> {
  await clearPackageManagerCache(id)
  return scanNodeCaches()
}

export async function clearNodeCaches(): Promise<NodeState> {
  const state = await getNodeState()
  const available = state.packageManagers
    .filter((item) => item.available)
    .map((item) => item.name as CacheId)
  const failures: string[] = []
  for (const id of available) {
    await clearPackageManagerCache(id).catch((error: unknown) => {
      failures.push(error instanceof Error ? error.message : `${id} 缓存清理失败`)
    })
  }
  if (failures.length) throw new Error(failures.join('；'))
  return scanNodeCaches()
}
