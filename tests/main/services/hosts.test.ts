import { describe, expect, it } from 'vitest'
import {
  parseManagedHosts,
  parseSystemHosts,
  removeManagedDomainsFromUnmanaged
} from '@main/services/hosts'

describe('Hosts 分组解析', () => {
  const raw = `127.0.0.1 localhost localhost.localdomain
255.255.255.255 broadcasthost
192.168.1.8 legacy.test legacy-alias.test # 旧服务
192.168.1.9 legacy.test # 重复声明
# >>> devdesk managed hosts >>>
127.0.0.1 app.test # 本地应用
# devdesk-disabled 127.0.0.1 disabled.test
# <<< devdesk managed hosts <<<
`

  it('受管列表只读取 DevDesk 标记区块', () => {
    expect(parseManagedHosts(raw)).toMatchObject([
      { ip: '127.0.0.1', domain: 'app.test', enabled: true, remark: '本地应用' },
      { ip: '127.0.0.1', domain: 'disabled.test', enabled: false }
    ])
  })

  it('系统预览排除 DevDesk 受管区块', () => {
    expect(parseSystemHosts(raw)).toMatchObject([
      { ip: '192.168.1.8', domain: 'legacy.test', remark: '旧服务' },
      { ip: '192.168.1.8', domain: 'legacy-alias.test', remark: '旧服务' }
    ])
  })

  it('纳管域名时保留同一行的其他系统别名', () => {
    const result = removeManagedDomainsFromUnmanaged(
      '192.168.1.8 legacy.test legacy-alias.test # 旧服务\n10.0.0.2 keep.test',
      [{ domain: 'legacy.test' }]
    )

    expect(result).toContain('192.168.1.8 legacy-alias.test # 旧服务')
    expect(result).toContain('10.0.0.2 keep.test')
    expect(result).not.toMatch(/192\.168\.1\.8 legacy\.test/)
  })

  it('移除完全纳管的映射时保留原文件空行', () => {
    const result = removeManagedDomainsFromUnmanaged(
      '127.0.0.1 localhost\n\n192.168.1.8 legacy.test\n\n10.0.0.2 keep.test\n',
      [{ domain: 'legacy.test' }]
    )

    expect(result).toBe('127.0.0.1 localhost\n\n\n10.0.0.2 keep.test\n')
  })
})
