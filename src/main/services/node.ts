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
  NodeOpenPathTarget,
  NodeRegistry,
  NodeRegistryDraft,
  NodeRelease,
  NodeRuntimeCapabilities,
  NodeState,
  NodeTask
} from '@shared/domain'
import { DEFAULT_NODE_DOWNLOAD_SETTINGS } from '@shared/node-download-sources'
import { getStoreDirectory, store } from '@main/infrastructure/store'
import {
  getUserShellEnvironment,
  resetUserShellEnvironment,
  setUserNodeBinOverride
} from '@main/infrastructure/shell-environment'
import { createId, requiredText } from './common'
import { mergeDetectedNodeState } from './node-state'
import createNodeInstallWorker from '@main/workers/node-install-worker?nodeWorker'

const execFileAsync = promisify(execFile)
const packageManagerNames = ['npm', 'pnpm', 'yarn', 'bun'] as const
type PackageManagerName = (typeof packageManagerNames)[number]
const activeInstallWorkers = new Map<string, Worker>()
const activeInstallVersions = new Set<string>()
const cancelledTaskIds = new Set<string>()
let nodeStateMutation: Promise<void> = Promise.resolve()
let nvmVersionRequest: Promise<string> | undefined
let nodeProbeCache: { key: string; expiresAt: number; state: NodeState } | undefined
let nodeProbeRequest: { key: string; promise: Promise<NodeState> } | undefined

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
    installed: Array.isArray(value?.installed) ? value.installed : [],
    tasks: Array.isArray(value?.tasks) ? value.tasks : [],
    packageManagers: value?.packageManagers ?? [],
    registries: value?.registries?.length ? value.registries : fallback.registries,
    globalPackages: value?.globalPackages ?? [],
    caches: value?.caches ?? []
  }
}

/**
 * Node 任务、缓存和包列表都保存在同一个 JSON 文件中。
 * 变更必须在队列内重新读取最新快照，避免并发 IPC 用旧快照覆盖任务进度。
 */
async function updateNodeState(
  updater: (state: NodeState) => NodeState | Promise<NodeState>
): Promise<NodeState> {
  const previous = nodeStateMutation
  let resolveMutation!: () => void
  nodeStateMutation = new Promise<void>((resolve) => {
    resolveMutation = resolve
  })
  try {
    await previous.catch(() => undefined)
    const current = normalizeState(await store.node.read())
    const next = await updater(current)
    await store.node.write(next)
    return next
  } finally {
    resolveMutation()
  }
}

async function runCommand(command: string, args: string[]): Promise<string> {
  const env = await getUserShellEnvironment()
  const { stdout } = await execFileAsync(command, args, {
    env: { ...env, CI: '1', npm_config_yes: 'true' },
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024
  })
  return stdout.trim()
}

/** 部分查询命令以非零状态表示“发现结果”，但 stdout 仍是可解析数据。 */
async function runCommandResult(command: string, args: string[]): Promise<string> {
  try {
    return await runCommand(command, args)
  } catch (error) {
    const stdout = (error as { stdout?: unknown }).stdout
    return typeof stdout === 'string' ? stdout.trim() : ''
  }
}

async function commandVersion(command: string): Promise<string> {
  return runCommand(command, ['--version']).catch(() => '')
}

async function installedVersions(): Promise<NodeInstall[]> {
  const nvmDirectory = getNodeVersionsDirectory()
  const entries = await readdir(nvmDirectory).catch(() => [])
  return entries
    .filter((entry) => /^v?\d+\.\d+\.\d+$/.test(entry))
    .map((version) => ({
      version: version.replace(/^v/, ''),
      path: join(nvmDirectory, version),
      isCurrent: false,
      isDefault: false
    }))
}

