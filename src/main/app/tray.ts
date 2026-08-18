import { app, Menu, Tray, type BrowserWindow } from 'electron'
import icon from '../../../resources/icon.png?asset'

let tray: Tray | undefined
let mainWindow: BrowserWindow | undefined
let minimizeToTray = false
let quitting = false

export function createAppTray(window: BrowserWindow): void {
  mainWindow = window
  tray?.destroy()
  tray = new Tray(icon)
  tray.setToolTip('DevDesk')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: () => showMainWindow() },
      { type: 'separator' },
      {
        label: '退出 DevDesk',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => showMainWindow())
}

export function setMinimizeToTray(value: boolean): void {
  minimizeToTray = value
}

export function shouldMinimizeToTray(): boolean {
  return minimizeToTray && !quitting
}

export function markAppQuitting(): void {
  quitting = true
}

export function destroyAppTray(): void {
  tray?.destroy()
  tray = undefined
  mainWindow = undefined
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}
