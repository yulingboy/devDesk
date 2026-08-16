import type { ProjectPackageManager } from '@shared/domain'

/** packageManager 通常形如 pnpm@10.0.0；这里只接受应用明确支持的工具。 */
export function parseProjectPackageManager(value: unknown): ProjectPackageManager | undefined {
  if (typeof value !== 'string') return undefined
  const name = value.split('@')[0]
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(name) ? (name as ProjectPackageManager) : undefined
}

/**
 * 轻量判断常见 Node major 范围，不尝试取代完整 semver 解析器。
 * 无法识别的表达式返回 null，页面据此展示“未判断”而不是误报不兼容。
 */
export function isNodeRequirementSatisfied(
  currentVersion: string,
  requirement?: string
): boolean | null {
  if (!requirement) return null
  const currentMajor = Number(currentVersion.match(/^\d+/)?.[0])
  if (!Number.isFinite(currentMajor)) return null
  const alternatives = requirement
    .split('||')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!alternatives.length) return null
  let recognized = false
  const matched = alternatives.some((alternative) => {
    const comparators = [...alternative.matchAll(/(>=|<=|>|<|\^|~)?\s*(\d+)(?:\.\d+){0,2}/g)]
    if (!comparators.length) return false
    recognized = true
    return comparators.every(([, operator = '', majorText]) => {
      const major = Number(majorText)
      if (operator === '>=') return currentMajor >= major
      if (operator === '<=') return currentMajor <= major
      if (operator === '>') return currentMajor > major
      if (operator === '<') return currentMajor < major
      return currentMajor === major
    })
  })
  return recognized ? matched : null
}
