import type { ProjectPackageManager } from '@shared/domain'

/** packageManager 通常形如 pnpm@10.0.0；这里只接受应用明确支持的工具。 */
export function parseProjectPackageManager(value: unknown): ProjectPackageManager | undefined {
  if (typeof value !== 'string') return undefined
  const name = value.split('@')[0]
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(name) ? (name as ProjectPackageManager) : undefined
}

interface VersionTuple {
  major: number
  minor: number
  patch: number
}

function parseVersion(value: string): VersionTuple | undefined {
  const match = value
    .trim()
    .replace(/^v/, '')
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0)
  }
}

function compareVersion(left: VersionTuple, right: VersionTuple): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

function matchesComparator(current: VersionTuple, token: string): boolean | null {
  const value = token.trim()
  if (!value || value === '*' || /^x$/i.test(value)) return true
  const match = value.match(
    /^(>=|<=|>|<|\^|~|=)?\s*v?(\d+|x|\*)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/i
  )
  if (!match) return null
  const [, operator = '', majorText, minorText, patchText] = match
  if (/^(x|\*)$/i.test(majorText)) return true
  const expected: VersionTuple = {
    major: Number(majorText),
    minor: /^\d+$/.test(minorText ?? '') ? Number(minorText) : 0,
    patch: /^\d+$/.test(patchText ?? '') ? Number(patchText) : 0
  }
  const compared = compareVersion(current, expected)
  if (operator === '>=') return compared >= 0
  if (operator === '<=') return compared <= 0
  if (operator === '>') return compared > 0
  if (operator === '<') return compared < 0
  if (operator === '^') {
    const upper =
      expected.major > 0
        ? { major: expected.major + 1, minor: 0, patch: 0 }
        : expected.minor > 0
          ? { major: 0, minor: expected.minor + 1, patch: 0 }
          : { major: 0, minor: 0, patch: expected.patch + 1 }
    return compared >= 0 && compareVersion(current, upper) < 0
  }
  if (operator === '~') {
    const upper = { major: expected.major, minor: expected.minor + 1, patch: 0 }
    return compared >= 0 && compareVersion(current, upper) < 0
  }
  if (/^(x|\*)$/i.test(minorText ?? '')) return current.major === expected.major
  if (/^(x|\*)$/i.test(patchText ?? ''))
    return current.major === expected.major && current.minor === expected.minor
  if (minorText === undefined) return current.major === expected.major
  if (patchText === undefined)
    return current.major === expected.major && current.minor === expected.minor
  return compared === 0
}

/** 支持 Node 项目常见的比较器、范围、通配符、波浪号和插入符表达式。 */
export function isNodeRequirementSatisfied(
  currentVersion: string,
  requirement?: string
): boolean | null {
  if (!requirement) return null
  const current = parseVersion(currentVersion)
  if (!current) return null
  const alternatives = requirement
    .split('||')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!alternatives.length) return null
  let recognized = false
  const matched = alternatives.some((alternative) => {
    const range = alternative.match(/^\s*(v?\d+(?:\.\d+){0,2})\s+-\s+(v?\d+(?:\.\d+){0,2})\s*$/)
    if (range) {
      const lower = parseVersion(range[1])
      const upper = parseVersion(range[2])
      if (!lower || !upper) return false
      recognized = true
      return compareVersion(current, lower) >= 0 && compareVersion(current, upper) <= 0
    }
    const tokens = alternative.split(/\s+/).filter(Boolean)
    if (!tokens.length) return false
    const results = tokens.map((token) => matchesComparator(current, token))
    if (results.every((result) => result === null)) return false
    recognized = true
    return results.every((result) => result === true)
  })
  return recognized ? matched : null
}
