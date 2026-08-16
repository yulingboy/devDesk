import { app, BrowserWindow, dialog } from 'electron'
import type { ChildProcess } from 'node:child_process'
import { IPC_CHANNELS } from '@shared/ipc'
import type { RendererErrorReport, RendererLogEntry, RuntimeInfo, WindowState } from '@shared/types'
import type {
  AppSettings,
  DataExport,
  GitIdentity,
  HostRecord,
  NodeInstallOptions,
  ProjectCreateOptions,
  ProjectTemplate,
  SSHKeyDraft,
  SSHKeyGenerateOptions,
  Workspace
} from '@shared/domain'
import { registerIpcHandler } from '@main/infrastructure/ipc'
import { getAppPaths } from '@main/infrastructure/paths'
import { writeRendererError, writeRendererLog } from '@main/infrastructure/logger'
import { getWindowState } from '@main/window'
import {
  getSettings,
  saveSettings,
  resetSettings,
  exportSettings,
  exportSettingsFile,
  importSettings,
  importSettingsFile,
  openDataDirectory,
  changeDataDirectory,
  clearBusinessData,
  getDataStats,
  runEnvironmentCheck,
  openEnvironmentGuide,
  installEnvironmentTool,
  listEnvironmentTools,
  getEnvironmentCheckSnapshot,
  checkEnvironmentTool,
  getLogStats,
  openLogDirectory,
  clearLogArchives
} from '@main/services/settings'
import {
  listHosts,
  saveHosts,
  restoreHostsBackup,
  openHostsFile,
  flushDns,
  openHostDomain
} from '@main/services/hosts'
import {
  getSshDeleteImpact,
  listSshKeys,
  saveSshKey,
  generateSshKey,
  removeSshKey
} from '@main/services/ssh'
import {
  getGitState,
  saveGlobalGit,
  saveGitIdentity,
  removeGitIdentity,
  getGitFiles,
  getGitIdentityDetail
} from '@main/services/git'
import {
  listWorkspaces,
  saveWorkspace,
  removeWorkspace,
  scanWorkspace,
  openWorkspace,
  openProject,
  openProjectEditor,
  saveProjectRemark,
  scanWorkspaceDetailed,
  getProjectDetail,
  refreshProject,
  addProjectToWorkspace,
  removeProjectFromWorkspace,
  installProjectDependencies,
  runProjectScript,
  listProjectTasks,
  stopProjectTask
} from '@main/services/workspaces'
import {
  listTemplates,
  saveTemplate,
  removeTemplate,
  createProject
} from '@main/services/templates'
import {
  getNodeState,
  listNodeReleases,
  installNode,
  switchNode,
  useNodeInTerminal,
  removeNode,
  listNodeRegistries,
  saveNodeRegistry,
  removeNodeRegistry,
  useNodeRegistry,
  testNodeRegistry,
  listGlobalPackages,
  installGlobalPackage,
  removeGlobalPackage,
  updateGlobalPackage,
  setPackageManager,
  setPackageManagerRegistry,
  scanNodeCaches,
  clearNodeCaches,
  clearNodeCache,
  checkGlobalOutdated,
  getNodeEnvironmentPaths,
  listNodeTasks,
  cancelNodeTask,
  retryNodeTask,
  clearNodeTasks,
  openNodePath
} from '@main/services/node'
import type { NodeRegistryDraft } from '@shared/domain'
import { store } from '@main/infrastructure/store'

