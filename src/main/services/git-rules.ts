import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { GitIdentity, SSHKey } from '@shared/domain'
import { getStoreDirectory, store } from '@main/infrastructure/store'
import { getUserShellEnvironment } from '@main/infrastructure/shell-environment'
import { requiredText } from './common'
import { runGitCommand } from './git-command'

const execFileAsync = promisify(execFile)

export function gitConfigValue(value: string, label: string, maxLength: number): string {
  const text = requiredText(value, label, maxLength)
  if (/[\r\n\0]/.test(text)) throw new Error(`${label}不能包含换行或控制字符`)
  return text
}

function quoteGitConfigValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function escapeGitConfigPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function writeProfile(identity: GitIdentity, keys: SSHKey[]): Promise<void> {
  const directory = join(getStoreDirectory(), 'git-rules')
  await mkdir(directory, { recursive: true })
  const key = keys.find((item) => item.id === identity.sshKeyId && item.privateKeyPath)
  const sshSection = key?.privateKeyPath
    ? `\n[core]\n\tsshCommand = ssh -i ${quoteGitConfigValue(gitConfigValue(key.privateKeyPath, 'SSH 私钥路径', 1_000))} -o IdentitiesOnly=yes\n`
    : ''
  await writeFile(
    join(directory, `${identity.id}.profile`),
    `[user]\n\tname = ${quoteGitConfigValue(gitConfigValue(identity.username, '用户名', 120))}\n\temail = ${quoteGitConfigValue(gitConfigValue(identity.email, '邮箱', 200))}\n${sshSection}`,
    'utf8'
  )
}

/** 将工作区路径规则集中写入托管 include 文件，并挂到用户级 Git 配置。 */
export async function syncGitRules(): Promise<void> {
  const identities = await store.gitIdentities.read()
  const keys = await store.sshKeys.read()
  const workspaces = await store.workspaces.read()
  const directory = join(getStoreDirectory(), 'git-rules')
  await mkdir(directory, { recursive: true })
  for (const identity of identities) await writeProfile(identity, keys)
  const activeProfiles = new Set(identities.map((identity) => `${identity.id}.profile`))
  for (const file of await readdir(directory).catch(() => [])) {
    if (file.endsWith('.profile') && !activeProfiles.has(file))
      await rm(join(directory, file), { force: true })
  }
  const lines = workspaces.flatMap((workspace) => {
    const identity = identities.find((item) => item.id === workspace.gitIdentityId)
    if (!identity) return []
    const gitDirectory = `${workspace.rootPath.replace(/\\/g, '/').replace(/\/+$/, '')}/`
    return [
      `[includeIf ${quoteGitConfigValue(`gitdir:${gitDirectory}`)}]`,
      `\tpath = ${quoteGitConfigValue(join(directory, `${identity.id}.profile`))}`
    ]
  })
  await writeFile(join(directory, 'workspace-rules.inc'), `${lines.join('\n')}\n`, 'utf8')
  const includes: string[] = await execFileAsync(
    'git',
    ['config', '--global', '--get-all', 'include.path'],
    { env: await getUserShellEnvironment() }
  )
    .then(({ stdout }) => stdout.split('\n'))
    .catch(() => [] as string[])
  const includePath = join(directory, 'workspace-rules.inc')
  if (!lines.length) {
    await removeGitRuleInclude(includePath)
    return
  }
  if (!includes.includes(includePath))
    await runGitCommand(['config', '--global', '--add', 'include.path', includePath])
}

/** 只移除本应用精确写入的 include.path，绝不影响用户自己的 Git include 配置。 */
export async function removeGitRuleInclude(includePath: string): Promise<void> {
  await execFileAsync(
    'git',
    [
      'config',
      '--global',
      '--unset-all',
      'include.path',
      `^${escapeGitConfigPattern(includePath)}$`
    ],
    { env: await getUserShellEnvironment() }
  ).catch((error: unknown) => {
    // Git 在键不存在时返回退出码 5，这不是异常；其他失败应保留给调用方处理。
    if (error instanceof Error && 'code' in error && (error.code === 5 || error.code === 'ENOENT'))
      return
    throw error
  })
}
