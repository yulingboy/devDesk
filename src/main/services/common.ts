import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'

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

/** Hosts 同时支持 IPv4 与 IPv6；保留旧 IPv4 校验供需要 IPv4 约束的调用方使用。 */
export function isValidIp(value: string): boolean {
  return isIP(value) !== 0
}

export function isValidDomain(value: string): boolean {
  return /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(
    value
  )
}
