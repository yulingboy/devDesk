import { randomUUID } from 'node:crypto'

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function requiredText(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== 'string') throw new Error(`${label}必须是文本`)
  const result = value.trim()
  if (!result) throw new Error(`${label}不能为空`)
  if (result.length > maxLength) throw new Error(`${label}不能超过${maxLength}个字符`)
  return result
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isValidIpv4(value: string): boolean {
  const parts = value.split('.')
  return (
    parts.length === 4 &&
    parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
  )
}

export function isValidDomain(value: string): boolean {
  return /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(
    value
  )
}
