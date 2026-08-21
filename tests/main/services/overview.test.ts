import { describe, expect, it } from 'vitest'
import { parseMacMemoryAvailable } from '@main/services/overview'

describe('macOS 内存统计', () => {
  it('将空闲、非活跃和推测页面计入可用内存', () => {
    const output = `Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 100.\nPages active: 800.\nPages inactive: 200.\nPages speculative: 50.\nPages wired down: 300.`

    expect(parseMacMemoryAvailable(output, 16_384_000)).toBe(350 * 16_384)
  })

  it('无法解析时交由调用方回退系统值', () => {
    expect(parseMacMemoryAvailable('invalid', 1_000)).toBeUndefined()
  })
})