function nodeBinDirectory(install: NodeInstall): string {
  return process.platform === 'win32' ? install.path : join(install.path, 'bin')
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

/**
 * 只根据 nvm.sh 文件存在不能判断 nvm 可用；必须加载脚本并真正运行 nvm --version。
 * 版本号同时作为界面能力快照展示，避免用户以为只是扫到了一个文件。
 */
async function readNvmVersion(): Promise<string> {
  nvmVersionRequest ??= (async () => {
    if (process.platform === 'win32') return commandVersion('nvm')
    const nvmScript = await findNvmScript()
    if (!nvmScript) return ''
    return runCommand('bash', ['-lc', `. ${JSON.stringify(nvmScript)}; nvm --version`]).catch(
      () => ''
    )
  })()
  try {
    return await nvmVersionRequest
  } finally {
    nvmVersionRequest = undefined
  }
}

async function getNodeCapabilities(): Promise<NodeRuntimeCapabilities> {
  if (process.platform === 'win32') {
    const nvmVersion = await readNvmVersion()
    const available = Boolean(nvmVersion)
    return available
      ? {
          canInstall: true,
          canSwitch: true,
          canSetDefault: true,
          canUseInTerminal: false,
          nvmVersion,
          message: '检测到 nvm-windows；切换版本会更新系统 Node 软链接。'
        }
      : {
          canInstall: false,
          canSwitch: false,
          canSetDefault: false,
          canUseInTerminal: false,
          message: '未检测到 nvm-windows，无法安全管理 Node 版本。'
        }
  }
  const nvmVersion = await readNvmVersion()
  const available = Boolean(nvmVersion)
  return available
    ? {
        canInstall: true,
        canSwitch: true,
        canSetDefault: true,
        canUseInTerminal: process.platform === 'darwin',
        nvmVersion,
        message:
          process.platform === 'darwin'
            ? '“在终端中使用”会在新 Terminal 会话中启用指定版本。'
            : '可设置 nvm 默认版本。'
      }
    : {
        canInstall: false,
        canSwitch: false,
        canSetDefault: false,
        canUseInTerminal: false,
        message: '未检测到可执行的 nvm，安装、切换和删除 Node 版本不可用。'
      }
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
      const [version, registry] = await Promise.all([
        commandVersion(name),
        readPackageManagerRegistry(name)
      ])
      return {
        name,
        available: Boolean(version),
        version,
        registry: version ? registry : '',
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

const ansiColorPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

/** nrm 输出使用星号标记当前镜像，并用横线对齐名称与 URL。 */
function parseNrmRegistries(
  output: string,
  currentName: string,
  saved: NodeRegistry[]
): NodeRegistry[] {
  return output.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.replace(ansiColorPattern, '').trim()
    const match = line.match(/^(\*?)\s*([a-zA-Z0-9_-]+)\s+-+\s+(https?:\/\/\S+)/)
    if (!match) return []
    const [, marker, name, rawUrl] = match
    const url = rawUrl.replace(/\/$/, '')
    const previous = saved.find((item) => item.name === name)
    return [
      {
        id: previous?.id ?? `registry-${name}`,
        name,
        url,
        latencyMs: previous?.latencyMs,
        isCurrent: marker === '*' || name === currentName
      }
    ]
  })
}

async function readNrmRegistrySnapshot(saved: NodeRegistry[]): Promise<NodeRegistry[]> {
  const [output, currentName] = await Promise.all([
    runCommand('nrm', ['ls']),
    runCommand('nrm', ['current']).catch(() => '')
  ])
  return parseNrmRegistries(output, currentName.trim(), saved)
}

async function probeNodeState(
  saved: NodeState,
  settings: Awaited<ReturnType<typeof store.settings.read>>
): Promise<NodeState> {
  const packageManager = settings.node.packageManager || saved.packageManager || 'pnpm'
  const installed = await installedVersions()
  const activeInstall = installed.find((item) => item.version === saved.activeVersion)
  setUserNodeBinOverride(activeInstall ? nodeBinDirectory(activeInstall) : undefined)

  // 这些探测互不依赖，并行执行可避免多个 CLI 启动时间在首屏串行累加。
  const [
    currentVersionValue,
    packageManagers,
    defaultVersionValue,
    capabilities,
    nrmVersion,
    nrmRegistries,
    nodePath
  ] = await Promise.all([
    commandVersion('node'),
    packageManagerStatus(packageManager),
    readNvmDefaultVersion(),
    getNodeCapabilities(),
    commandVersion('nrm'),
    readNrmRegistrySnapshot(saved.registries).catch(() => []),
    runCommand('node', ['-p', 'process.execPath']).catch(() => saved.nodePath)
  ])
  const currentVersion = currentVersionValue.replace(/^v/, '')
  const defaultVersion = defaultVersionValue || saved.defaultVersion
  const nrmAvailable = Boolean(nrmVersion)
  const registries = nrmAvailable && nrmRegistries.length ? nrmRegistries : saved.registries
  const registry =
    registries.find((item) => item.isCurrent)?.url || settings.node.registry || saved.registry
  const state: NodeState = {
    ...saved,
    currentVersion,
    activeVersion: activeInstall?.version,
    defaultVersion,
    // nodePath 表示实际可执行文件，不是 PATH 环境变量；完整路径快照由环境页单独展示。
    nodePath,
    nvmAvailable: capabilities.canInstall,
    nrmAvailable,
    registry,
    packageManager,
    packageManagerVersion:
      packageManagers.find((item) => item.name === packageManager)?.version ?? '',
    packageManagers,
    registries: registries.map((item) => ({ ...item, isCurrent: item.url === registry })),
    installed: installed.map((item) => ({
      ...item,
      isCurrent: item.version === currentVersion,
      isDefault: item.version === defaultVersion
    })),
    capabilities
  }
  return state
}

/** 汇总真实命令状态；稳定 CLI 探测短时缓存，任务、缓存和全局包始终读取最新持久化值。 */
export async function getNodeState(refresh = false): Promise<NodeState> {
  const [savedValue, settings] = await Promise.all([store.node.read(), store.settings.read()])
  const saved = normalizeState(savedValue)
  const key = `${settings.node.packageManager}:${saved.activeVersion ?? ''}`
  let detected: NodeState
  if (!refresh && nodeProbeCache?.key === key && nodeProbeCache.expiresAt > Date.now()) {
    detected = nodeProbeCache.state
  } else if (!refresh && nodeProbeRequest?.key === key) {
    detected = await nodeProbeRequest.promise
  } else {
    const promise = probeNodeState(saved, settings)
    nodeProbeRequest = { key, promise }
    try {
      detected = await promise
      nodeProbeCache = { key, state: detected, expiresAt: Date.now() + 20_000 }
    } finally {
      if (nodeProbeRequest?.promise === promise) nodeProbeRequest = undefined
    }
  }
  const merged = mergeDetectedNodeState(saved, detected)
  return {
    ...merged,
    registries: merged.registries.map((registry) => ({
      ...registry,
      latencyMs:
        saved.registries.find((item) => item.id === registry.id || item.name === registry.name)
          ?.latencyMs ?? registry.latencyMs
    }))
  }
}

export async function listNodeReleases(filter?: {
  keyword?: string
  channel?: 'all' | 'lts' | 'current'
  refresh?: boolean
}): Promise<NodeRelease[]> {
  const settings = await store.settings.read()
  const cached = await store.nodeReleases.read()
  const normalizeSourceUrl = (value: string): string => value.trim().replace(/\/+$/, '')
  const currentSourceUrl = normalizeSourceUrl(settings.node.indexUrl)
  const cachedSourceUrl = cached?.sourceUrl
    ? normalizeSourceUrl(cached.sourceUrl)
    : normalizeSourceUrl(DEFAULT_NODE_DOWNLOAD_SETTINGS.indexUrl)
  const cacheMatchesSource = cachedSourceUrl === currentSourceUrl
  const cacheValid =
    cached &&
    cacheMatchesSource &&
    Date.now() - Date.parse(cached.fetchedAt) < 60 * 60 * 1_000 &&
    cached.items.length > 0
  let releases: NodeRelease[]
  if (!filter?.refresh && cacheValid) {
    releases = cached.items
  } else {
    try {
      releases = await fetchNodeReleaseIndex(settings.node.indexUrl)
      await store.nodeReleases.write({
        fetchedAt: new Date().toISOString(),
        items: releases,
        sourceUrl: settings.node.indexUrl
      })
    } catch (error) {
      // 网络短暂不可用时保留上次完整解析结果，安装流程仍会重新校验目标版本。
      if (cacheMatchesSource && cached?.items.length) releases = cached.items
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
  const nvmVersion = await readNvmVersion()
  if (!nvmVersion) throw new Error('未检测到可执行的 nvm，请检查 nvm 安装和 Shell 配置')
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
  const capabilities = await getNodeCapabilities()
  if (!capabilities.canInstall)
    throw new Error(capabilities.message ?? '当前环境不支持安装 Node 版本')
  if (activeInstallVersions.has(version)) throw new Error(`Node ${version} 已有安装任务正在执行`)
  activeInstallVersions.add(version)
  const task = {
    id: createId('node-task'),
    version,
    status: 'waiting' as const,
    progress: 0,
    message: '等待安装',
    startedAt: new Date().toISOString(),
    logs: [`${new Date().toLocaleString()} 开始安装 Node ${version}`]
  }
  const started = await updateNodeState((current) => ({
    ...current,
    tasks: [...current.tasks, task]
  })).catch((error: unknown) => {
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
        (await execFileAsync(executable, ['--version'], {
          env: await getUserShellEnvironment(),
          timeout: 15_000
        })
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
          const next = await updateNodeState((latest) => ({
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
          }))
          onProgress?.(next)
        })
      } finally {
        activeInstallWorkers.delete(task.id)
      }
    }
    const after = await getNodeState(true)
    const completed = await updateNodeState((latest) => ({
      ...mergeDetectedNodeState(latest, after),
      tasks: latest.tasks.map((item) =>
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
    }))
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
    const failed = await updateNodeState((latest) => ({
      ...latest,
      tasks: latest.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: cancelled ? ('cancelled' as const) : ('failed' as const),
              progress: cancelled ? item.progress : 100,
              message,
              finishedAt: new Date().toISOString(),
              logs: item.status === 'cancelled' ? item.logs : [...item.logs, message]
            }
          : item
      )
    }))
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
  const cancelled = await updateNodeState((state) => ({
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: 'cancelled' as const,
            message: '用户已取消安装',
            finishedAt: new Date().toISOString(),
            logs: [...task.logs, '用户已取消安装']
          }
        : task
    )
  }))
  await worker.terminate()
  return cancelled
}

