import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerApplicationIpc } from '@main/ipc/handlers'
import { initializeLogger, log, setLogLevel } from '@main/infrastructure/logger'
import { initializeAppPaths } from '@main/infrastructure/paths'
import { initializeStore } from '@main/infrastructure/store'
import { createMainWindow } from '@main/windows/main-window'
import { WindowPool } from '@main/windows/window-pool'
import { IPC_CHANNELS } from '@shared/ipc'
import { startOverviewSampler, stopOverviewSampler } from '@main/services/overview'
import { createAppTray, destroyAppTray, markAppQuitting, setMinimizeToTray } from '@main/app/tray'
import { getSettings } from '@main/services/settings'
import { stopAllProjectTasks } from '@main/services/workspaces'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
import appIcon from '../../../resources/icon.png?asset'

const windowPool = new WindowPool()

/** 注册应用启动、单实例恢复和退出清理流程。 */
export function registerAppLifecycle(): void {
  app.whenReady().then(async () => {
    const paths = initializeAppPaths()
    await initializeStore(paths)
    initializeLogger(paths)
    electronApp.setAppUserModelId('com.devdesk.app')
    // 开发模式运行的是 Electron 外壳，macOS 不会自动读取构建阶段的 ICNS。
    if (process.platform === 'darwin') app.dock?.setIcon(appIcon)
    log.info('应用开始启动', { version: app.getVersion(), paths })

    // 仅在开发环境启用 Electron Toolkit 提供的调试快捷键。
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    registerApplicationIpc()
    const mainWindow = windowPool.open('main', createMainWindow)
    // Finder/Dock 启动时后台预热登录 Shell，避免首次打开开发工具页面才支付 PATH 探测耗时。
    void getUserShellEnvironment()
    void getSettings()
      .then((settings) => {
        setMinimizeToTray(settings.general.minimizeToTray)
        setLogLevel(settings.advanced.logLevel)
      })
      .catch(() => undefined)
    createAppTray(mainWindow)
    startOverviewSampler((snapshot) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.overview.updated, snapshot)
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowPool.open('main', createMainWindow)
      }
    })
  })

  // 第二个实例只负责通知第一个实例聚焦主窗口。
  app.on('second-instance', () => {
    windowPool.focus('main')
  })

  app.on('window-all-closed', () => {
    // macOS 关闭最后一个窗口后继续驻留，等待 Dock 图标再次激活应用。
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    log.info('应用准备退出')
    markAppQuitting()
    stopAllProjectTasks()
    stopOverviewSampler()
    destroyAppTray()
    windowPool.closeAll()
  })
}
