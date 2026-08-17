import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Project, Workspace } from '@shared/domain'
import { normalizeWorkspaceProjectHierarchy } from './workspace-hierarchy'

function createProject(workspaceId: string, id: string, path: string): Project {
  return { id, workspaceId, name: path.split('/').at(-1)!, path, source: 'scanned' }
}

describe('工作区项目层级兼容', () => {
  it('将旧版二级平铺记录无损归入一级项目', () => {
    const rootPath = '/tmp/workspaces/personal'
    const workspace: Workspace = {
      id: 'workspace-1',
      name: '个人项目',
      rootPath,
      description: '',
      projects: [
        createProject('workspace-1', 'legacy-demo', join(rootPath, '项目/demo')),
        {
          ...createProject('workspace-1', 'legacy-auth', join(rootPath, '项目/认证中心')),
          remark: '用户认证服务'
        },
        createProject('workspace-1', 'direct-tool', join(rootPath, '工具箱'))
      ]
    }

    const result = normalizeWorkspaceProjectHierarchy(workspace)

    expect(result.changed).toBe(true)
    expect(result.workspace.projects).toHaveLength(2)
    expect(result.workspace.projects.find((item) => item.name === '项目')?.subprojects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'legacy-demo', name: 'demo' }),
        expect.objectContaining({
          id: 'legacy-auth',
          name: '认证中心',
          remark: '用户认证服务'
        })
      ])
    )
    expect(result.workspace.projects.find((item) => item.name === '工具箱')?.id).toBe('direct-tool')
  })

  it('保留已有一级项目和子项目标识并去除旧版重复项', () => {
    const rootPath = '/tmp/workspaces/personal'
    const parent = createProject('workspace-1', 'parent', join(rootPath, 'platform'))
    parent.remark = '核心平台项目'
    parent.subprojects = [{ id: 'stable-api', name: 'api', path: join(rootPath, 'platform/api') }]
    const workspace: Workspace = {
      id: 'workspace-1',
      name: '个人项目',
      rootPath,
      description: '',
      projects: [parent, createProject('workspace-1', 'legacy-api', join(rootPath, 'platform/api'))]
    }

    const result = normalizeWorkspaceProjectHierarchy(workspace)

    expect(result.workspace.projects).toHaveLength(1)
    expect(result.workspace.projects[0].id).toBe('parent')
    expect(result.workspace.projects[0].remark).toBe('核心平台项目')
    expect(result.workspace.projects[0].subprojects).toEqual([
      expect.objectContaining({ id: 'stable-api', path: join(rootPath, 'platform/api') })
    ])
  })

  it('不改变一级项目和外部手动项目', () => {
    const rootPath = '/tmp/workspaces/personal'
    const workspace: Workspace = {
      id: 'workspace-1',
      name: '个人项目',
      rootPath,
      description: '',
      projects: [
        createProject('workspace-1', 'direct', join(rootPath, 'desktop-app')),
        { ...createProject('workspace-1', 'manual', '/tmp/external/service'), source: 'manual' }
      ]
    }

    const result = normalizeWorkspaceProjectHierarchy(workspace)

    expect(result.changed).toBe(false)
    expect(result.workspace).toBe(workspace)
  })
})
