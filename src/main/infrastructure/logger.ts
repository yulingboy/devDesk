import { join } from 'node:path'
import log from 'electron-log/main'
import type { AppPaths, LogLevel, RendererErrorReport, RendererLogEntry } from '@shared/types'

const MAX_LOG_SIZE = 5 * 1024 * 1024

/** 初始化主进程日志文件、轮转上限和开发环境控制台输出。 */
export function initializeLogger(paths: AppPaths): void {
  log.initialize()
  log.transports.file.resolvePathFn = () => join(paths.logs, 'main.log')
  log.transports.file.maxSize = MAX_LOG_SIZE
  log.transports.file.level = 'info'
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

  log.info('日志系统已初始化', {
    version: process.versions.electron,
    platform: process.platform,
    arch: process.arch
  })
}

/** 捕获主进程未进入业务错误处理流程的最后一道异常。 */
export function registerProcessErrorLogging(): void {
  process.on('uncaughtException', (error) => {
    log.error('主进程发生未捕获异常', error)
  })

  process.on('unhandledRejection', (reason) => {
    log.error('主进程发生未处理的异步拒绝', reason)
  })
}

export function writeRendererLog(entry: RendererLogEntry): void {
  const context = entry.context ? [entry.context] : []
  writeLog(entry.level, `[renderer] ${entry.message}`, ...context)
}

export function writeRendererError(report: RendererErrorReport): void {
  log.error(`[renderer:${report.source}] ${report.message}`, {
    stack: report.stack,
    componentStack: report.componentStack
  })
}

export function writeLog(level: LogLevel, message: string, ...args: unknown[]): void {
  log[level](message, ...args)
}

/** 设置持久化日志阈值；控制台在开发环境中仍保留调试信息。 */
export function setLogLevel(level: LogLevel): void {
  log.transports.file.level = level
  if (process.env.NODE_ENV !== 'development') log.transports.console.level = level
  log.info('日志级别已更新', { level })
}

export { log }
