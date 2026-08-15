import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppPaths } from '@shared/types'

let cachedPaths: AppPaths | undefined

/** 创建应用可写目录，并缓存后续 IPC 查询所需的路径。 */
export function initializeAppPaths(): AppPaths {
  const userData = app.getPath('userData')
  const paths: AppPaths = {
    userData,
    data: join(userData, 'data'),
    logs: join(userData, 'logs')
  }

  // 将业务数据和诊断日志与打包资源分开保存。
  mkdirSync(paths.data, { recursive: true })
  mkdirSync(paths.logs, { recursive: true })
  cachedPaths = paths

  return paths
}

export function getAppPaths(): AppPaths {
  if (!cachedPaths) {
    throw new Error('应用路径尚未初始化')
  }

  return cachedPaths
}
