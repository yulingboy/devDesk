import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeState } from '@shared/domain'
import { initializeStore, store } from './store'

const temporaryDirectories: string[] = []

const state = (version: string): NodeState => ({
  currentVersion: version,
  defaultVersion: '',
  nodePath: '',
  nvmAvailable: false,
  nrmAvailable: false,
  registry: 'https://registry.npmjs.org',
  packageManager: 'pnpm',
  packageManagerVersion: '',
  installed: [],
  tasks: [],
  packageManagers: [],
  registries: [],
  globalPackages: [],
  caches: []
})

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('数据存储', () => {
  it('会串行写入同一状态文件并保留有效 JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'env-tool-store-'))
    temporaryDirectories.push(directory)
    await initializeStore({ userData: directory, data: directory, logs: directory })

    await Promise.all(
      Array.from({ length: 24 }, (_, index) => store.node.write(state(String(index))))
    )

    const saved = JSON.parse(
      await readFile(join(directory, 'node-manager.json'), 'utf8')
    ) as NodeState
    expect(saved.currentVersion).toMatch(/^\d+$/)
  })

  it('会隔离损坏的 JSON 并以默认数据继续读取', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'env-tool-store-'))
    temporaryDirectories.push(directory)
    await initializeStore({ userData: directory, data: directory, logs: directory })
    await writeFile(join(directory, 'hosts.json'), '{损坏的数据', 'utf8')

    await expect(store.hosts.read()).resolves.toEqual([])
    await expect(readdir(directory)).resolves.toContainEqual(
      expect.stringMatching(/^hosts\.json\..*\.corrupt$/)
    )
  })

  it('会拒绝不完整备份且不覆盖现有业务数据', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'env-tool-store-'))
    temporaryDirectories.push(directory)
    await initializeStore({ userData: directory, data: directory, logs: directory })
    await store.hosts.write([
      { id: 'host-existing', ip: '127.0.0.1', domain: 'example.test', enabled: true, remark: '' }
    ])

    await expect(store.importData({ schemaVersion: 1, settings: {} } as never)).rejects.toThrow(
      '备份文件结构无效'
    )
    await expect(store.hosts.read()).resolves.toHaveLength(1)
  })

  it('导入不含可选 Node 状态的旧备份时会清除残留状态', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'env-tool-store-'))
    temporaryDirectories.push(directory)
    await initializeStore({ userData: directory, data: directory, logs: directory })
    await store.node.write(state('22.0.0'))
    const backup = await store.exportData()
    backup.nodeState = null

    await store.importData(backup)

    await expect(store.node.read()).resolves.toBeNull()
  })

  it('读取旧设置时会补齐 Node 默认配置', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'env-tool-store-'))
    temporaryDirectories.push(directory)
    await initializeStore({ userData: directory, data: directory, logs: directory })
    await writeFile(
      join(directory, 'settings.json'),
      JSON.stringify({ schemaVersion: 1, general: { launchAtLogin: true }, data: { directory } }),
      'utf8'
    )

    const settings = await store.settings.read()
    expect(settings.general.launchAtLogin).toBe(true)
    expect(settings.node.indexUrl).toBe('https://nodejs.org/dist/index.json')
  })
})
