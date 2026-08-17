import { describe, expect, it } from 'vitest'
import { toErrorMessage } from './errors'

describe('渲染层错误文本', () => {
  it('优先保留 Error 和字符串中的明确信息', () => {
    expect(toErrorMessage(new Error('读取失败'))).toBe('读取失败')
    expect(toErrorMessage('保存失败')).toBe('保存失败')
  })

  it('未知异常使用调用方提供的中文兜底信息', () => {
    expect(toErrorMessage(undefined, '创建项目失败')).toBe('创建项目失败')
    expect(toErrorMessage({ code: 500 })).toBe('操作失败，请稍后重试')
  })
})
