import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type {
  AppApi,
  AppUpdateState,
  IpcResult,
  RendererErrorReport,
  RendererLogEntry,
  RuntimeInfo,
  WindowState
} from '@shared/types'

/** 调用主进程并将统一 IPC 结果转换为普通 Promise 返回值。 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  // 预加载层统一拆开共享结果结构，渲染层无需依赖 Electron IPC 序列化细节。
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>

  if (!result.ok) {
    throw Object.assign(new Error(result.error.message), { code: result.error.code })
  }

  return result.data
}

// 仅暴露业务所需的最小 API，渲染层无法直接访问 ipcRenderer。
const api: AppApi = {
  app: {
    platform: process.platform,
    getRuntimeInfo: () => invoke<RuntimeInfo>(IPC_CHANNELS.app.getRuntimeInfo),
    writeLog: (entry: RendererLogEntry) => invoke<void>(IPC_CHANNELS.app.writeLog, entry),
    reportError: (report: RendererErrorReport) => invoke<void>(IPC_CHANNELS.app.reportError, report)
  },
  update: {
    getState: () => invoke<AppUpdateState>(IPC_CHANNELS.update.getState),
    check: () => invoke<AppUpdateState>(IPC_CHANNELS.update.check),
    download: () => invoke<AppUpdateState>(IPC_CHANNELS.update.download),
    install: () => invoke<void>(IPC_CHANNELS.update.install),
    onStateChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: AppUpdateState): void =>
        listener(state)
      ipcRenderer.on(IPC_CHANNELS.update.stateChanged, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.update.stateChanged, handler)
    }
  },
  dialog: {
    selectDirectory: (defaultPath) => invoke(IPC_CHANNELS.dialog.selectDirectory, defaultPath)
  },
  window: {
    getState: () => invoke<WindowState>(IPC_CHANNELS.window.getState),
    minimize: () => invoke<void>(IPC_CHANNELS.window.minimize),
    toggleMaximize: () => invoke<WindowState>(IPC_CHANNELS.window.toggleMaximize),
    close: () => invoke<void>(IPC_CHANNELS.window.close),
    onStateChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: WindowState): void =>
        listener(state)
      ipcRenderer.on(IPC_CHANNELS.window.stateChanged, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.window.stateChanged, handler)
    }
  },
  overview: {
    getSnapshot: () => invoke(IPC_CHANNELS.overview.getSnapshot),
    getHistory: () => invoke(IPC_CHANNELS.overview.getHistory),
    onUpdated: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        snapshot: Parameters<typeof listener>[0]
      ): void => listener(snapshot)
      ipcRenderer.on(IPC_CHANNELS.overview.updated, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.overview.updated, handler)
    }
  },
  hosts: {
    list: () => invoke(IPC_CHANNELS.hosts.list),
    listSystem: () => invoke(IPC_CHANNELS.hosts.listSystem),
    save: (records) => invoke(IPC_CHANNELS.hosts.save, records),
    restoreBackup: () => invoke(IPC_CHANNELS.hosts.restoreBackup),
    openFile: () => invoke(IPC_CHANNELS.hosts.openFile),
    flushDns: () => invoke(IPC_CHANNELS.hosts.flushDns),
    openDomain: (domain) => invoke(IPC_CHANNELS.hosts.openDomain, domain)
  },
  ssh: {
    list: () => invoke(IPC_CHANNELS.ssh.list),
    save: (draft) => invoke(IPC_CHANNELS.ssh.save, draft),
    generate: (options) => invoke(IPC_CHANNELS.ssh.generate, options),
    remove: (id) => invoke(IPC_CHANNELS.ssh.remove, id),
    getDeleteImpact: (id) => invoke(IPC_CHANNELS.ssh.deleteImpact, id)
  },
  git: {
    getState: () => invoke(IPC_CHANNELS.git.getState),
    saveGlobal: (value) => invoke(IPC_CHANNELS.git.saveGlobal, value),
    saveIdentity: (identity) => invoke(IPC_CHANNELS.git.saveIdentity, identity),
    removeIdentity: (id) => invoke(IPC_CHANNELS.git.removeIdentity, id),
    files: () => invoke(IPC_CHANNELS.git.files),
    getIdentityDetail: (id) => invoke(IPC_CHANNELS.git.identityDetail, id),
    verifyWorkspace: (workspaceId) => invoke(IPC_CHANNELS.git.verifyWorkspace, workspaceId)
  },
  workspaces: {
    list: () => invoke(IPC_CHANNELS.workspaces.list),
    save: (workspace) => invoke(IPC_CHANNELS.workspaces.save, workspace),
    remove: (id) => invoke(IPC_CHANNELS.workspaces.remove, id),
    scan: (id) => invoke(IPC_CHANNELS.workspaces.scan, id),
    open: (id) => invoke(IPC_CHANNELS.workspaces.open, id),
    openProject: (workspaceId, projectId) =>
      invoke(IPC_CHANNELS.workspaces.openProject, workspaceId, projectId),
    openProjectEditor: (workspaceId, projectId, editor) =>
      invoke(IPC_CHANNELS.workspaces.openProjectEditor, workspaceId, projectId, editor),
    scanDetailed: (id) => invoke(IPC_CHANNELS.workspaces.scanDetailed, id),
    cancelScan: (id) => invoke(IPC_CHANNELS.workspaces.cancelScan, id),
    saveProjectRemark: (workspaceId, projectId, remark) =>
      invoke(IPC_CHANNELS.workspaces.saveProjectRemark, workspaceId, projectId, remark),
    addProject: (workspaceId, path) =>
      invoke(IPC_CHANNELS.workspaces.addProject, workspaceId, path),
    removeProject: (workspaceId, projectId) =>
      invoke(IPC_CHANNELS.workspaces.removeProject, workspaceId, projectId)
  },
  templates: {
    list: () => invoke(IPC_CHANNELS.templates.list),
    save: (template) => invoke(IPC_CHANNELS.templates.save, template),
    remove: (id) => invoke(IPC_CHANNELS.templates.remove, id),
    createProject: (options) => invoke(IPC_CHANNELS.templates.createProject, options)
  },
  node: {
    getState: (refresh) => invoke(IPC_CHANNELS.node.getState, refresh),
    releases: (filter) => invoke(IPC_CHANNELS.node.releases, filter),
    install: (options) => invoke(IPC_CHANNELS.node.install, options),
    switch: (version, setDefault) => invoke(IPC_CHANNELS.node.switch, version, setDefault),
    useInTerminal: (version) => invoke(IPC_CHANNELS.node.useInTerminal, version),
    remove: (version) => invoke(IPC_CHANNELS.node.remove, version),
    registries: () => invoke(IPC_CHANNELS.node.registries),
    saveRegistry: (draft) => invoke(IPC_CHANNELS.node.saveRegistry, draft),
    removeRegistry: (id) => invoke(IPC_CHANNELS.node.removeRegistry, id),
    useRegistry: (id) => invoke(IPC_CHANNELS.node.useRegistry, id),
    testRegistry: (id) => invoke(IPC_CHANNELS.node.testRegistry, id),
    installNrm: () => invoke(IPC_CHANNELS.node.installNrm),
    packages: (keyword) => invoke(IPC_CHANNELS.node.packages, keyword),
    syncGlobalPackages: (sourceVersion) =>
      invoke(IPC_CHANNELS.node.syncGlobalPackages, sourceVersion),
    setPackageManager: (manager) => invoke(IPC_CHANNELS.node.setPackageManager, manager),
    setPackageRegistry: (manager, registry) =>
      invoke(IPC_CHANNELS.node.setPackageRegistry, manager, registry),
    installPackage: (name) => invoke(IPC_CHANNELS.node.installPackage, name),
    removePackage: (name) => invoke(IPC_CHANNELS.node.removePackage, name),
    updatePackage: (name) => invoke(IPC_CHANNELS.node.updatePackage, name),
    scanCaches: () => invoke(IPC_CHANNELS.node.scanCaches),
    clearCaches: () => invoke(IPC_CHANNELS.node.clearCaches),
    clearCache: (id) => invoke(IPC_CHANNELS.node.clearCache, id),
    checkOutdated: () => invoke(IPC_CHANNELS.node.checkOutdated),
    environmentPaths: () => invoke(IPC_CHANNELS.node.environmentPaths),
    tasks: () => invoke(IPC_CHANNELS.node.tasks),
    cancelTask: (id) => invoke(IPC_CHANNELS.node.cancelTask, id),
    retryTask: (id) => invoke(IPC_CHANNELS.node.retryTask, id),
    clearTasks: () => invoke(IPC_CHANNELS.node.clearTasks),
    openPath: (target) => invoke(IPC_CHANNELS.node.openPath, target),
    onTaskUpdated: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        state: Parameters<typeof listener>[0]
      ): void => listener(state)
      ipcRenderer.on(IPC_CHANNELS.node.taskUpdated, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.node.taskUpdated, handler)
    }
  },
  settings: {
    get: () => invoke(IPC_CHANNELS.settings.get),
    save: (settings) => invoke(IPC_CHANNELS.settings.save, settings),
    reset: () => invoke(IPC_CHANNELS.settings.reset),
    testNodeDownloadSource: (settings) =>
      invoke(IPC_CHANNELS.settings.testNodeDownloadSource, settings),
    export: () => invoke(IPC_CHANNELS.settings.export),
    exportFile: () => invoke(IPC_CHANNELS.settings.exportFile),
    import: (data) => invoke(IPC_CHANNELS.settings.import, data),
    importFile: () => invoke(IPC_CHANNELS.settings.importFile),
    openData: () => invoke(IPC_CHANNELS.settings.openData),
    changeDataDirectory: () => invoke(IPC_CHANNELS.settings.changeDataDirectory),
    clearBusinessData: () => invoke(IPC_CHANNELS.settings.clearBusinessData),
    dataStats: () => invoke(IPC_CHANNELS.settings.dataStats),
    logStats: () => invoke(IPC_CHANNELS.settings.logStats),
    openLogs: () => invoke(IPC_CHANNELS.settings.openLogs),
    clearLogArchives: () => invoke(IPC_CHANNELS.settings.clearLogArchives),
    onDataChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(IPC_CHANNELS.settings.dataChanged, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.settings.dataChanged, handler)
    },
    openDeveloperTools: () => invoke(IPC_CHANNELS.settings.openDeveloperTools)
  }
}

contextBridge.exposeInMainWorld('api', api)
