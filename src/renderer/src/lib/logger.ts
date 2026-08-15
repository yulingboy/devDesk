import type { LogLevel, RendererErrorReport } from '@shared/types'

/** 开发环境同步输出控制台，桌面环境同时把日志转发给主进程。 */
function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    const consoleMethod = level === 'debug' ? console.debug : console[level]
    consoleMethod(`[${level}] ${message}`, context ?? '')
  }

  void window.api?.app.writeLog({ level, message, context }).catch(() => undefined)
}

export const rendererLogger = {
  debug: (message: string, context?: Record<string, unknown>): void =>
    write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>): void =>
    write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>): void =>
    write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>): void =>
    write('error', message, context),
  reportError: (report: RendererErrorReport): void => {
    console.error(`[${report.source}] ${report.message}`, report)
    void window.api?.app.reportError(report).catch(() => undefined)
  }
}

export function registerGlobalErrorLogging(): () => void {
  // 捕获错误边界覆盖不到的脚本异常和未处理 Promise 拒绝。
  const handleError = (event: ErrorEvent): void => {
    rendererLogger.reportError({
      source: 'window-error',
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined
    })
  }

  const handleRejection = (event: PromiseRejectionEvent): void => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    rendererLogger.reportError({
      source: 'unhandled-rejection',
      message: error.message,
      stack: error.stack
    })
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}
