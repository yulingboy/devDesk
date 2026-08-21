import { describe, expect, it } from 'vitest'
import type { NodeState } from '@shared/domain'
import { mergeDetectedNodeState } from '@main/services/node-state'

function state(version: string): NodeState {
  return {
    currentVersion: version,
    defaultVersion: version,
    nodePath: `/node/${version}`,
    nvmAvailable: true,
    nrmAvailable: true,
    registry: 'https://registry.npmjs.org',
    packageManager: 'pnpm',
    packageManagerVersion: '10.0.0',
    installed: [],
    tasks: [],
    packageManagers: [],
    registries: [],
    globalPackages: [],
    caches: []
  }
}

describe('Node 环境探测状态合并', () => {
  it('更新环境字段但保留并发写入的任务、包和缓存', () => {
    const latest = state('20.0.0')
    latest.tasks = [
      {
        id: 'task-1',
        version: '22.0.0',
        status: 'downloading',
        progress: 50,
        message: '下载中',
        startedAt: '2026-01-01T00:00:00.000Z',
        logs: []
      }
    ]
    latest.globalPackages = [{ name: 'pnpm', current: '10.0.0' }]
    latest.caches = [{ id: 'npm', name: 'npm 缓存', path: '/cache', sizeBytes: 10, exists: true }]

    const result = mergeDetectedNodeState(latest, state('22.0.0'))

    expect(result.currentVersion).toBe('22.0.0')
    expect(result.tasks).toBe(latest.tasks)
    expect(result.globalPackages).toBe(latest.globalPackages)
    expect(result.caches).toBe(latest.caches)
  })
})
