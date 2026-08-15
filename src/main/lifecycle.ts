import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerApplicationIpc } from '@main/ipc-handlers'
import { initializeLogger, log } from '@main/infrastructure/logger'
import { initializeAppPaths } from '@main/infrastructure/paths'
import { createMainWindow } from '@main/window'
import { WindowPool } from '@main/window-pool'

const windowPool = new WindowPool()

/** 注册应用启动、单实例恢复和退出清理流程。 */
export function registerAppLifecycle(): void {
  app.whenReady().then(() => {
    const paths = initializeAppPaths()
    initializeLogger(paths)
    electronApp.setAppUserModelId('com.envtool.app')
    log.info('应用开始启动', { version: app.getVersion(), paths })

    // 仅在开发环境启用 Electron Toolkit 提供的调试快捷键。
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    registerApplicationIpc()
    windowPool.open('main', createMainWindow)

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
    windowPool.closeAll()
  })
}
