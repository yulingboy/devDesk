import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'

const execFileAsync = promisify(execFile)

/** 执行只需要标准输出的 Git 命令，并统一转换为面向用户的中文错误。 */
export async function runGitCommand(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      env: await getUserShellEnvironment()
    })
    return stdout.trim()
  } catch {
    throw new Error('Git 不可用或命令执行失败，请确认已安装 Git')
  }
}
