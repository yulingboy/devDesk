import { describe, expect, it } from 'vitest'
import { isValidIp } from './common'

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
