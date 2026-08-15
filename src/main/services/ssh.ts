import { createHash } from 'node:crypto'
import { access, readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SSHKey, SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
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
      if (!saved.some((item) => item.publicKey === parsed.publicKey)) discovered.push(parsed)
    } catch {
      // 忽略不符合公钥格式的文件，避免单个文件阻断整个密钥列表。
    }
  }
  const merged = [...saved, ...discovered]
  return Promise.all(merged.map(withPrivateKeyStatus))
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
  return listSshKeys()
}