/** 集中注册应用信息、日志和窗口控制相关 IPC。 */
export function registerApplicationIpc(): void {
  const broadcastDataChanged = (): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.settings.dataChanged)
    }
  }
  registerIpcHandler<RuntimeInfo>(IPC_CHANNELS.app.getRuntimeInfo, () => ({
    appName: app.getName(),
    appVersion: app.getVersion(),
    buildDate: __BUILD_DATE__,
    platform: process.platform,
    arch: process.arch,
    paths: getAppPaths(),
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }
  }))

  registerIpcHandler<void>(IPC_CHANNELS.app.writeLog, (_, entry) => {
    writeRendererLog(parseRendererLogEntry(entry))
  })

  registerIpcHandler<void>(IPC_CHANNELS.app.reportError, (_, report) => {
    writeRendererError(parseRendererErrorReport(report))
  })

  registerIpcHandler<string | null>(
    IPC_CHANNELS.dialog.selectDirectory,
    async (event, defaultPath) => {
      const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const options = {
        title: '选择目录',
        defaultPath: typeof defaultPath === 'string' ? defaultPath : undefined,
        properties: ['openDirectory', 'createDirectory'] as Array<
          'openDirectory' | 'createDirectory'
        >
      }
      const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? null : (result.filePaths[0] ?? null)
    }
  )

  registerIpcHandler<WindowState>(IPC_CHANNELS.window.getState, (event) =>
    getWindowState(BrowserWindow.fromWebContents(event.sender))
  )

  registerIpcHandler<void>(IPC_CHANNELS.window.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  registerIpcHandler<WindowState>(IPC_CHANNELS.window.toggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('窗口不可用')

    if (window.isMaximized()) window.unmaximize()
    else window.maximize()

    return getWindowState(window)
  })

  registerIpcHandler<void>(IPC_CHANNELS.window.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  registerIpcHandler(IPC_CHANNELS.overview.getSnapshot, () => store.overview.read())
  registerIpcHandler(IPC_CHANNELS.hosts.list, () => listHosts())
  registerIpcHandler(IPC_CHANNELS.hosts.save, (_, records) => saveHosts(parseHostRecords(records)))
  registerIpcHandler(IPC_CHANNELS.hosts.restoreBackup, () => restoreHostsBackup())
  registerIpcHandler(IPC_CHANNELS.hosts.openFile, () => openHostsFile())
  registerIpcHandler(IPC_CHANNELS.hosts.flushDns, () => flushDns())
  registerIpcHandler(IPC_CHANNELS.hosts.openDomain, (_, domain) => openHostDomain(String(domain)))

  registerIpcHandler(IPC_CHANNELS.ssh.list, () => listSshKeys())
  registerIpcHandler(IPC_CHANNELS.ssh.save, (_, draft) => saveSshKey(parseSshDraft(draft)))
  registerIpcHandler(IPC_CHANNELS.ssh.generate, (_, options) =>
    generateSshKey(parseSshGenerateOptions(options))
  )
  registerIpcHandler(IPC_CHANNELS.ssh.remove, (_, id) => removeSshKey(String(id)))
  registerIpcHandler(IPC_CHANNELS.ssh.deleteImpact, (_, id) => getSshDeleteImpact(String(id)))

  registerIpcHandler(IPC_CHANNELS.git.getState, () => getGitState())
  registerIpcHandler(IPC_CHANNELS.git.saveGlobal, (_, value) =>
    saveGlobalGit(parseGitGlobal(value))
  )
  registerIpcHandler(IPC_CHANNELS.git.saveIdentity, (_, identity) =>
    saveGitIdentity(parseGitIdentity(identity))
  )
  registerIpcHandler(IPC_CHANNELS.git.removeIdentity, (_, id) => removeGitIdentity(String(id)))
  registerIpcHandler(IPC_CHANNELS.git.files, () => getGitFiles())
  registerIpcHandler(IPC_CHANNELS.git.identityDetail, (_, id) => getGitIdentityDetail(String(id)))

  registerIpcHandler(IPC_CHANNELS.workspaces.list, () => listWorkspaces())
  registerIpcHandler(IPC_CHANNELS.workspaces.save, (_, workspace) =>
    saveWorkspace(parseWorkspace(workspace))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.remove, (_, id) => removeWorkspace(String(id)))
  registerIpcHandler(IPC_CHANNELS.workspaces.scan, (_, id) => scanWorkspace(String(id)))
  registerIpcHandler(IPC_CHANNELS.workspaces.scanDetailed, (_, id) =>
    scanWorkspaceDetailed(String(id))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.open, (_, id) => openWorkspace(String(id)))
  registerIpcHandler(IPC_CHANNELS.workspaces.openProject, (_, path) => openProject(String(path)))
  registerIpcHandler(IPC_CHANNELS.workspaces.openProjectEditor, (_, path, editor) =>
    openProjectEditor(String(path), editor === undefined ? undefined : String(editor))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.getProjectDetail, (_, workspaceId, projectId) =>
    getProjectDetail(String(workspaceId), String(projectId))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.refreshProject, (_, workspaceId, projectId) =>
    refreshProject(String(workspaceId), String(projectId))
  )
  registerIpcHandler(
    IPC_CHANNELS.workspaces.saveProjectRemark,
    (_, workspaceId, projectId, remark) =>
      saveProjectRemark(String(workspaceId), String(projectId), String(remark ?? ''))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.addProject, (_, workspaceId, path) =>
    addProjectToWorkspace(String(workspaceId), String(path))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.removeProject, (_, workspaceId, projectId) =>
    removeProjectFromWorkspace(String(workspaceId), String(projectId))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.installDependencies, (_, workspaceId, projectId) =>
    installProjectDependencies(String(workspaceId), String(projectId))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.runScript, (_, workspaceId, projectId, script) =>
    runProjectScript(String(workspaceId), String(projectId), String(script))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.tasks, (_, projectId) =>
    listProjectTasks(projectId ? String(projectId) : undefined)
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.stopTask, (_, taskId) =>
    stopProjectTask(String(taskId))
  )

  registerIpcHandler(IPC_CHANNELS.templates.list, () => listTemplates())
  registerIpcHandler(IPC_CHANNELS.templates.save, (_, template) =>
    saveTemplate(parseTemplate(template))
  )
  registerIpcHandler(IPC_CHANNELS.templates.remove, (_, id) => removeTemplate(String(id)))
  registerIpcHandler(IPC_CHANNELS.templates.createProject, (_, options) =>
    createProject(parseProjectCreateOptions(options))
  )

  registerIpcHandler(IPC_CHANNELS.node.getState, () => getNodeState())
  registerIpcHandler(IPC_CHANNELS.node.releases, (_, filter) =>
    listNodeReleases(
      filter as { keyword?: string; channel?: 'all' | 'lts' | 'current'; refresh?: boolean }
    )
  )
  registerIpcHandler(IPC_CHANNELS.node.install, (event, options) =>
    installNode(parseNodeInstallOptions(options), (state) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC_CHANNELS.node.taskUpdated, state)
    })
  )
  registerIpcHandler(IPC_CHANNELS.node.switch, (_, version, setDefault) =>
    switchNode(String(version), Boolean(setDefault))
  )
  registerIpcHandler(IPC_CHANNELS.node.useInTerminal, (_, version) =>
    useNodeInTerminal(String(version))
  )
  registerIpcHandler(IPC_CHANNELS.node.remove, (_, version) => removeNode(String(version)))
  registerIpcHandler(IPC_CHANNELS.node.registries, () => listNodeRegistries())
  registerIpcHandler(IPC_CHANNELS.node.saveRegistry, (_, draft) =>
    saveNodeRegistry(parseNodeRegistryDraft(draft))
  )
  registerIpcHandler(IPC_CHANNELS.node.removeRegistry, (_, id) => removeNodeRegistry(String(id)))
  registerIpcHandler(IPC_CHANNELS.node.useRegistry, (_, id) => useNodeRegistry(String(id)))
  registerIpcHandler(IPC_CHANNELS.node.testRegistry, (_, id) => testNodeRegistry(String(id)))
  registerIpcHandler(IPC_CHANNELS.node.packages, (_, keyword) =>
    listGlobalPackages(String(keyword ?? ''))
  )
  registerIpcHandler(IPC_CHANNELS.node.setPackageManager, (_, manager) =>
    setPackageManager(String(manager))
  )
  registerIpcHandler(IPC_CHANNELS.node.setPackageRegistry, (_, manager, registry) =>
    setPackageManagerRegistry(String(manager), String(registry))
  )
  registerIpcHandler(IPC_CHANNELS.node.installPackage, (_, name) =>
    installGlobalPackage(String(name))
  )
  registerIpcHandler(IPC_CHANNELS.node.removePackage, (_, name) =>
    removeGlobalPackage(String(name))
  )
  registerIpcHandler(IPC_CHANNELS.node.updatePackage, (_, name) =>
    updateGlobalPackage(String(name))
  )
  registerIpcHandler(IPC_CHANNELS.node.scanCaches, () => scanNodeCaches())
  registerIpcHandler(IPC_CHANNELS.node.clearCaches, () => clearNodeCaches())
  registerIpcHandler(IPC_CHANNELS.node.clearCache, (_, id) => {
    const cacheId = String(id)
    if (!['npm', 'pnpm', 'yarn', 'bun'].includes(cacheId)) throw new Error('缓存类型无效')
    return clearNodeCache(cacheId as 'npm' | 'pnpm' | 'yarn' | 'bun')
  })
  registerIpcHandler(IPC_CHANNELS.node.checkOutdated, () => checkGlobalOutdated())
  registerIpcHandler(IPC_CHANNELS.node.environmentPaths, () => getNodeEnvironmentPaths())
  registerIpcHandler(IPC_CHANNELS.node.tasks, () => listNodeTasks())
  registerIpcHandler(IPC_CHANNELS.node.cancelTask, (_, id) => cancelNodeTask(String(id)))
  registerIpcHandler(IPC_CHANNELS.node.retryTask, (_, id) => retryNodeTask(String(id)))
  registerIpcHandler(IPC_CHANNELS.node.clearTasks, () => clearNodeTasks())
  registerIpcHandler(IPC_CHANNELS.node.openPath, (_, path) => openNodePath(String(path)))

  registerIpcHandler(IPC_CHANNELS.settings.get, () => getSettings())
  registerIpcHandler(IPC_CHANNELS.settings.save, (_, settings) =>
    saveSettings(parseAppSettings(settings))
  )
  registerIpcHandler(IPC_CHANNELS.settings.reset, () => resetSettings())
  registerIpcHandler(IPC_CHANNELS.settings.export, () => exportSettings())
  registerIpcHandler(IPC_CHANNELS.settings.exportFile, () => exportSettingsFile())
  registerIpcHandler(IPC_CHANNELS.settings.import, async (_, data) => {
    const result = await importSettings(parseDataExport(data))
    broadcastDataChanged()
    return result
  })
  registerIpcHandler(IPC_CHANNELS.settings.importFile, async () => {
    const result = await importSettingsFile()
    if (!result.cancelled) broadcastDataChanged()
    return result
  })
  registerIpcHandler(IPC_CHANNELS.settings.openData, () => openDataDirectory())
  registerIpcHandler(IPC_CHANNELS.settings.changeDataDirectory, async () => {
    const result = await changeDataDirectory()
    if (!result.cancelled) broadcastDataChanged()
    return result
  })
  registerIpcHandler(IPC_CHANNELS.settings.clearBusinessData, async () => {
    const result = await clearBusinessData()
    broadcastDataChanged()
    return result
  })
  const stoppedEnvironmentChecks = new Set<number>()
  const activeEnvironmentChecks = new Map<number, ChildProcess>()
  const runningEnvironmentChecks = new Set<number>()
  registerIpcHandler(IPC_CHANNELS.settings.environmentCheck, (event) => {
    if (runningEnvironmentChecks.has(event.sender.id)) {
      throw new Error('环境检测正在运行，请等待完成或先停止当前检测')
    }
    runningEnvironmentChecks.add(event.sender.id)
    stoppedEnvironmentChecks.delete(event.sender.id)
    return runEnvironmentCheck(
      () => stoppedEnvironmentChecks.has(event.sender.id) || event.sender.isDestroyed(),
      (checks) => {
        if (!event.sender.isDestroyed())
          event.sender.send(IPC_CHANNELS.settings.environmentCheckUpdated, checks)
      },
      (child) => {
        if (child) activeEnvironmentChecks.set(event.sender.id, child)
        else activeEnvironmentChecks.delete(event.sender.id)
      }
    ).finally(() => {
      stoppedEnvironmentChecks.delete(event.sender.id)
      activeEnvironmentChecks.delete(event.sender.id)
      runningEnvironmentChecks.delete(event.sender.id)
    })
  })
  registerIpcHandler<void>(IPC_CHANNELS.settings.stopEnvironmentCheck, (event) => {
    stoppedEnvironmentChecks.add(event.sender.id)
    activeEnvironmentChecks.get(event.sender.id)?.kill()
  })
  registerIpcHandler(IPC_CHANNELS.settings.openEnvironmentGuide, (_, id) =>
    openEnvironmentGuide(String(id))
  )
  registerIpcHandler(IPC_CHANNELS.settings.environmentTools, () => listEnvironmentTools())
  registerIpcHandler(IPC_CHANNELS.settings.environmentCheckSnapshot, () =>
    getEnvironmentCheckSnapshot()
  )
  registerIpcHandler(IPC_CHANNELS.settings.environmentCheckTool, (event, id) => {
    if (runningEnvironmentChecks.has(event.sender.id)) throw new Error('环境检测正在运行')
    return checkEnvironmentTool(String(id))
  })
  registerIpcHandler(IPC_CHANNELS.settings.installEnvironmentTool, async (event, id) => {
    if (runningEnvironmentChecks.has(event.sender.id)) throw new Error('环境操作正在运行')
    runningEnvironmentChecks.add(event.sender.id)
    try {
      return await installEnvironmentTool(String(id))
    } finally {
      runningEnvironmentChecks.delete(event.sender.id)
    }
  })
  registerIpcHandler(IPC_CHANNELS.settings.dataStats, () => getDataStats())
  registerIpcHandler(IPC_CHANNELS.settings.logStats, () => getLogStats())
  registerIpcHandler(IPC_CHANNELS.settings.openLogs, () => openLogDirectory())
  registerIpcHandler(IPC_CHANNELS.settings.clearLogArchives, () => clearLogArchives())
  registerIpcHandler<void>(IPC_CHANNELS.settings.openDeveloperTools, async (event) => {
    const settings = await getSettings()
    if (!settings.advanced.developerTools) throw new Error('请先在高级设置中启用开发者工具')
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('窗口不可用')
    window.webContents.openDevTools({ mode: 'detach' })
  })
}

