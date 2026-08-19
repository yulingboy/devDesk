import { app, BrowserWindow } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { IPC_CHANNELS } from '@shared/ipc'
import type { AppUpdateState } from '@shared/types'
import { log } from '@main/infrastructure/logger'

let initialized = false
let state: AppUpdateState = {
  status: 'idle',
  currentVersion: app.getVersion()
}

/** 初始化 GitHub Releases 更新器。开发模式不会访问远端，也不会下载更新。 */
export function initializeUpdateService(): AppUpdateState {
  if (!app.isPackaged) {
    state = { status: 'disabled', currentVersion: app.getVersion(), message: '开发模式不检查更新' }
    return state
  }
  if (initialized) return state

  initialized = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('checking-for-update', () =>
    setState({ status: 'checking', message: '正在检查更新' })
  )
  autoUpdater.on('update-available', (info) => setState(fromUpdateInfo('available', info)))
  autoUpdater.on('update-not-available', (info) => setState(fromUpdateInfo('not-available', info)))
  autoUpdater.on('download-progress', (progress) => setState(fromProgress(progress)))
  autoUpdater.on('update-downloaded', (info) => setState(fromUpdateInfo('downloaded', info)))
  autoUpdater.on('error', (error) => {
    log.error('应用更新失败', { error: error.message })
    setState({ status: 'error', message: toUpdateError(error) })
  })
  return state
}

export function getUpdateState(): AppUpdateState {
  return state
}

export async function checkForAppUpdate(): Promise<AppUpdateState> {
  ensureEnabled()
  setState({ status: 'checking', message: '正在检查更新' })
  try {
    const result = await autoUpdater.checkForUpdates()
    // 某些 provider 不触发“无更新”事件，使用结果补齐最终状态。
    if (!result?.updateInfo) setState({ status: 'not-available', message: '当前已是最新版本' })
  } catch (error) {
    const message = toUpdateError(error)
    setState({ status: 'error', message })
    throw new Error(message)
  }
  return state
}

export async function downloadAppUpdate(): Promise<AppUpdateState> {
  ensureEnabled()
  if (state.status !== 'available') throw new Error('当前没有可下载的更新')
  setState({ ...state, status: 'downloading', progress: 0, message: '正在下载更新' })
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    const message = toUpdateError(error)
    setState({ ...state, status: 'error', message })
    throw new Error(message)
  }
  return state
}

export function installAppUpdate(): void {
  ensureEnabled()
  if (state.status !== 'downloaded') throw new Error('更新尚未下载完成')
  // 由用户点击确认后才退出并安装，避免工作未保存时突然重启。
  autoUpdater.quitAndInstall(false, true)
}

function ensureEnabled(): void {
  initializeUpdateService()
  if (!app.isPackaged) throw new Error('开发模式不支持应用更新')
}

function setState(next: Partial<AppUpdateState>): void {
  state = { ...state, ...next, currentVersion: app.getVersion() }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.update.stateChanged, state)
  }
}

function fromUpdateInfo(status: AppUpdateState['status'], info: UpdateInfo): AppUpdateState {
  return {
    status,
    currentVersion: app.getVersion(),
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: formatReleaseNotes(info.releaseNotes),
    message: status === 'available' ? `发现新版本 ${info.version}` : '当前已是最新版本'
  }
}

function fromProgress(progress: ProgressInfo): AppUpdateState {
  return {
    ...state,
    status: 'downloading',
    progress: Math.round(progress.percent),
    message: `正在下载更新（${Math.round(progress.percent)}%）`
  }
}

function formatReleaseNotes(notes: UpdateInfo['releaseNotes']): string | undefined {
  if (!notes) return undefined
  if (typeof notes === 'string') return notes
  return (
    notes
      .map((item) => item.note)
      .filter(Boolean)
      .join('\n') || undefined
  )
}

function toUpdateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/cannot find|latest\.yml|update\.yml/i.test(message))
    return '暂时无法获取 GitHub Release 信息，请稍后重试'
  if (/net|timeout|connect|fetch|socket/i.test(message)) return '连接 GitHub 失败，请检查网络后重试'
  if (/permission|access denied|code signature/i.test(message)) return '更新文件权限或签名校验失败'
  return message || '应用更新失败，请稍后重试'
}
