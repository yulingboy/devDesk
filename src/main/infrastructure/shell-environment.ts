import { execFile } from 'node:child_process'
import { dirname } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
let shellEnvironmentPromise: Promise<NodeJS.ProcessEnv> | undefined

/**
 * macOS 从 Finder/Dock 启动应用时不会继承交互式终端的 PATH。
 * 所有需要调用用户开发工具的服务都复用同一份登录 Shell 环境，避免各页面显示不一致。
 */
export async function getUserShellEnvironment(): Promise<NodeJS.ProcessEnv> {
  if (process.platform === 'win32') return { ...process.env }
  shellEnvironmentPromise ??= (async () => {
    const pathMarker = '__ENV_TOOL_PATH__='
    const nodeMarker = '__ENV_TOOL_NODE__='
    try {
      const { stdout } = await execFileAsync(
        process.env.SHELL || '/bin/zsh',
        [
          '-ilc',
          `printf '\\n${pathMarker}%s\\n${nodeMarker}' "$PATH"; node -p 'process.execPath' 2>/dev/null || true`
        ],
        { timeout: 5_000, maxBuffer: 1024 * 1024 }
      )
      const path = stdout.match(new RegExp(`${pathMarker}([^\\r\\n]+)`))?.[1]?.trim() ?? ''
      const nodeExecutable =
        stdout.match(new RegExp(`${nodeMarker}([^\\r\\n]+)`))?.[1]?.trim() ?? ''
      const effectivePath = [nodeExecutable ? dirname(nodeExecutable) : '', path]
        .filter(Boolean)
        .join(':')
      return effectivePath ? { ...process.env, PATH: effectivePath } : { ...process.env }
    } catch {
      return { ...process.env }
    }
  })()
  return shellEnvironmentPromise
}

/** 数据目录、Shell 配置或用户环境变化后允许下一次调用重新读取 PATH。 */
export function resetUserShellEnvironment(): void {
  shellEnvironmentPromise = undefined
}