function parseRendererLogEntry(value: unknown): RendererLogEntry {
  // 渲染层数据属于不可信输入，先限制结构和长度再写入本地日志。
  if (!isRecord(value)) throw new Error('渲染层日志参数无效')

  const level = value.level
  const message = value.message
  if (!['debug', 'info', 'warn', 'error'].includes(String(level)) || typeof message !== 'string') {
    throw new Error('渲染层日志参数无效')
  }

  return {
    level: level as RendererLogEntry['level'],
    message: message.slice(0, 2_000),
    context: isRecord(value.context) ? value.context : undefined
  }
}

function parseRendererErrorReport(value: unknown): RendererErrorReport {
  // 限制错误来源和文本长度，避免任意对象穿过 IPC 边界。
  if (!isRecord(value) || typeof value.message !== 'string') {
    throw new Error('渲染层错误报告无效')
  }

  const source = value.source
  if (!['error-boundary', 'window-error', 'unhandled-rejection'].includes(String(source))) {
    throw new Error('渲染层错误来源无效')
  }

  return {
    source: source as RendererErrorReport['source'],
    message: value.message.slice(0, 2_000),
    stack: typeof value.stack === 'string' ? value.stack.slice(0, 20_000) : undefined,
    componentStack:
      typeof value.componentStack === 'string' ? value.componentStack.slice(0, 20_000) : undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, label: string, optional = false): string | undefined {
  if (value === undefined && optional) return undefined
  if (typeof value !== 'string') throw new Error(`${label}参数无效`)
  return value
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label}参数无效`)
  return value
}

function parseHostRecords(value: unknown): HostRecord[] {
  if (!Array.isArray(value) || value.length > 10_000) throw new Error('Hosts 记录参数无效')
  return value.map((item) => {
    const record = requiredRecord(item, 'Hosts 记录')
    if (typeof record.enabled !== 'boolean') throw new Error('Hosts 启用状态参数无效')
    return {
      id: text(record.id, 'Hosts ID', true) ?? '',
      ip: text(record.ip, 'Hosts IP')!,
      domain: text(record.domain, 'Hosts 域名')!,
      enabled: record.enabled,
      remark: text(record.remark, 'Hosts 备注', true) ?? ''
    }
  })
}

function parseSshDraft(value: unknown): SSHKeyDraft {
  const draft = requiredRecord(value, 'SSH 密钥')
  const source = text(draft.source, 'SSH 密钥来源', true)
  if (source && !['discovered', 'manual', 'generated'].includes(source))
    throw new Error('SSH 密钥来源参数无效')
  return {
    id: text(draft.id, 'SSH 密钥 ID', true),
    name: text(draft.name, 'SSH 密钥名称')!,
    publicKey: text(draft.publicKey, 'SSH 公钥')!,
    privateKeyPath: text(draft.privateKeyPath, 'SSH 私钥路径', true),
    algorithm: text(draft.algorithm, 'SSH 算法', true),
    source: source as SSHKeyDraft['source']
  }
}

function parseSshGenerateOptions(value: unknown): SSHKeyGenerateOptions {
  const options = requiredRecord(value, 'SSH 生成选项')
  const algorithm = text(options.algorithm, 'SSH 算法')
  if (algorithm !== 'ed25519' && algorithm !== 'rsa') throw new Error('SSH 算法参数无效')
  return {
    name: text(options.name, 'SSH 密钥名称')!,
    algorithm,
    comment: text(options.comment, 'SSH 注释', true),
    passphrase: text(options.passphrase, 'SSH 口令', true)
  }
}

function parseGitGlobal(value: unknown): { username: string; email: string } {
  const input = requiredRecord(value, 'Git 全局配置')
  return { username: text(input.username, 'Git 用户名')!, email: text(input.email, 'Git 邮箱')! }
}

function parseGitIdentity(value: unknown): GitIdentity {
  const input = requiredRecord(value, 'Git 身份')
  return {
    id: text(input.id, 'Git 身份 ID', true) ?? '',
    name: text(input.name, 'Git 身份名称')!,
    username: text(input.username, 'Git 用户名')!,
    email: text(input.email, 'Git 邮箱')!,
    sshKeyId: text(input.sshKeyId, 'SSH 密钥 ID', true)
  }
}

function parseWorkspace(value: unknown): Workspace {
  const input = requiredRecord(value, '工作区')
  if (input.projects !== undefined && !Array.isArray(input.projects))
    throw new Error('工作区项目参数无效')
  return {
    id: text(input.id, '工作区 ID', true) ?? '',
    name: text(input.name, '工作区名称')!,
    rootPath: text(input.rootPath, '工作区目录')!,
    description: text(input.description, '工作区描述', true) ?? '',
    gitIdentityId: text(input.gitIdentityId, 'Git 身份 ID', true),
    // 项目记录仅由扫描服务产生，禁止 IPC 调用写入任意项目路径。
    projects: []
  }
}

function parseTemplate(value: unknown): ProjectTemplate {
  const input = requiredRecord(value, '项目模板')
  const type = text(input.type, '模板类型')
  if (type !== 'git' && type !== 'local') throw new Error('模板类型参数无效')
  return {
    id: text(input.id, '模板 ID', true) ?? '',
    name: text(input.name, '模板名称')!,
    description: text(input.description, '模板描述', true) ?? '',
    type,
    source: text(input.source, '模板来源')!
  }
}

function parseProjectCreateOptions(value: unknown): ProjectCreateOptions {
  const input = requiredRecord(value, '创建项目')
  return {
    templateId: text(input.templateId, '模板 ID')!,
    workspaceId: text(input.workspaceId, '工作区 ID')!,
    projectName: text(input.projectName, '项目名称')!
  }
}

function parseNodeInstallOptions(value: unknown): NodeInstallOptions {
  const input = requiredRecord(value, 'Node 安装选项')
  return { version: text(input.version, 'Node 版本')! }
}

function parseNodeRegistryDraft(value: unknown): NodeRegistryDraft {
  const input = requiredRecord(value, 'Registry 镜像')
  return {
    id: text(input.id, 'Registry ID', true),
    name: text(input.name, 'Registry 名称')!,
    url: text(input.url, 'Registry 地址')!
  }
}

function parseAppSettings(value: unknown): AppSettings {
  const input = requiredRecord(value, '设置')
  const general = requiredRecord(input.general, '通用设置')
  const advanced = requiredRecord(input.advanced, '高级设置')
  const node = requiredRecord(input.node, 'Node 设置')
  if (
    !isRecord(input.data) ||
    typeof general.launchAtLogin !== 'boolean' ||
    typeof general.minimizeToTray !== 'boolean' ||
    typeof advanced.developerTools !== 'boolean'
  ) {
    throw new Error('设置参数无效')
  }
  const logLevel = text(advanced.logLevel, '日志级别')
  const packageManager = text(node.packageManager, '默认包管理器')
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel ?? '')) {
    throw new Error('日志级别无效')
  }
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(packageManager ?? '')) {
    throw new Error('默认包管理器无效')
  }
  return {
    schemaVersion: 1,
    general: {
      theme: text(general.theme, '主题') as AppSettings['general']['theme'],
      launchAtLogin: general.launchAtLogin,
      minimizeToTray: general.minimizeToTray
    },
    data: { directory: text(input.data.directory, '数据目录')! },
    advanced: {
      logLevel: logLevel as AppSettings['advanced']['logLevel'],
      developerTools: advanced.developerTools
    },
    node: {
      indexUrl: text(node.indexUrl, '版本索引')!,
      downloadSource: text(node.downloadSource, '下载源')!,
      packageManager: packageManager!,
      registry: text(node.registry, '默认 Registry')!
    }
  }
}

function parseDataExport(value: unknown): DataExport {
  const input = requiredRecord(value, '备份文件')
  if (input.schemaVersion !== 1 || !isRecord(input.settings)) throw new Error('备份文件参数无效')
  for (const field of ['hosts', 'sshKeys', 'gitIdentities', 'workspaces', 'templates']) {
    if (!Array.isArray(input[field])) throw new Error('备份文件参数无效')
  }
  return input as unknown as DataExport
}
