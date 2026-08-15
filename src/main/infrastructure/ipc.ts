import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { log } from './logger'
import type { AppError, IpcResult } from '@shared/types'

type IpcHandler<T> = (event: IpcMainInvokeEvent, ...args: unknown[]) => T | Promise<T>

const managedWebContents = new Set<number>()

/** 记录由应用创建的渲染进程，作为 IPC 来源校验的第一层依据。 */
export function registerManagedWindow(window: BrowserWindow): void {
  const webContentsId = window.webContents.id
  managedWebContents.add(webContentsId)
  window.on('closed', () => managedWebContents.delete(webContentsId))
}

/** 包装 ipcMain.handle，统一完成来源校验、耗时记录和错误序列化。 */
export function registerIpcHandler<T>(channel: string, handler: IpcHandler<T>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
    const startedAt = performance.now()

    try {
      // 先校验发送方，再调用业务逻辑；不能仅因请求来自已知频道就信任渲染层输入。
      assertTrustedSender(event)
      const data = await handler(event, ...args)
      log.debug(`IPC 调用完成：${channel}`, {
        durationMs: Math.round(performance.now() - startedAt)
      })
      return { ok: true, data }
    } catch (error) {
      const appError = toAppError(error)
      log.error(`IPC 调用失败：${channel}`, {
        code: appError.code,
        message: appError.message,
        durationMs: Math.round(performance.now() - startedAt)
      })
      return { ok: false, error: appError }
    }
  })
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || !managedWebContents.has(event.sender.id) || window.isDestroyed()) {
    throw createAppError('UNTRUSTED_IPC_SOURCE', 'IPC 请求来源未通过校验')
  }

  const senderUrl = event.senderFrame?.url
  if (!senderUrl) {
    throw createAppError('UNTRUSTED_IPC_SOURCE', 'IPC 请求页面未通过校验')
  }
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  const isTrustedDevelopmentUrl = rendererUrl ? hasSameOrigin(senderUrl, rendererUrl) : false
  const isTrustedProductionUrl = isExpectedFileUrl(senderUrl)

  if (!isTrustedDevelopmentUrl && !isTrustedProductionUrl) {
    throw createAppError('UNTRUSTED_IPC_SOURCE', 'IPC 请求来源地址未通过校验')
  }
}

function hasSameOrigin(url: string, expectedUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(expectedUrl).origin
  } catch {
    return false
  }
}

function isExpectedFileUrl(url: string): boolean {
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

function createAppError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

function toAppError(error: unknown): AppError {
  if (error instanceof Error) {
    return {
      code: 'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR',
      message: error.message || '发生未预期的内部错误'
    }
  }

  return { code: 'INTERNAL_ERROR', message: '发生未预期的内部错误' }
}
