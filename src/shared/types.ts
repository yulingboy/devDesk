export interface RuntimeInfo {
  appName: string
  appVersion: string
  buildDate: string
  platform: NodeJS.Platform
  arch: string
  paths: AppPaths
  versions: {
    electron: string
    node: string
    chrome: string
  }
}

export interface AppPaths {
  userData: string
  data: string
  logs: string
}

export interface WindowState {
  isMaximized: boolean
  isFullScreen: boolean
  isFocused: boolean
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface RendererLogEntry {
  level: LogLevel
  message: string
  context?: Record<string, unknown>
}

export interface RendererErrorReport {
  message: string
  stack?: string
  componentStack?: string
  source: 'error-boundary' | 'window-error' | 'unhandled-rejection'
}

export interface AppError {
  code: string
  message: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: AppError }

/** 自动更新在主进程与渲染层之间传递的最小状态。 */
export type AppUpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateState {
  status: AppUpdateStatus
  currentVersion: string
  version?: string
  releaseDate?: string
  releaseNotes?: string
  progress?: number
  message?: string
}

import type {
  AppSettings,
  DataExport,
  GitIdentity,
  GitFileSnapshot,
  GitState,
  HostRecord,
  NodeInstallOptions,
  NodeRegistryDraft,
  NodeRelease,
  NodeState,
  ProjectCreateOptions,
  ProjectEditorId,
  ProjectTemplate,
  SSHKey,
  SSHKeyDraft,
  SSHKeyGenerateOptions,
  SystemOverviewSnapshot,
  Workspace,
  GlobalPackage,
  NodeRegistry,
  DataStats,
  GitIdentityDetail,
  GitWorkspaceVerification,
  NodeEnvironmentPath,
  NodeTask,
  SSHDeleteImpact,
  WorkspaceScanResult,
  DialogOperationResult,
  LogStats,
  NodeDownloadSourceTestResult,
  SystemOverviewHistory
} from './domain'

export interface AppApi {
  app: {
    platform: NodeJS.Platform
    getRuntimeInfo: () => Promise<RuntimeInfo>
    writeLog: (entry: RendererLogEntry) => Promise<void>
    reportError: (report: RendererErrorReport) => Promise<void>
  }
  update: {
    getState: () => Promise<AppUpdateState>
    check: () => Promise<AppUpdateState>
    download: () => Promise<AppUpdateState>
    install: () => Promise<void>
    onStateChanged: (listener: (state: AppUpdateState) => void) => () => void
  }
  dialog: {
    selectDirectory: (defaultPath?: string) => Promise<string | null>
  }
  window: {
    getState: () => Promise<WindowState>
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<WindowState>
    close: () => Promise<void>
    onStateChanged: (listener: (state: WindowState) => void) => () => void
  }
  overview: {
    getSnapshot: () => Promise<SystemOverviewSnapshot | null>
    getHistory: () => Promise<SystemOverviewHistory>
    onUpdated: (listener: (snapshot: SystemOverviewSnapshot) => void) => () => void
  }
  hosts: {
    list: () => Promise<HostRecord[]>
    listSystem: () => Promise<HostRecord[]>
    save: (records: HostRecord[]) => Promise<HostRecord[]>
    restoreBackup: () => Promise<HostRecord[]>
    openFile: () => Promise<void>
    flushDns: () => Promise<void>
    openDomain: (domain: string) => Promise<void>
  }
  ssh: {
    list: () => Promise<SSHKey[]>
    save: (draft: SSHKeyDraft) => Promise<SSHKey[]>
    generate: (options: SSHKeyGenerateOptions) => Promise<SSHKey[]>
    remove: (id: string) => Promise<SSHKey[]>
    getDeleteImpact: (id: string) => Promise<SSHDeleteImpact>
  }
  git: {
    getState: () => Promise<GitState>
    saveGlobal: (value: { username: string; email: string }) => Promise<GitState>
    saveIdentity: (identity: GitIdentity) => Promise<GitState>
    removeIdentity: (id: string) => Promise<GitState>
    files: () => Promise<GitFileSnapshot[]>
    getIdentityDetail: (id: string) => Promise<GitIdentityDetail>
    verifyWorkspace: (workspaceId: string) => Promise<GitWorkspaceVerification>
  }
  workspaces: {
    list: () => Promise<Workspace[]>
    save: (workspace: Workspace) => Promise<Workspace[]>
    remove: (id: string) => Promise<Workspace[]>
    scan: (id: string) => Promise<Workspace[]>
    open: (id: string) => Promise<void>
    openProject: (path: string) => Promise<void>
    openProjectEditor: (path: string, editor?: ProjectEditorId) => Promise<void>
    scanDetailed: (id: string) => Promise<WorkspaceScanResult>
    cancelScan: (id: string) => Promise<void>
    saveProjectRemark: (
      workspaceId: string,
      projectId: string,
      remark: string
    ) => Promise<Workspace[]>
    addProject: (workspaceId: string, path: string) => Promise<Workspace[]>
    removeProject: (workspaceId: string, projectId: string) => Promise<Workspace[]>
  }
  templates: {
    list: () => Promise<ProjectTemplate[]>
    save: (template: ProjectTemplate) => Promise<ProjectTemplate[]>
    remove: (id: string) => Promise<ProjectTemplate[]>
    createProject: (options: ProjectCreateOptions) => Promise<Workspace[]>
  }
  node: {
    getState: () => Promise<NodeState>
    releases: (filter?: {
      keyword?: string
      channel?: 'all' | 'lts' | 'current'
      refresh?: boolean
    }) => Promise<NodeRelease[]>
    install: (options: NodeInstallOptions) => Promise<NodeState>
    switch: (version: string, setDefault: boolean) => Promise<NodeState>
    useInTerminal: (version: string) => Promise<void>
    remove: (version: string) => Promise<NodeState>
    registries: () => Promise<NodeRegistry[]>
    saveRegistry: (draft: NodeRegistryDraft) => Promise<NodeRegistry[]>
    removeRegistry: (id: string) => Promise<NodeRegistry[]>
    useRegistry: (id: string) => Promise<NodeState>
    testRegistry: (id: string) => Promise<NodeRegistry[]>
    installNrm: () => Promise<NodeState>
    packages: (keyword?: string) => Promise<GlobalPackage[]>
    syncGlobalPackages: (sourceVersion: string) => Promise<GlobalPackage[]>
    setPackageManager: (manager: string) => Promise<NodeState>
    setPackageRegistry: (manager: string, registry: string) => Promise<NodeState>
    installPackage: (name: string) => Promise<GlobalPackage[]>
    removePackage: (name: string) => Promise<GlobalPackage[]>
    updatePackage: (name: string) => Promise<GlobalPackage[]>
    scanCaches: () => Promise<NodeState>
    clearCaches: () => Promise<NodeState>
    clearCache: (id: 'npm' | 'pnpm' | 'yarn' | 'bun') => Promise<NodeState>
    checkOutdated: () => Promise<GlobalPackage[]>
    environmentPaths: () => Promise<NodeEnvironmentPath[]>
    tasks: () => Promise<NodeTask[]>
    cancelTask: (id: string) => Promise<NodeState>
    retryTask: (id: string) => Promise<NodeState>
    clearTasks: () => Promise<NodeState>
    openPath: (path: string) => Promise<void>
    onTaskUpdated: (listener: (state: NodeState) => void) => () => void
  }
  settings: {
    get: () => Promise<AppSettings>
    save: (settings: AppSettings) => Promise<AppSettings>
    reset: () => Promise<AppSettings>
    testNodeDownloadSource: (settings: AppSettings['node']) => Promise<NodeDownloadSourceTestResult>
    export: () => Promise<DataExport>
    exportFile: () => Promise<DialogOperationResult>
    import: (data: DataExport) => Promise<AppSettings>
    importFile: () => Promise<DialogOperationResult<AppSettings>>
    openData: () => Promise<void>
    changeDataDirectory: () => Promise<DialogOperationResult<AppSettings>>
    clearBusinessData: () => Promise<AppSettings>
    dataStats: () => Promise<DataStats>
    logStats: () => Promise<LogStats>
    openLogs: () => Promise<void>
    clearLogArchives: () => Promise<LogStats>
    onDataChanged: (listener: () => void) => () => void
    openDeveloperTools: () => Promise<void>
  }
}
