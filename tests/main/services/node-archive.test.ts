import { describe, expect, it } from 'vitest'
import { assertSafeArchiveEntryPath, validateArchiveEntries } from '@main/services/node-archive'

describe('Node 安装包路径校验', () => {
  it('接受正常的 Node 发布包目录', () => {
    expect(() =>
      validateArchiveEntries(['node-v22.12.0-darwin-arm64/bin/node', 'node-v22/lib/node_modules/'])
    ).not.toThrow()
  })

  it('拒绝绝对路径和父目录跳转', () => {
    expect(() => assertSafeArchiveEntryPath('../../Library/LaunchAgents/demo')).toThrow(
      '超出解压目录'
    )
    expect(() => assertSafeArchiveEntryPath('/tmp/demo')).toThrow('不安全的绝对路径')
    expect(() => assertSafeArchiveEntryPath('C:\\Windows\\demo.exe')).toThrow('不安全的绝对路径')
  })
})