export async function retryNodeTask(id: string): Promise<NodeState> {
  const task = (await listNodeTasks()).find((item) => item.id === requiredText(id, '任务 ID', 120))
  if (!task) throw new Error('安装任务不存在')
  if (!['failed', 'cancelled'].includes(task.status))
    throw new Error('只有失败或已取消的任务可以重试')
  return installNode({ version: task.version })
}

export async function clearNodeTasks(): Promise<NodeState> {
  return updateNodeState((state) => ({
    ...state,
    tasks: state.tasks.filter((task) =>
      ['waiting', 'downloading', 'extracting'].includes(task.status)
    )
  }))
}

export async function switchNode(versionInput: string, setDefault: boolean): Promise<NodeState> {
  const version = requiredText(versionInput, 'Node 版本', 40).replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Node 版本号无效')
  const state = await getNodeState()
  const install = state.installed.find((item) => item.version === version)
  if (!install) throw new Error(`Node ${version} 尚未安装，无法切换`)
  const capabilities = await getNodeCapabilities()
  if (!capabilities.canSwitch) throw new Error(capabilities.message ?? '当前环境无法切换 Node 版本')

  if (process.platform === 'win32') {
    await runCommand('nvm', ['use', version]).catch(() => {
      throw new Error('nvm-windows 切换失败，请以管理员权限确认版本已安装')
    })
    resetUserShellEnvironment()
    await updateNodeState((current) => ({
      ...current,
      activeVersion: version,
      ...(setDefault ? { defaultVersion: version } : {})
    }))
    return getNodeState(true)
  }

  if (setDefault) {
    await runNvm(`nvm alias default ${version}`)
    await updateNodeState((current) => ({ ...current, defaultVersion: version }))
  } else {
    // nvm use 只影响其子 Shell；工作台另行固定 PATH，保证后续包管理命令真正使用所选版本。
    await runNvm(`nvm use ${version}`)
    setUserNodeBinOverride(nodeBinDirectory(install))
    await updateNodeState((current) => ({ ...current, activeVersion: version }))
  }
  return getNodeState(true)
}

