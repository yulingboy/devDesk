import { createHash } from 'node:crypto'
import { access, readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SSHDeleteImpact, SSHKey, SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
import { store } from '@main/infrastructure/store'
import { createId, requiredText } from './common'

const execFileAsync = promisify(execFile)

function fingerprint(publicKey: string): string {
  const body = publicKey.trim().split(/\s+/)[1] ?? publicKey
  const digest = createHash('sha256')
    .update(Buffer.from(body, 'base64'))
    .digest('base64')
    .replace(/=+$/, '')
  return `SHA256:${digest}`
}

/** 自动发现的密钥不能使用随机 ID，否则列表刷新后 Git 身份将无法找回原密钥。 */
export function createDiscoveredSshKeyId(publicKey: string): string {
  return `ssh_discovered_${createHash('sha256').update(publicKey.trim()).digest('hex').slice(0, 24)}`
}

function parsePublicKey(
  raw: string,
  name: string,
  source: SSHKey['source'],
  privateKeyPath?: string
): SSHKey {
  const parts = raw.trim().split(/\s+/)
  if (parts.length < 2 || (!parts[0].startsWith('ssh-') && !parts[0].startsWith('ecdsa-')))
    throw new Error('公钥格式无效')
  return {
    id: createId('ssh'),
    name,
    algorithm: parts[0],
    source,
    publicKey: raw.trim(),
    fingerprint: fingerprint(raw),
    privateKeyPath
  }
}

async function withPrivateKeyStatus(key: SSHKey): Promise<SSHKey> {
  return {
    ...key,
    privateKeyExists: key.privateKeyPath
      ? await access(key.privateKeyPath)
          .then(() => true)
          .catch(() => false)
      : undefined
  }
}

export async function listSshKeys(): Promise<SSHKey[]> {
  const saved = await store.sshKeys.read()
  const directory = join(homedir(), '.ssh')
  const discovered: SSHKey[] = []
  for (const file of await readdir(directory).catch(() => [])) {
    if (!file.endsWith('.pub')) continue
    const path = join(directory, file)
    const raw = await readFile(path, 'utf8').catch(() => '')
    if (!raw) continue
    try {
      const parsed = parsePublicKey(raw, basename(file, '.pub'), 'discovered', path.slice(0, -4))
      if (!saved.some((item) => item.publicKey === parsed.publicKey)) {
        discovered.push({ ...parsed, id: createDiscoveredSshKeyId(parsed.publicKey) })
      }
    } catch {
      // 忽略不符合公钥格式的文件，避免单个文件阻断整个密钥列表。
    }
  }
  const merged = [...saved, ...discovered]
  return Promise.all(merged.map(withPrivateKeyStatus))
}

/** 只持久化密钥原始信息，privateKeyExists 等运行时状态由列表接口重新派生。 */
export function materializeSshKeyBinding(
  saved: SSHKey[],
  available: SSHKey[],
  id: string
): { key?: SSHKey; keys: SSHKey[] } {
  const existing = saved.find((key) => key.id === id)
  if (existing) return { key: existing, keys: saved }
  const discovered = available.find((key) => key.id === id)
  if (!discovered) return { keys: saved }
  const persisted: SSHKey = {
    id: discovered.id,
    name: discovered.name,
    algorithm: discovered.algorithm,
    source: discovered.source,
    publicKey: discovered.publicKey,
    fingerprint: discovered.fingerprint,
    privateKeyPath: discovered.privateKeyPath
  }
  return { key: persisted, keys: [...saved, persisted] }
}

/**
 * Git 身份首次绑定自动发现的密钥时，将它纳入受管数据。
 * 持久化后 profile 生成和后续重启都能继续解析同一个密钥 ID。
 */
export async function ensureSshKeyPersisted(id: string): Promise<SSHKey | undefined> {
  const saved = await store.sshKeys.read()
  const existing = saved.find((key) => key.id === id)
  if (existing) return existing
  const result = materializeSshKeyBinding(saved, await listSshKeys(), id)
  if (result.key && result.keys !== saved) await store.sshKeys.write(result.keys)
  return result.key
}

export async function saveSshKey(draft: SSHKeyDraft): Promise<SSHKey[]> {
  const name = requiredText(draft.name, '密钥名称', 80)
  const publicKey = requiredText(draft.publicKey, '公钥', 8_000)
  const existing = await store.sshKeys.read()
  const parsed = parsePublicKey(publicKey, name, draft.source ?? 'manual', draft.privateKeyPath)
  const duplicateName = existing.some((item) => item.name === name && item.id !== draft.id)
  if (duplicateName) throw new Error(`密钥名称重复：${name}`)
  const next = existing.filter(
    (item) => item.id !== draft.id && item.publicKey !== parsed.publicKey
  )
  next.push({
    ...parsed,
    id: draft.id ?? parsed.id,
    algorithm: draft.algorithm ?? parsed.algorithm
  })
  await store.sshKeys.write(next)
  return listSshKeys()
}

export async function generateSshKey(options: SSHKeyGenerateOptions): Promise<SSHKey[]> {
  const name = requiredText(options.name, '密钥名称', 80)
  const directory = join(homedir(), '.ssh')
  const target = join(directory, name)
  const args = ['-t', options.algorithm, '-f', target, '-N', options.passphrase ?? '']
  if (options.algorithm === 'rsa') args.push('-b', '4096')
  if (options.comment?.trim()) args.push('-C', options.comment.trim())
  await execFileAsync('ssh-keygen', args).catch(() => {
    throw new Error('生成 SSH 密钥失败，请确认 ssh-keygen 可用且目标文件不存在')
  })
  const publicKey = await readFile(`${target}.pub`, 'utf8')
  return saveSshKey({
    name,
    publicKey,
    privateKeyPath: target,
    source: 'generated',
    algorithm: options.algorithm
  })
}

/** 删除前从当前身份配置推导影响范围，防止 UI 展示过期的静态提示。 */
export async function getSshDeleteImpact(id: string): Promise<SSHDeleteImpact> {
  const key = (await store.sshKeys.read()).find((item) => item.id === id)
  if (!key) throw new Error('SSH 密钥不存在')
  const identities = (await store.gitIdentities.read())
    .filter((item) => item.sshKeyId === id)
    .map(({ id: identityId, name, username, email }) => ({
      id: identityId,
      name,
      username,
      email
    }))
  return {
    key: { id: key.id, name: key.name, fingerprint: key.fingerprint },
    identities
  }
}

export async function removeSshKey(id: string): Promise<SSHKey[]> {
  const existing = await store.sshKeys.read()
  const key = existing.find((item) => item.id === id)
  if (!key) throw new Error('SSH 密钥不存在')
  const identities = await store.gitIdentities.read()
  await store.gitIdentities.write(
    identities.map((identity) =>
      identity.sshKeyId === id ? { ...identity, sshKeyId: undefined } : identity
    )
  )
  await store.sshKeys.write(existing.filter((item) => item.id !== id))
  // 删除密钥会改变 Git profile 中的 sshCommand，必须立即重建受管规则。
  const { syncGitRules } = await import('./git')
  await syncGitRules()
  return listSshKeys()
}
