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
  ProjectDetail,
  ProjectEditorId,
  ProjectTask,
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
  NodeEnvironmentPath,
  NodeTask,
  SSHDeleteImpact,
  WorkspaceScanResult,
  DialogOperationResult,
  LogStats
} from './domain'

export interface AppApi {
  app: {
    platform: NodeJS.Platform
    getRuntimeInfo: () => Promise<RuntimeInfo>
    writeLog: (entry: RendererLogEntry) => Promise<void>
    reportError: (report: RendererErrorReport) => Promise<void>
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
    onUpdated: (listener: (snapshot: SystemOverviewSnapshot) => void) => () => void
  }
  hosts: {
    list: () => Promise<HostRecord[]>
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
    getProjectDetail: (workspaceId: string, projectId: string) => Promise<ProjectDetail>
    refreshProject: (workspaceId: string, projectId: string) => Promise<ProjectDetail>
    saveProjectRemark: (
      workspaceId: string,
      projectId: string,
      remark: string
    ) => Promise<Workspace[]>
    addProject: (workspaceId: string, path: string) => Promise<Workspace[]>
    removeProject: (workspaceId: string, projectId: string) => Promise<Workspace[]>
    installDependencies: (workspaceId: string, projectId: string) => Promise<ProjectDetail>
    runScript: (workspaceId: string, projectId: string, script: string) => Promise<ProjectTask>
    tasks: (projectId?: string) => Promise<ProjectTask[]>
    stopTask: (taskId: string) => Promise<ProjectTask>
    onTaskUpdated: (listener: (task: ProjectTask) => void) => () => void
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