/** 在新的 macOS Terminal 会话中加载 nvm 并启用指定版本，避免伪造进程级切换结果。 */
export async function useNodeInTerminal(versionInput: string): Promise<void> {
  const version = requiredText(versionInput, 'Node 版本', 40).replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Node 版本号无效')
  if (process.platform !== 'darwin')
    throw new Error('当前平台暂不支持从应用直接启动带 Node 环境的终端，请在终端执行 nvm use')
  const nvmScript = await findNvmScript()
  if (!nvmScript) throw new Error('未找到 nvm 脚本，请安装 nvm 后重试')
  if (!(await readNvmVersion()))
    throw new Error('未检测到可执行的 nvm，请检查 nvm 安装和 Shell 配置')
  const command = `bash -lc ${JSON.stringify(`. ${JSON.stringify(nvmScript)}; nvm use ${version}; exec $SHELL -l`)}`
  await execFileAsync('osascript', [
    '-e',
    `tell application "Terminal" to do script ${JSON.stringify(command)}`
  ]).catch(() => {
    throw new Error('无法启动 Terminal，请确认系统允许 DevDesk 自动化控制 Terminal')
  })
}

export async function removeNode(versionInput: string): Promise<NodeState> {
  const version = requiredText(versionInput, 'Node 版本', 40).replace(/^v/, '')
  const state = await getNodeState()
  if (state.currentVersion === version || state.activeVersion === version)
    throw new Error('当前正在使用的 Node 版本不能删除，请先切换版本')
  if (process.platform === 'win32') {
    if (!(await getNodeCapabilities()).canSwitch)
      throw new Error('未检测到 nvm-windows，无法删除 Node 版本')
    await runCommand('nvm', ['uninstall', version]).catch(() => {
      throw new Error('nvm-windows 删除版本失败，请以管理员权限确认版本未被使用')
    })
  } else {
    await runNvm(`nvm uninstall ${version}`)
  }
  if (state.defaultVersion === version)
    await updateNodeState((current) => ({ ...current, defaultVersion: '' }))
  return getNodeState(true)
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
  if (!state.nrmAvailable) throw new Error('未检测到 nrm，请先全局安装 nrm 后再管理镜像')
  const name = requiredText(draft.name, '镜像名称', 60)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('镜像名称只能包含字母、数字、下划线和中划线')
  const url = validateRegistryUrl(draft.url)
  if (
    state.registries.some(
      (item) => item.id !== draft.id && item.name.toLowerCase() === name.toLowerCase()
    )
  )
    throw new Error('镜像名称已存在')
  const previous = draft.id ? state.registries.find((item) => item.id === draft.id) : undefined
  if (draft.id && !previous) throw new Error('镜像不存在')
  const nextItem: NodeRegistry = {
    id: draft.id || createId('registry'),
    name,
    url,
    isCurrent: state.registry === url
  }
  const registries = draft.id
    ? state.registries.map((item) => (item.id === draft.id ? nextItem : item))
    : [...state.registries, nextItem]
  try {
    if (previous) await runCommand('nrm', ['del', previous.name])
    await runCommand('nrm', ['add', name, url])
    if (previous?.isCurrent) await runCommand('nrm', ['use', name])
  } catch {
    // 编辑失败时尽量恢复原镜像，避免 nrm 真实配置与页面快照同时丢失。
    if (previous) {
      await runCommand('nrm', ['add', previous.name, previous.url]).catch(() => undefined)
      if (previous.isCurrent) await runCommand('nrm', ['use', previous.name]).catch(() => undefined)
    }
    throw new Error('写入 nrm 镜像失败，请检查镜像名称、地址和配置权限')
  }
  await updateNodeState((current) => ({ ...current, registries }))
  return (await getNodeState(true)).registries
}

