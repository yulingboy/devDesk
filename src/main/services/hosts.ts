import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** macOS 使用系统授权窗口写入 /etc/hosts，避免要求用户以 root 身份启动整个应用。 */
async function writeSystemHosts(path: string, content: string): Promise<void> {
  if (process.platform !== 'darwin') {
    await writeFile(path, content, 'utf8')
    return
  }
  const temporary = join(getStoreDirectory(), `hosts.pending-${process.pid}-${Date.now()}`)
  await mkdir(getStoreDirectory(), { recursive: true })
  await writeFile(temporary, content, 'utf8')
  const command = `/bin/cp ${quoteShellArgument(temporary)} ${quoteShellArgument(path)} && /bin/chmod 644 ${quoteShellArgument(path)}`
  try {
    await execFileAsync('osascript', [
      '-e',
      `do shell script ${JSON.stringify(command)} with administrator privileges`
    ])
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
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

/** 首次接管时读取系统 Hosts 中未被注释的 IPv4 映射，避免已有记录显示为空。 */
function parseSystemRecords(raw: string): HostRecord[] {
  const start = raw.indexOf(startMarker)
  const end = raw.indexOf(endMarker)
  const unmanaged =
    start >= 0 && end >= start ? `${raw.slice(0, start)}${raw.slice(end + endMarker.length)}` : raw
  return unmanaged
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith('#') &&
        !line.startsWith(startMarker) &&
        !line.startsWith(endMarker)
    )
    .map((line) => line.split('#')[0].trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && isValidIpv4(parts[0]) && isValidDomain(parts[1]))
    .map(([ip, domain, ...remarkParts]) => ({
      id: createId('host'),
      ip,
      domain,
      enabled: true,
      remark: remarkParts.join(' ')
    }))
}

export async function listHosts(): Promise<HostRecord[]> {
  const raw = await readFile(hostsPath(), 'utf8').catch(() => '')
  const records = await store.hosts.read()
  return records.length ? records : [...parseManaged(raw), ...parseSystemRecords(raw)]
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
  const baseRaw =
    start < 0 || end < start
      ? raw
          .split('\n')
          .filter((line) => {
            const parts = line.trim().split(/\s+/)
            return !(
              parts.length >= 2 &&
              records.some((record) => record.ip === parts[0] && record.domain === parts[1])
            )
          })
          .join('\n')
      : raw
  const next =
    start >= 0 && end >= start
      ? `${raw.slice(0, start)}${managed}${raw.slice(end + endMarker.length)}`
      : `${baseRaw.trimEnd()}\n\n${managed}\n`
  try {
    await writeSystemHosts(path, next)
    await store.hosts.write(records)
    return records
  } catch {
    throw new Error(`写入 Hosts 文件失败，请确认系统授权或文件权限：${path}`)
  }
}

export async function restoreHostsBackup(): Promise<HostRecord[]> {
  await access(backupPath()).catch(() => {
    throw new Error('尚未找到 Hosts 备份文件')
  })
  const backup = await readFile(backupPath(), 'utf8').catch(() => {
    throw new Error('读取 Hosts 备份失败')
  })
  await writeSystemHosts(hostsPath(), backup).catch(() => {
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
