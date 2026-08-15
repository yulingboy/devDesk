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
  ProjectTemplate,
  SSHKey,
  SSHKeyDraft,
  SSHKeyGenerateOptions,
  SystemOverviewSnapshot,
  Workspace,
  EnvironmentCheck,
  GlobalPackage,
  NodeRegistry,
  DataStats
} from './domain'

export interface AppApi {
  app: {
    platform: NodeJS.Platform
    getRuntimeInfo: () => Promise<RuntimeInfo>
    writeLog: (entry: RendererLogEntry) => Promise<void>
    reportError: (report: RendererErrorReport) => Promise<void>
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
  }
  git: {
    getState: () => Promise<GitState>
    saveGlobal: (value: { username: string; email: string }) => Promise<GitState>
    saveIdentity: (identity: GitIdentity) => Promise<GitState>
    removeIdentity: (id: string) => Promise<GitState>
    files: () => Promise<GitFileSnapshot[]>
  }
  workspaces: {
    list: () => Promise<Workspace[]>
    save: (workspace: Workspace) => Promise<Workspace[]>
    remove: (id: string) => Promise<Workspace[]>
    scan: (id: string) => Promise<Workspace[]>
    open: (id: string) => Promise<void>
    openProject: (path: string) => Promise<void>
    openProjectEditor: (path: string) => Promise<void>
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
    }) => Promise<NodeRelease[]>
    install: (options: NodeInstallOptions) => Promise<NodeState>
    switch: (version: string, setDefault: boolean) => Promise<NodeState>
    remove: (version: string) => Promise<NodeState>
    registries: () => Promise<NodeRegistry[]>
    saveRegistry: (draft: NodeRegistryDraft) => Promise<NodeRegistry[]>
    removeRegistry: (id: string) => Promise<NodeRegistry[]>
    useRegistry: (id: string) => Promise<NodeState>
    testRegistry: (id: string) => Promise<NodeRegistry[]>
    packages: (keyword?: string) => Promise<GlobalPackage[]>
    installPackage: (name: string) => Promise<GlobalPackage[]>
    removePackage: (name: string) => Promise<GlobalPackage[]>
    updatePackage: (name: string) => Promise<GlobalPackage[]>
    scanCaches: () => Promise<NodeState>
    clearCaches: () => Promise<NodeState>
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
    clearBusinessData: () => Promise<AppSettings>
    environmentCheck: () => Promise<EnvironmentCheck[]>
    dataStats: () => Promise<DataStats>
    openDeveloperTools: () => Promise<void>
  }
}