export async function removeNodeRegistry(id: string): Promise<NodeRegistry[]> {
  const state = await getNodeState()
  if (!state.nrmAvailable) throw new Error('未检测到 nrm，请先全局安装 nrm 后再管理镜像')
  const target = state.registries.find((item) => item.id === id)
  if (!target) throw new Error('镜像不存在')
  if (target.isCurrent) throw new Error('当前正在使用的镜像不能删除，请先切换镜像')
  if (state.registries.length <= 1) throw new Error('至少需要保留一个镜像')
  await runCommand('nrm', ['del', target.name]).catch(() => {
    throw new Error('删除 nrm 镜像失败，本地镜像列表未变更，请检查 nrm 配置权限')
  })
  const registries = state.registries.filter((item) => item.id !== id)
  await updateNodeState((current) => ({ ...current, registries }))
  return (await getNodeState(true)).registries
}

export async function useNodeRegistry(id: string): Promise<NodeState> {
  const state = await getNodeState()
  if (!state.nrmAvailable) throw new Error('未检测到 nrm，请先全局安装 nrm 后再管理镜像')
  const target = state.registries.find((item) => item.id === id)
  if (!target) throw new Error('镜像不存在')
  await runCommand('nrm', ['use', target.name])
  const settings = await store.settings.read()
  await store.settings.write({ ...settings, node: { ...settings.node, registry: target.url } })
  await updateNodeState((current) => ({
    ...current,
    registry: target.url,
    registries: current.registries.map((item) => ({ ...item, isCurrent: item.id === id }))
  }))
  return getNodeState(true)
}

