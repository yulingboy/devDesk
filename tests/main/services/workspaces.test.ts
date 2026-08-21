import { describe, expect, it } from 'vitest'
import type { Project, Workspace } from '@shared/domain'
import { findWorkspaceProject, mergeWorkspaceScanResults } from '@main/services/workspaces'

function project(id: string, path: string, overrides: Partial<Project> = {}): Project {
  return { id, workspaceId: 'workspace-1', name: id, path, ...overrides }
}

describe('工作区扫描并发合并', () => {
  it('保留扫描期间更新的备注和新建子项目', () => {
    const latest: Workspace = {
      id: 'workspace-1',
      name: '工作区',
      rootPath: '/workspace',
      description: '',
      projects: [
        project('project-latest', '/workspace/app', {
          remark: '扫描期间填写的备注',
          subprojects: [
            {
              id: 'sub-created',
              name: 'api',
              path: '/workspace/app/api',
              source: 'created',
              remark: '新建服务'
            }
          ]
        })
      ]
    }
    const scanned = project('project-old', '/workspace/app', {
      remark: '旧备注',
      branch: 'main',
      subprojects: []
    })

    expect(mergeWorkspaceScanResults(latest, [scanned], [])).toEqual([
      expect.objectContaining({
        id: 'project-latest',
        remark: '扫描期间填写的备注',
        branch: 'main',
        subprojects: [expect.objectContaining({ id: 'sub-created', remark: '新建服务' })]
      })
    ])
  })

  it('保留扫描期间手动纳入的项目', () => {
    const manual = project('manual-new', '/external/tool', { source: 'manual' })
    const latest: Workspace = {
      id: 'workspace-1',
      name: '工作区',
      rootPath: '/workspace',
      description: '',
      projects: [manual]
    }

    expect(mergeWorkspaceScanResults(latest, [], [])).toEqual([manual])
  })
})

describe('工作区项目 ID 解析', () => {
  const workspace: Workspace = {
    id: 'workspace-1',
    name: '工作区',
    rootPath: '/workspace',
    description: '',
    projects: [
      project('project-1', '/workspace/app', {
        subprojects: [{ id: 'sub-1', name: 'api', path: '/workspace/app/api' }]
      })
    ]
  }

  it('支持一级项目和子项目', () => {
    expect(findWorkspaceProject([workspace], 'workspace-1', 'project-1').project.path).toBe(
      '/workspace/app'
    )
    expect(findWorkspaceProject([workspace], 'workspace-1', 'sub-1').project.path).toBe(
      '/workspace/app/api'
    )
  })

  it('拒绝不存在的项目 ID', () => {
    expect(() => findWorkspaceProject([workspace], 'workspace-1', 'missing')).toThrow('项目不存在')
  })
})
