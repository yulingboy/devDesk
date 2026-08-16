import { app, BrowserWindow, dialog } from 'electron'
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
  listEnvironmentTools
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
  scanWorkspaceDetailed
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
  checkGlobalOutdated,
  getNodeEnvironmentPaths,
  listNodeTasks,
  openNodePath
} from '@main/services/node'
import type { NodeRegistryDraft } from '@shared/domain'
import { store } from '@main/infrastructure/store'

/** 集中注册应用信息、日志和窗口控制相关 IPC。 */
export function registerApplicationIpc(): void {
  registerIpcHandler<RuntimeInfo>(IPC_CHANNELS.app.getRuntimeInfo, () => ({
    appName: app.getName(),
    appVersion: app.getVersion(),
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
  registerIpcHandler(IPC_CHANNELS.hosts.save, (_, records) => saveHosts(records as HostRecord[]))
  registerIpcHandler(IPC_CHANNELS.hosts.restoreBackup, () => restoreHostsBackup())
  registerIpcHandler(IPC_CHANNELS.hosts.openFile, () => openHostsFile())
  registerIpcHandler(IPC_CHANNELS.hosts.flushDns, () => flushDns())
  registerIpcHandler(IPC_CHANNELS.hosts.openDomain, (_, domain) => openHostDomain(String(domain)))

  registerIpcHandler(IPC_CHANNELS.ssh.list, () => listSshKeys())
  registerIpcHandler(IPC_CHANNELS.ssh.save, (_, draft) => saveSshKey(draft as SSHKeyDraft))
  registerIpcHandler(IPC_CHANNELS.ssh.generate, (_, options) =>
    generateSshKey(options as SSHKeyGenerateOptions)
  )
  registerIpcHandler(IPC_CHANNELS.ssh.remove, (_, id) => removeSshKey(String(id)))
  registerIpcHandler(IPC_CHANNELS.ssh.deleteImpact, (_, id) => getSshDeleteImpact(String(id)))

  registerIpcHandler(IPC_CHANNELS.git.getState, () => getGitState())
  registerIpcHandler(IPC_CHANNELS.git.saveGlobal, (_, value) =>
    saveGlobalGit(value as { username: string; email: string })
  )
  registerIpcHandler(IPC_CHANNELS.git.saveIdentity, (_, identity) =>
    saveGitIdentity(identity as GitIdentity)
  )
  registerIpcHandler(IPC_CHANNELS.git.removeIdentity, (_, id) => removeGitIdentity(String(id)))
  registerIpcHandler(IPC_CHANNELS.git.files, () => getGitFiles())
  registerIpcHandler(IPC_CHANNELS.git.identityDetail, (_, id) => getGitIdentityDetail(String(id)))

  registerIpcHandler(IPC_CHANNELS.workspaces.list, () => listWorkspaces())
  registerIpcHandler(IPC_CHANNELS.workspaces.save, (_, workspace) =>
    saveWorkspace(workspace as Workspace)
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.remove, (_, id) => removeWorkspace(String(id)))
  registerIpcHandler(IPC_CHANNELS.workspaces.scan, (_, id) => scanWorkspace(String(id)))
  registerIpcHandler(IPC_CHANNELS.workspaces.scanDetailed, (_, id) =>
    scanWorkspaceDetailed(String(id))
  )
  registerIpcHandler(IPC_CHANNELS.workspaces.open, (_, id) => openWorkspace(String(id)))
  registerIpcHandler(IPC_CHANNELS.workspaces.openProject, (_, path) => openProject(String(path)))
  registerIpcHandler(IPC_CHANNELS.workspaces.openProjectEditor, (_, path) =>
    openProjectEditor(String(path))
  )

  registerIpcHandler(IPC_CHANNELS.templates.list, () => listTemplates())
  registerIpcHandler(IPC_CHANNELS.templates.save, (_, template) =>
    saveTemplate(template as ProjectTemplate)
  )
  registerIpcHandler(IPC_CHANNELS.templates.remove, (_, id) => removeTemplate(String(id)))
  registerIpcHandler(IPC_CHANNELS.templates.createProject, (_, options) =>
    createProject(options as ProjectCreateOptions)
  )

  registerIpcHandler(IPC_CHANNELS.node.getState, () => getNodeState())
  registerIpcHandler(IPC_CHANNELS.node.releases, (_, filter) =>
    listNodeReleases(
      filter as { keyword?: string; channel?: 'all' | 'lts' | 'current'; refresh?: boolean }
    )
  )
  registerIpcHandler(IPC_CHANNELS.node.install, (event, options) =>
    installNode(options as NodeInstallOptions, (state) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC_CHANNELS.node.taskUpdated, state)
    })
  )
  registerIpcHandler(IPC_CHANNELS.node.switch, (_, version, setDefault) =>
    switchNode(String(version), Boolean(setDefault))
  )
  registerIpcHandler(IPC_CHANNELS.node.remove, (_, version) => removeNode(String(version)))
  registerIpcHandler(IPC_CHANNELS.node.registries, () => listNodeRegistries())
  registerIpcHandler(IPC_CHANNELS.node.saveRegistry, (_, draft) =>
    saveNodeRegistry(draft as NodeRegistryDraft)
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
  registerIpcHandler(IPC_CHANNELS.node.checkOutdated, () => checkGlobalOutdated())
  registerIpcHandler(IPC_CHANNELS.node.environmentPaths, () => getNodeEnvironmentPaths())
  registerIpcHandler(IPC_CHANNELS.node.tasks, () => listNodeTasks())
  registerIpcHandler(IPC_CHANNELS.node.openPath, (_, path) => openNodePath(String(path)))

  registerIpcHandler(IPC_CHANNELS.settings.get, () => getSettings())
  registerIpcHandler(IPC_CHANNELS.settings.save, (_, settings) =>
    saveSettings(settings as AppSettings)
  )
  registerIpcHandler(IPC_CHANNELS.settings.reset, () => resetSettings())
  registerIpcHandler(IPC_CHANNELS.settings.export, () => exportSettings())
  registerIpcHandler(IPC_CHANNELS.settings.exportFile, () => exportSettingsFile())
  registerIpcHandler(IPC_CHANNELS.settings.import, (_, data) => importSettings(data as DataExport))
  registerIpcHandler(IPC_CHANNELS.settings.importFile, () => importSettingsFile())
  registerIpcHandler(IPC_CHANNELS.settings.openData, () => openDataDirectory())
  registerIpcHandler(IPC_CHANNELS.settings.changeDataDirectory, () => changeDataDirectory())
  registerIpcHandler(IPC_CHANNELS.settings.clearBusinessData, () => clearBusinessData())
  const stoppedEnvironmentChecks = new Set<number>()
  registerIpcHandler(IPC_CHANNELS.settings.environmentCheck, (event) => {
    stoppedEnvironmentChecks.delete(event.sender.id)
    return runEnvironmentCheck(
      () => stoppedEnvironmentChecks.has(event.sender.id) || event.sender.isDestroyed(),
      (checks) => {
        if (!event.sender.isDestroyed())
          event.sender.send(IPC_CHANNELS.settings.environmentCheckUpdated, checks)
      }
    ).finally(() => stoppedEnvironmentChecks.delete(event.sender.id))
  })
  registerIpcHandler<void>(IPC_CHANNELS.settings.stopEnvironmentCheck, (event) => {
    stoppedEnvironmentChecks.add(event.sender.id)
  })
  registerIpcHandler(IPC_CHANNELS.settings.openEnvironmentGuide, (_, id) =>
    openEnvironmentGuide(String(id))
  )
  registerIpcHandler(IPC_CHANNELS.settings.environmentTools, () => listEnvironmentTools())
  registerIpcHandler(IPC_CHANNELS.settings.installEnvironmentTool, (_, id) =>
    installEnvironmentTool(String(id))
  )
  registerIpcHandler(IPC_CHANNELS.settings.dataStats, () => getDataStats())
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
