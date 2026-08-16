import { mkdtemp, readFile, rm } from 'node:fs/promises'
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
})