export async function testNodeRegistry(id: string): Promise<NodeRegistry[]> {
  const state = await getNodeState()
  if (!state.nrmAvailable) throw new Error('未检测到 nrm，请先全局安装 nrm 后再管理镜像')
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
  const next = await updateNodeState((current) => ({ ...current, registries }))
  return next.registries
}

/** nrm 安装在当前 Node 版本的 npm 全局目录中，不会写入其他 Node 版本。 */
export async function installNrm(): Promise<NodeState> {
  const state = await getNodeState()
  if (state.nrmAvailable) return state
  const npm = state.packageManagers.find((item) => item.name === 'npm')
  if (!npm?.available) throw new Error('当前 Node 没有可用的 npm，无法安装 nrm')
  try {
    await runCommand('npm', ['install', '--global', 'nrm'])
  } catch {
    throw new Error('nrm 安装失败，请检查当前 Node 的 npm、Registry 和网络连接')
  }
  const next = await getNodeState(true)
  if (!next.nrmAvailable) throw new Error('nrm 安装命令已完成，但未检测到 nrm，请刷新环境后重试')
  return next
}

function validatePackageName(value: string): string {
  const name = requiredText(value, '包名', 214)
  if (!/^(?:@[-a-z0-9_.]+\/)?[-a-z0-9_.]+$/i.test(name)) throw new Error('包名格式无效')
  return name
}

/**
 * nvm 的全局包目录随 Node 版本隔离，不能通过共享目录保证原生模块安全。
 * 使用 nvm 官方 reinstall-packages 机制，将来源版本的 npm 全局包重新安装到当前版本。
 */
export async function syncGlobalPackages(sourceVersionInput: string): Promise<GlobalPackage[]> {
  const sourceVersion = requiredText(sourceVersionInput, '来源 Node 版本', 40).replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(sourceVersion)) throw new Error('来源 Node 版本号无效')
  const state = await getNodeState()
  if (!state.capabilities?.canSwitch)
    throw new Error(state.capabilities?.message ?? '未检测到可执行的 nvm，无法同步全局包')
  if (process.platform === 'win32')
    throw new Error('Windows nvm 不支持自动同步全局包，请在终端中手动迁移')
  const targetVersion = state.currentVersion
  if (!targetVersion) throw new Error('当前 Node 版本不可用，无法同步全局包')
  if (sourceVersion === targetVersion) throw new Error('来源版本不能与当前 Node 版本相同')
  if (!state.installed.some((item) => item.version === sourceVersion))
    throw new Error(`来源 Node ${sourceVersion} 尚未安装`)
  try {
    await runNvm(`nvm use ${targetVersion} >/dev/null && nvm reinstall-packages ${sourceVersion}`)
  } catch {
    throw new Error(`从 Node ${sourceVersion} 同步全局包失败，请检查 nvm 和 npm 配置`)
  }
  return listGlobalPackages()
}

