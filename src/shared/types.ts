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
}
