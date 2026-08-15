import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { SystemOverviewSnapshot } from '@shared/domain'
import { getAppPaths } from '@main/infrastructure/paths'
import { store } from '@main/infrastructure/store'

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
    const { stdout } = await execFileAsync('df', ['-kP'])
    return stdout
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 6 && parts[1] !== '0')
      .slice(0, 4)
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

export async function sampleSystemOverview(): Promise<SystemOverviewSnapshot> {
  const memoryTotal = os.totalmem()
  const memoryFree = os.freemem()
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
  await store.overview.write(snapshot)
  return snapshot
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