async function readGlobalPackages(
  manager: string,
  includeOutdated = false
): Promise<GlobalPackage[]> {
  if (manager === 'npm') {
    const parsed = JSON.parse(
      await runCommand('npm', ['ls', '-g', '--depth=0', '--json']).catch(() => '{}')
    ) as { dependencies?: Record<string, { version?: string }> }
    const outdated = includeOutdated
      ? (JSON.parse(
          (await runCommandResult('npm', ['outdated', '-g', '--json'])) || '{}'
        ) as Record<string, { wanted?: string; latest?: string }>)
      : {}
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
    const outdated = includeOutdated
      ? parseOutdatedPackages(
          await runCommandResult('pnpm', ['outdated', '-g', '--format', 'json'])
        )
      : new Map()
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

/** Yarn/Bun 不稳定地提供全局过期列表时，回退读取当前 Registry 的 dist-tags。 */
async function enrichPackageLatest(
  packages: GlobalPackage[],
  registry: string
): Promise<GlobalPackage[]> {
  const targets = packages.filter((item) => !item.latest).slice(0, 80)
  const latestByName = new Map<string, string>()
  let cursor = 0
  const load = async (): Promise<void> => {
    while (true) {
      const target = targets[cursor++]
      if (!target) return
      try {
        const response = await fetch(
          `${registry.replace(/\/$/, '')}/${encodeURIComponent(target.name)}`,
          { signal: AbortSignal.timeout(8_000) }
        )
        const payload = (await response.json()) as { 'dist-tags'?: { latest?: unknown } }
        const latest = payload['dist-tags']?.latest
        if (response.ok && typeof latest === 'string') latestByName.set(target.name, latest)
      } catch {
        // 网络或私有 Registry 不可用时保留已读取的本地版本，不阻断全局包列表。
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, targets.length) }, load))
  return packages.map((item) => ({
    ...item,
    latest: item.latest || latestByName.get(item.name),
    wanted: item.wanted || latestByName.get(item.name)
  }))
}

/**
 * 全局包列表只需要默认包管理器、可用性和 Registry。
 * 避免调用 getNodeState 重复执行 nvm、nrm 及全部包管理器的状态检测。
 */
async function getGlobalPackageContext(): Promise<{
  manager: PackageManagerName
  registry: string
}> {
  const [saved, settings] = await Promise.all([store.node.read(), store.settings.read()])
  const state = normalizeState(saved)
  const manager = validatePackageManager(
    settings.node.packageManager || state.packageManager || 'pnpm'
  )
  if (!(await commandVersion(manager))) throw new Error(`默认包管理器 ${manager} 不可用`)
  return {
    manager,
    registry: settings.node.registry || state.registry
  }
}

export async function listGlobalPackages(keyword = ''): Promise<GlobalPackage[]> {
  const { manager } = await getGlobalPackageContext()
  // 普通列表完全读取本地状态；联网更新检查只由 checkGlobalOutdated 显式触发。
  const packages = await readGlobalPackages(manager)
  await updateNodeState((current) => ({ ...current, globalPackages: packages }))
  const query = keyword.trim().toLowerCase()
  return query ? packages.filter((item) => item.name.toLowerCase().includes(query)) : packages
}

/** 刷新默认包管理器的过期信息；不支持的命令仅返回当前已读取版本。 */
export async function checkGlobalOutdated(): Promise<GlobalPackage[]> {
  const { manager, registry } = await getGlobalPackageContext()
  const localPackages = await readGlobalPackages(manager, true)
  const packages =
    manager === 'yarn' || manager === 'bun'
      ? await enrichPackageLatest(localPackages, registry)
      : localPackages
  await updateNodeState((current) => ({ ...current, globalPackages: packages }))
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
    { id: 'node', name: 'Node 可执行文件', path: nodeExecutable || '未找到 Node 可执行文件' },
    { id: 'nvm-root', name: 'nvm 根目录', path: process.env.NVM_DIR || join(homedir(), '.nvm') },
    { id: 'versions', name: 'Node 版本目录', path: getNodeVersionsDirectory() },
    { id: 'npm-cache', name: 'npm 缓存', path: npmCache },
    { id: 'pnpm-store', name: 'pnpm Store', path: pnpmStore },
    { id: 'yarn-cache', name: 'Yarn 缓存', path: join(homedir(), 'Library', 'Caches', 'Yarn') },
    { id: 'bun-cache', name: 'Bun 缓存', path: join(homedir(), '.bun', 'install', 'cache') }
  ] satisfies Array<Omit<NodeEnvironmentPath, 'exists'>>
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
export async function openNodePath(targetInput: unknown): Promise<void> {
  if (!targetInput || typeof targetInput !== 'object') throw new Error('环境路径参数无效')
  const target = targetInput as Partial<NodeOpenPathTarget>
  if (target.type !== 'environment' && target.type !== 'cache') throw new Error('环境路径类型无效')
  if (typeof target.id !== 'string') throw new Error('环境路径标识无效')
  const candidates =
    target.type === 'environment' ? await getNodeEnvironmentPaths() : await resolveCachePaths()
  const candidate = candidates.find((item) => item.id === target.id)
  if (!candidate) throw new Error('环境路径不存在或已失效')
  const path = resolve(candidate.path)
  const exists = await access(path)
    .then(() => true)
    .catch(() => false)
  if (!exists) throw new Error('环境路径不存在或已失效')
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
  return getNodeState(true)
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
  return getNodeState(true)
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
  const caches: NodeCacheSnapshot[] = await Promise.all(
    (await resolveCachePaths()).map(async (item) => {
      const exists = await access(item.path)
        .then(() => true)
        .catch(() => false)
      return { ...item, exists, sizeBytes: exists ? await directorySize(item.path) : 0 }
    })
  )
  return updateNodeState((current) => ({ ...current, caches }))
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
