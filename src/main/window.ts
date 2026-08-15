import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { is } from '@electron-toolkit/utils'
import type { WindowState } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc'
import { registerManagedWindow } from '@main/infrastructure/ipc'
import { log } from '@main/infrastructure/logger'
import icon from '../../resources/icon.png?asset'

/** 创建主窗口并绑定安全导航、日志和窗口状态事件。 */
export function createMainWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    show: false,
    // macOS 保留原生交通灯，其他平台由 AppHeader 提供窗口按钮。
    ...(isMac
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 14, y: 14 } }
      : { frame: false, titleBarStyle: 'hidden' as const }),
    backgroundColor: '#f5f7f8',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  registerManagedWindow(window)
  registerWindowLogging(window)
  registerWindowStateEvents(window)

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
        void shell.openExternal(url)
      }
    } catch (error) {
      log.warn('拒绝格式错误的外部链接', { url, error })
    }

    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url)) {
      event.preventDefault()
      log.warn('拦截渲染层跳转', { url })
    }
  })

  // 开发环境使用 electron-vite 提供的 URL，打包后必须加载指定入口以保持 IPC 校验。
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

export function registerWindowStateEvents(window: BrowserWindow): void {
  // 所有会影响标题栏按钮状态的事件都复用同一个状态推送函数。
  const emitState = (): void => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.window.stateChanged, getWindowState(window))
    }
  }

  window.on('maximize', emitState)
  window.on('unmaximize', emitState)
  window.on('enter-full-screen', emitState)
  window.on('leave-full-screen', emitState)
  window.on('focus', emitState)
  window.on('blur', emitState)
}

export function registerWindowLogging(window: BrowserWindow): void {
  // Electron 渲染进程异常需要落到主进程日志，避免页面崩溃后丢失现场。
  window.webContents.on('render-process-gone', (_, details) => {
    log.error('渲染进程已退出', details)
  })

  window.webContents.on('unresponsive', () => log.warn('渲染进程无响应'))
  window.webContents.on('responsive', () => log.info('渲染进程恢复响应'))
  window.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedUrl) => {
    log.error('渲染页面加载失败', { errorCode, errorDescription, validatedUrl })
  })
}

export function getWindowState(window: BrowserWindow | null): WindowState {
  if (!window || window.isDestroyed()) {
    return { isMaximized: false, isFullScreen: false, isFocused: false }
  }

  return {
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen(),
    isFocused: window.isFocused()
  }
}

function isTrustedNavigation(url: string): boolean {
  // 开发环境允许同源 Vite 页面，生产环境只允许打包后的 renderer 入口。
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    try {
      return new URL(url).origin === new URL(process.env.ELECTRON_RENDERER_URL).origin
    } catch {
      return false
    }
  }

  try {
    const actualUrl = new URL(url)
    const expectedUrl = pathToFileURL(join(__dirname, '../renderer/index.html'))
    actualUrl.search = ''
    actualUrl.hash = ''
    return actualUrl.href === expectedUrl.href
  } catch {
    return false
  }
}
