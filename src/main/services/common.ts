import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

/** 业务 ID 会参与文件名和 IPC 资源定位，只允许稳定的非路径字符。 */
export function entityId(value: unknown, label = '资源 ID'): string {
  const id = requiredText(value, label, 120)
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`${label}格式无效`)
  return id
}

export function requiredText(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== 'string') throw new Error(`${label}必须是文本`)
  const result = value.trim()
  if (!result) throw new Error(`${label}不能为空`)
  if (result.length > maxLength) throw new Error(`${label}不能超过${maxLength}个字符`)
  return result
}

/** 清理可选文本并限制持久化长度，避免各服务重复 trim/slice。 */
export function optionalText(value: string | null | undefined, maxLength = 200): string {
  return (value ?? '').trim().slice(0, maxLength)
}

/** 判断目标路径是否位于根路径内；根路径自身也视为范围内。 */
export function isPathWithin(rootPath: string, targetPath: string): boolean {
  const value = relative(resolve(rootPath), resolve(targetPath))
  return !value || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value))
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
