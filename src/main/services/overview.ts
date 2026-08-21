import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { SystemOverviewHistory, SystemOverviewSnapshot } from '@shared/domain'
import { getAppPaths } from '@main/infrastructure/paths'
import { store, withDataMutation } from '@main/infrastructure/store'

const execFileAsync = promisify(execFile)
let previousCpu = os.cpus()
let sampler: NodeJS.Timeout | undefined

function cpuUsage(): number {
  const current = os.cpus()
  const previousTotal = previousCpu.reduce(
    (sum, cpu) => sum + Object.values(cpu.times).reduce((a, b) => a + b, 0),
    0
  )
  const currentTotal = current.reduce(
    (sum, cpu) => sum + Object.values(cpu.times).reduce((a, b) => a + b, 0),
    0
  )
  const previousIdle = previousCpu.reduce((sum, cpu) => sum + cpu.times.idle, 0)
  const currentIdle = current.reduce((sum, cpu) => sum + cpu.times.idle, 0)
  previousCpu = current
  const total = currentTotal - previousTotal
  return total <= 0
    ? 0
    : Math.min(100, Math.max(0, Math.round((1 - (currentIdle - previousIdle) / total) * 100)))
}

async function readDisks(): Promise<SystemOverviewSnapshot['disks']> {
  if (process.platform === 'win32') return []
  try {
    // 首页只展示当前系统数据卷，避免把虚拟卷和外接卷百分比做无意义平均。
    const { stdout } = await execFileAsync('df', ['-kP', '/'])
    return stdout
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 6 && parts[1] !== '0')
      .slice(0, 1)
      .map((parts) => {
        const total = Number(parts[1]) * 1024
        const free = Number(parts[3]) * 1024
        return {
          name: parts[0],
          mount: parts[5],
          total,
          free,
          usedPercent: Math.min(100, Number.parseInt(parts[4], 10) || 0)
        }
      })
  } catch {
    return []
  }
}

/** 将 macOS vm_stat 页面统计换算为可用内存，压缩内存仍计入已使用部分。 */
export function parseMacMemoryAvailable(output: string, total: number): number | undefined {
  const pageSize = Number(output.match(/page size of\s+(\d+)\s+bytes/i)?.[1])
  if (!pageSize) return undefined
  const values = new Map<string, number>()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s+(\d+)\.?$/)
    if (match) values.set(match[1].trim(), Number(match[2]))
  }
  const pages =
    (values.get('Pages free') ?? 0) +
    (values.get('Pages inactive') ?? 0) +
    (values.get('Pages speculative') ?? 0)
  if (!pages) return undefined
  return Math.min(total, pages * pageSize)
}

async function readMemoryFree(total: number): Promise<number> {
  if (process.platform !== 'darwin') return os.freemem()
  const output = await execFileAsync('vm_stat', [], { timeout: 5_000 })
    .then(({ stdout }) => stdout)
    .catch(() => '')
  return parseMacMemoryAvailable(output, total) ?? os.freemem()
}

export async function sampleSystemOverview(): Promise<SystemOverviewSnapshot> {
  const memoryTotal = os.totalmem()
  const memoryFree = await readMemoryFree(memoryTotal)
  const networks = Object.entries(os.networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses ?? []).map((address) => ({
        name,
        address: address.address,
        family: address.family
      }))
    )
    .filter((item) => item.family === 'IPv4' && item.address !== '127.0.0.1')
    .slice(0, 6)
  const snapshot: SystemOverviewSnapshot = {
    sampledAt: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    platform: process.platform,
    arch: process.arch,
    cpu: {
      model: os.cpus()[0]?.model ?? '未知处理器',
      cores: os.cpus().length,
      usagePercent: cpuUsage()
    },
    memory: {
      total: memoryTotal,
      free: memoryFree,
      usedPercent: Math.round((1 - memoryFree / memoryTotal) * 100)
    },
    disks: await readDisks(),
    networks,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    paths: getAppPaths()
  }
  await withDataMutation(async () => {
    const history = await store.overviewHistory.read()
    await store.overview.write(snapshot)
    await store.overviewHistory.write({
      items: [
        ...history.items.filter((item) => item.sampledAt !== snapshot.sampledAt),
        snapshot
      ].slice(-48)
    })
  })
  return snapshot
}

export async function getOverviewHistory(): Promise<SystemOverviewHistory> {
  const history = await store.overviewHistory.read()
  return { items: history.items.slice(-48) }
}

export function startOverviewSampler(onSnapshot: (snapshot: SystemOverviewSnapshot) => void): void {
  stopOverviewSampler()
  void sampleSystemOverview()
    .then(onSnapshot)
    .catch(() => undefined)
  sampler = setInterval(() => {
    void sampleSystemOverview()
      .then(onSnapshot)
      .catch(() => undefined)
  }, 30_000)
}

export function stopOverviewSampler(): void {
  if (sampler) clearInterval(sampler)
  sampler = undefined
}

export function getAppDisplayName(): string {
  return app.getName()
}
