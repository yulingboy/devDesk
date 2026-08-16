export interface RuntimeInfo {
  appName: string
  appVersion: string
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
  ProjectTemplate,
  SSHKey,
  SSHKeyDraft,
  SSHKeyGenerateOptions,
  SystemOverviewSnapshot,
  Workspace,
  EnvironmentCheck,
  GlobalPackage,
  NodeRegistry,
  DataStats,
  EnvironmentTool,
  GitIdentityDetail,
  NodeEnvironmentPath,
  NodeTask,
  SSHDeleteImpact,
  WorkspaceScanResult
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
    openProjectEditor: (path: string) => Promise<void>
    scanDetailed: (id: string) => Promise<WorkspaceScanResult>
    getProjectDetail: (workspaceId: string, projectId: string) => Promise<ProjectDetail>
    refreshProject: (workspaceId: string, projectId: string) => Promise<ProjectDetail>
    addProject: (workspaceId: string, path: string) => Promise<Workspace[]>
    removeProject: (workspaceId: string, projectId: string) => Promise<Workspace[]>
    installDependencies: (workspaceId: string, projectId: string) => Promise<ProjectDetail>
    runScript: (workspaceId: string, projectId: string, script: string) => Promise<void>
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
    packages: (keyword?: string) => Promise<GlobalPackage[]>
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
    exportFile: () => Promise<void>
    import: (data: DataExport) => Promise<AppSettings>
    importFile: () => Promise<AppSettings>
    openData: () => Promise<void>
    changeDataDirectory: () => Promise<AppSettings>
    clearBusinessData: () => Promise<AppSettings>
    environmentCheck: () => Promise<EnvironmentCheck[]>
    stopEnvironmentCheck: () => Promise<void>
    openEnvironmentGuide: (id: string) => Promise<void>
    environmentTools: () => Promise<EnvironmentTool[]>
    installEnvironmentTool: (id: string) => Promise<EnvironmentCheck>
    onEnvironmentCheckUpdated: (listener: (checks: EnvironmentCheck[]) => void) => () => void
    dataStats: () => Promise<DataStats>
    openDeveloperTools: () => Promise<void>
  }
}
