import { describe, expect, it } from 'vitest'
import type { SSHKey } from '@shared/domain'
import { createDiscoveredSshKeyId, materializeSshKeyBinding } from './ssh'

const discoveredKey: SSHKey = {
  id: createDiscoveredSshKeyId('ssh-ed25519 AAAATEST developer@example.com'),
  name: 'id_ed25519',
  algorithm: 'ssh-ed25519',
  source: 'discovered',
  publicKey: 'ssh-ed25519 AAAATEST developer@example.com',
  fingerprint: 'SHA256:test',
  privateKeyPath: '/Users/developer/.ssh/id_ed25519',
  privateKeyExists: true
}

describe('SSH 密钥绑定', () => {
  it('为同一公钥生成稳定的发现 ID', () => {
    const publicKey = 'ssh-ed25519 AAAATEST developer@example.com'

    expect(createDiscoveredSshKeyId(publicKey)).toBe(createDiscoveredSshKeyId(`  ${publicKey}  `))
    expect(createDiscoveredSshKeyId(publicKey)).not.toBe(
      createDiscoveredSshKeyId('ssh-ed25519 AAAAOTHER developer@example.com')
    )
  })

  it('首次绑定时将自动发现密钥转为受管记录', () => {
    const result = materializeSshKeyBinding([], [discoveredKey], discoveredKey.id)

    expect(result.key?.id).toBe(discoveredKey.id)
    expect(result.keys).toEqual([
      expect.objectContaining({
        id: discoveredKey.id,
        publicKey: discoveredKey.publicKey,
        privateKeyPath: discoveredKey.privateKeyPath
      })
    ])
    expect(result.keys[0].privateKeyExists).toBeUndefined()
  })

  it('密钥已受管时不重复写入', () => {
    const saved = [{ ...discoveredKey, privateKeyExists: undefined }]
    const result = materializeSshKeyBinding(saved, [discoveredKey], discoveredKey.id)

    expect(result.key).toBe(saved[0])
    expect(result.keys).toBe(saved)
  })
})
