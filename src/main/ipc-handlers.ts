import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { RendererErrorReport, RendererLogEntry, RuntimeInfo, WindowState } from '@shared/types'
import { registerIpcHandler } from '@main/infrastructure/ipc'
import { getAppPaths } from '@main/infrastructure/paths'
import { writeRendererError, writeRendererLog } from '@main/infrastructure/logger'
import { getWindowState } from '@main/window'

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
