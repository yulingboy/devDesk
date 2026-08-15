import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type {
  AppApi,
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
  }
}

contextBridge.exposeInMainWorld('api', api)
