import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { cp, mkdir, open, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { parentPort, workerData } from 'node:worker_threads'
import { validateArchiveEntries } from '@main/services/node-archive'

const execFileAsync = promisify(execFile)

interface WorkerPayload {
  archivePath: string
  checksumUrl: string
  downloadUrl: string
  extractPath: string
  fileName: string
  installPath: string
  version: string
}

type WorkerEvent =
  | { type: 'progress'; progress: number; message: string }
  | { type: 'log'; message: string }
  | { type: 'completed' }
  | { type: 'failed'; message: string }

const payload = workerData as WorkerPayload
const emit = (event: WorkerEvent): void => parentPort?.postMessage(event)

async function download(): Promise<void> {
  await mkdir(dirname(payload.archivePath), { recursive: true })
  const response = await fetch(payload.downloadUrl, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok || !response.body) throw new Error(`下载安装包失败：HTTP ${response.status}`)
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body.getReader()
  const file = await open(payload.archivePath, 'w')
  let downloaded = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await file.write(value)
      downloaded += value.byteLength
      const percent = total ? Math.round((downloaded / total) * 100) : 0
      emit({
        type: 'progress',
        progress: total ? Math.min(65, 10 + Math.round(percent * 0.55)) : 35,
        message: total
          ? `正在下载 ${percent}%`
          : `正在下载 ${(downloaded / 1024 / 1024).toFixed(1)} MB`
      })
    }
  } finally {
    await file.close()
  }
  emit({ type: 'log', message: `安装包下载完成：${(downloaded / 1024 / 1024).toFixed(1)} MB` })
}

async function verifyChecksum(): Promise<void> {
  emit({ type: 'progress', progress: 70, message: '正在校验 SHA256' })
  const response = await fetch(payload.checksumUrl, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error('获取官方校验文件失败')
  const line = (await response.text())
    .split(/\r?\n/)
    .find((item) => item.trim().endsWith(payload.fileName))
  const expected = line
    ?.trim()
    .match(/^([a-fA-F0-9]{64})\s+/)?.[1]
    ?.toLowerCase()
  if (!expected) throw new Error('官方校验文件中缺少当前安装包')
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(payload.archivePath)) hash.update(chunk)
  if (hash.digest('hex') !== expected) throw new Error('安装包 SHA256 校验失败，已拒绝安装')
  emit({ type: 'log', message: '安装包 SHA256 校验通过' })
}

async function extract(): Promise<string> {
  emit({ type: 'progress', progress: 76, message: '正在解压安装包' })
  await rm(payload.extractPath, { recursive: true, force: true })
  await mkdir(payload.extractPath, { recursive: true })
  if (process.platform === 'win32') {
    const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead(${quote(payload.archivePath)}); try { $zip.Entries | ForEach-Object { $_.FullName } } finally { $zip.Dispose() }`
    ])
    validateArchiveEntries(stdout.split(/\r?\n/))
    await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath ${quote(payload.archivePath)} -DestinationPath ${quote(payload.extractPath)} -Force`
    ])
  } else {
    const [{ stdout: entries }, { stdout: verboseEntries }] = await Promise.all([
      execFileAsync('tar', ['-tzf', payload.archivePath], { timeout: 30_000 }),
      execFileAsync('tar', ['-tvzf', payload.archivePath], { timeout: 30_000 })
    ])
    validateArchiveEntries(entries.split(/\r?\n/))
    if (
      verboseEntries
        .split(/\r?\n/)
        .some((line) => ['l', 'h'].includes(line.trimStart().charAt(0).toLowerCase()))
    ) {
      throw new Error('安装包包含链接条目，已拒绝解压')
    }
    await execFileAsync('tar', ['-xzf', payload.archivePath, '-C', payload.extractPath], {
      timeout: 180_000
    })
  }
  const root = (await readdir(payload.extractPath, { withFileTypes: true })).find((item) =>
    item.isDirectory()
  )
  if (!root) throw new Error('解压结果异常，未找到 Node 目录')
  return join(payload.extractPath, root.name)
}

async function install(source: string): Promise<void> {
  emit({ type: 'progress', progress: 90, message: '正在写入安装目录' })
  await rm(payload.installPath, { recursive: true, force: true })
  await mkdir(dirname(payload.installPath), { recursive: true })
  try {
    await rename(source, payload.installPath)
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EXDEV')) throw error
    await cp(source, payload.installPath, { recursive: true, force: true })
  }
  const executable =
    process.platform === 'win32'
      ? join(payload.installPath, 'node.exe')
      : join(payload.installPath, 'bin', 'node')
  const { stdout } = await execFileAsync(executable, ['--version'], { timeout: 15_000 })
  if (stdout.trim().replace(/^v/, '') !== payload.version)
    throw new Error('安装后的 Node 版本校验失败')
  emit({ type: 'log', message: `Node ${payload.version} 安装结果校验通过` })
}

async function run(): Promise<void> {
  let installed = false
  try {
    emit({ type: 'progress', progress: 10, message: '准备下载安装包' })
    await download()
    await verifyChecksum()
    await install(await extract())
    installed = true
    await rm(payload.extractPath, { recursive: true, force: true })
    await rm(payload.archivePath, { force: true })
    emit({ type: 'completed' })
  } catch (error) {
    // 安装未完成时清除可能残留的半成品目录，后续重试不会误识别为已安装版本。
    if (!installed)
      await rm(payload.installPath, { recursive: true, force: true }).catch(() => undefined)
    await rm(payload.extractPath, { recursive: true, force: true }).catch(() => undefined)
    await rm(payload.archivePath, { force: true }).catch(() => undefined)
    emit({ type: 'failed', message: error instanceof Error ? error.message : '未知安装错误' })
    process.exitCode = 1
  }
}

void run()
