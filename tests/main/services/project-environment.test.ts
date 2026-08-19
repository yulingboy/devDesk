import { describe, expect, it } from 'vitest'
import {
  isNodeRequirementSatisfied,
  parseProjectPackageManager
} from '@main/services/project-environment'

describe('项目环境解析', () => {
  it('从 packageManager 字段识别受支持的包管理器', () => {
    expect(parseProjectPackageManager('pnpm@10.4.1')).toBe('pnpm')
    expect(parseProjectPackageManager('bun@1.2.0')).toBe('bun')
    expect(parseProjectPackageManager('unknown@1')).toBeUndefined()
  })

  it('判断常见 Node major 范围', () => {
    expect(isNodeRequirementSatisfied('22.14.0', '>=20 <23')).toBe(true)
    expect(isNodeRequirementSatisfied('18.20.0', '>=20')).toBe(false)
    expect(isNodeRequirementSatisfied('22.1.0', '^22.0.0 || ^24.0.0')).toBe(true)
    expect(isNodeRequirementSatisfied('', '>=20')).toBeNull()
  })

  it('判断完整 semver、通配符和短版本范围', () => {
    expect(isNodeRequirementSatisfied('20.10.3', '^20.10.0')).toBe(true)
    expect(isNodeRequirementSatisfied('21.0.0', '^20.10.0')).toBe(false)
    expect(isNodeRequirementSatisfied('20.11.4', '~20.11.0')).toBe(true)
    expect(isNodeRequirementSatisfied('20.12.0', '~20.11.0')).toBe(false)
    expect(isNodeRequirementSatisfied('22.4.1', '22.x')).toBe(true)
    expect(isNodeRequirementSatisfied('22.4.1', '20.0.0 - 22.5.0')).toBe(true)
    expect(isNodeRequirementSatisfied('22.4.1', '*')).toBe(true)
  })
})
