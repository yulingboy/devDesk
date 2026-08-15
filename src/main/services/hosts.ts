import { access, copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { shell } from 'electron'
import type { HostRecord } from '@shared/domain'
import { getStoreDirectory, store } from '@main/infrastructure/store'
import { createId, isValidDomain, isValidIpv4, requiredText } from './common'

const execFileAsync = promisify(execFile)
const startMarker = '# >>> env-tool managed hosts >>>'
const endMarker = '# <<< env-tool managed hosts <<<'

function hostsPath(): string {
  if (process.platform === 'win32')
    return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  return '/etc/hosts'
}

function backupPath(): string {
  return join(getStoreDirectory(), 'hosts.backup')
}

function parseManaged(raw: string): HostRecord[] {
  const start = raw.indexOf(startMarker)
  const end = raw.indexOf(endMarker)
  if (start < 0 || end < start) return []
  return raw
    .slice(start + startMarker.length, end)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const disabled = line.startsWith('# env-tool-disabled ')
      const content = line.replace(/^# env-tool-disabled\s+/, '')
      const [ip, domain, ...remarkParts] = content.split(/\s+/)
      return {
        id: createId('host'),
        ip,
        domain,
        enabled: !disabled,
        remark: remarkParts.join(' ').replace(/^#\s*/, '')
      }
    })
    .filter((record) => isValidIpv4(record.ip) && isValidDomain(record.domain))
}

export async function listHosts(): Promise<HostRecord[]> {
  const raw = await readFile(hostsPath(), 'utf8').catch(() => '')
  const records = await store.hosts.read()
  return records.length ? records : parseManaged(raw)
}

function validateRecords(records: HostRecord[]): HostRecord[] {
  const domains = new Set<string>()
  return records.map((record) => {
    const ip = requiredText(record.ip, 'IP 地址', 15)
    const domain = requiredText(record.domain, '域名', 253).toLowerCase()
    if (!isValidIpv4(ip)) throw new Error(`IP 地址格式无效：${ip}`)
    if (!isValidDomain(domain)) throw new Error(`域名格式无效：${domain}`)
    if (domains.has(domain)) throw new Error(`域名重复：${domain}`)
    domains.add(domain)
    return {
      id: record.id || createId('host'),
      ip,
      domain,
      enabled: Boolean(record.enabled),
      remark: (record.remark ?? '').trim().slice(0, 120)
    }
  })
}

export async function saveHosts(input: HostRecord[]): Promise<HostRecord[]> {
  const records = validateRecords(input)
  const path = hostsPath()
  const raw = await readFile(path, 'utf8').catch(() => '')
  await access(backupPath()).catch(() => copyFile(path, backupPath()).catch(() => undefined))
  const managed = [
    startMarker,
    ...records.map(
      (record) =>
        `${record.enabled ? '' : '# env-tool-disabled '}${record.ip} ${record.domain}${record.remark ? ` # ${record.remark}` : ''}`
    ),
    endMarker
  ].join('\n')
  const start = raw.indexOf(startMarker)
  const end = raw.indexOf(endMarker)
  const next =
    start >= 0 && end >= start
      ? `${raw.slice(0, start)}${managed}${raw.slice(end + endMarker.length)}`
      : `${raw.trimEnd()}\n\n${managed}\n`
  try {
    await writeFile(path, next, 'utf8')
    await store.hosts.write(records)
    return records
  } catch {
    throw new Error(`写入 Hosts 文件失败，请检查权限：${path}`)
  }
}

export async function restoreHostsBackup(): Promise<HostRecord[]> {
  await access(backupPath()).catch(() => {
    throw new Error('尚未找到 Hosts 备份文件')
  })
  await copyFile(backupPath(), hostsPath()).catch(() => {
    throw new Error('恢复 Hosts 备份失败，请检查权限')
  })
  const records = parseManaged(await readFile(hostsPath(), 'utf8').catch(() => ''))
  await store.hosts.write(records)
  return records
}

export async function openHostsFile(): Promise<void> {
  const error = await shell.openPath(hostsPath())
  if (error) throw new Error(`无法打开 Hosts 文件：${error}`)
}

export async function openHostDomain(domainInput: string): Promise<void> {
  const domain = requiredText(domainInput, '域名', 253).toLowerCase()
  if (!isValidDomain(domain)) throw new Error('域名格式无效')
  await shell.openExternal(`http://${domain}`)
}

export async function flushDns(): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await execFileAsync('dscacheutil', ['-flushcache'])
      await execFileAsync('killall', ['-HUP', 'mDNSResponder']).catch(() => undefined)
    } else if (process.platform === 'win32') await execFileAsync('ipconfig', ['/flushdns'])
    else await execFileAsync('resolvectl', ['flush-caches'])
  } catch {
    throw new Error('刷新 DNS 失败，请使用管理员权限或手动刷新系统缓存')
  }
}
