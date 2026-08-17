import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPathWithin, isValidIp, optionalText } from './common'

describe('IP 地址校验', () => {
  it('接受标准 IPv4 与 IPv6 地址', () => {
    expect(isValidIp('127.0.0.1')).toBe(true)
    expect(isValidIp('::1')).toBe(true)
    expect(isValidIp('2001:db8:85a3::8a2e:370:7334')).toBe(true)
  })

  it('拒绝非 IP 地址和不完整 IPv6 地址', () => {
    expect(isValidIp('localhost')).toBe(false)
    expect(isValidIp('2001:db8:::1')).toBe(false)
    expect(isValidIp('999.1.1.1')).toBe(false)
  })
})

describe('通用文本与路径处理', () => {
  it('清理并裁剪可选文本', () => {
    expect(optionalText('  项目备注  ', 4)).toBe('项目备注')
    expect(optionalText(undefined)).toBe('')
  })

  it('只接受根目录自身或真实子路径', () => {
    const root = resolve('/tmp/env-tool/workspaces')
    expect(isPathWithin(root, root)).toBe(true)
    expect(isPathWithin(root, join(root, 'project'))).toBe(true)
    expect(isPathWithin(root, resolve(root, '..', 'workspaces-backup'))).toBe(false)
    expect(isPathWithin(root, resolve(root, '..', 'outside'))).toBe(false)
  })
})
