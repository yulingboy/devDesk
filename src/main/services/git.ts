import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitFileSnapshot, GitIdentity, GitIdentityDetail, GitState } from '@shared/domain'
import { getStoreDirectory, store } from '@main/infrastructure/store'
import { createId, isValidEmail } from './common'
import { ensureSshKeyPersisted } from './ssh'
import { gitConfigValue as configValue, syncGitRules } from './git-rules'
import { runGitCommand } from './git-command'

async function readGlobal(): Promise<GitState['global']> {
  try {
    const output = await runGitCommand(['config', '--global', '--list', '--show-origin'])
    const rows = output.split('\n').filter(Boolean)
    const name =
      rows
        .find((row) => row.includes('\tuser.name='))
        ?.split('user.name=')
        .slice(1)
        .join('') ?? ''
    const email =
      rows
        .find((row) => row.includes('\tuser.email='))
        ?.split('user.email=')
        .slice(1)
        .join('') ?? ''
    const sourceFile =
      rows[0]?.match(/^file:(.*?)\t/)?.[1] ?? join(process.env.HOME ?? '', '.gitconfig')
    return { username: name, email, sourceFile }
  } catch {
    return { username: '', email: '', sourceFile: join(process.env.HOME ?? '', '.gitconfig') }
  }
}

export async function getGitState(): Promise<GitState> {
  return {
    global: await readGlobal(),
    identities: await store.gitIdentities.read(),
    profileDirectory: join(getStoreDirectory(), 'git-rules')
  }
}

export async function getGitFiles(): Promise<GitFileSnapshot[]> {
  const state = await getGitState()
  const workspaces = await store.workspaces.read()
  const paths = [
    { name: '全局配置', path: state.global.sourceFile },
    { name: '工作区规则', path: join(state.profileDirectory, 'workspace-rules.inc') },
    ...state.identities.map((identity) => ({
      name: `身份：${identity.name}`,
      path: join(state.profileDirectory, `${identity.id}.profile`)
    }))
  ]
  if (!workspaces.length && !state.identities.length)
    return paths.slice(0, 2).map((item) => ({ ...item, content: '', exists: false }))
  return Promise.all(
    paths.map(async (item) => {
      const content = await readFile(item.path, 'utf8').catch(() => '')
      return { ...item, content, exists: Boolean(content) }
    })
  )
}

/** 身份详情完全基于已有配置文件和工作区规则实时生成，不增加额外持久化状态。 */
export async function getGitIdentityDetail(id: string): Promise<GitIdentityDetail> {
  const identity = (await store.gitIdentities.read()).find((item) => item.id === id)
  if (!identity) throw new Error('Git 身份不存在')
  const key = identity.sshKeyId
    ? (await store.sshKeys.read()).find((item) => item.id === identity.sshKeyId)
    : undefined
  const privateKeyExists = key?.privateKeyPath
    ? await access(key.privateKeyPath)
        .then(() => true)
        .catch(() => false)
    : undefined
  const workspaces = (await store.workspaces.read())
    .filter((item) => item.gitIdentityId === id)
    .map(({ id: workspaceId, name, rootPath }) => ({ id: workspaceId, name, rootPath }))
  return {
    identity,
    sshKey: key
      ? {
          id: key.id,
          name: key.name,
          fingerprint: key.fingerprint,
          privateKeyExists
        }
      : undefined,
    workspaces,
    profilePath: join(getStoreDirectory(), 'git-rules', `${identity.id}.profile`),
    files: await getGitFiles()
  }
}

export async function saveGlobalGit(value: { username: string; email: string }): Promise<GitState> {
  const username = configValue(value.username, 'Git 用户名', 120)
  const email = configValue(value.email, 'Git 邮箱', 200)
  if (!isValidEmail(email)) throw new Error('Git 邮箱格式无效')
  await runGitCommand(['config', '--global', '--replace-all', 'user.name', username])
  await runGitCommand(['config', '--global', '--replace-all', 'user.email', email])
  return getGitState()
}

export async function saveGitIdentity(input: GitIdentity): Promise<GitState> {
  const name = configValue(input.name, '身份名称', 80)
  const username = configValue(input.username, '用户名', 120)
  const email = configValue(input.email, '邮箱', 200)
  if (!isValidEmail(email)) throw new Error('身份邮箱格式无效')
  const existing = await store.gitIdentities.read()
  if (
    existing.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== input.id)
  )
    throw new Error(`身份名称重复：${name}`)
  if (input.sshKeyId && !(await ensureSshKeyPersisted(input.sshKeyId)))
    throw new Error('关联的 SSH 密钥不存在，请重新选择')
  const identity = { ...input, id: input.id || createId('git'), name, username, email }
  await store.gitIdentities.write([...existing.filter((item) => item.id !== identity.id), identity])
  await syncGitRules()
  return getGitState()
}

export async function removeGitIdentity(id: string): Promise<GitState> {
  const workspaces = await store.workspaces.read()
  const references = workspaces.filter((workspace) => workspace.gitIdentityId === id).slice(0, 3)
  if (references.length)
    throw new Error(`身份仍被工作区使用：${references.map((item) => item.name).join('、')}`)
  await store.gitIdentities.write(
    (await store.gitIdentities.read()).filter((item) => item.id !== id)
  )
  await syncGitRules()
  return getGitState()
}
