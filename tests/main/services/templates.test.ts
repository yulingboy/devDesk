import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectTemplate, Workspace } from '@shared/domain'

const data = vi.hoisted(() => ({
  templates: [] as ProjectTemplate[],
  workspaces: [] as Workspace[]
}))

vi.mock('@main/infrastructure/store', () => ({
  withDataMutation: async <T>(operation: () => Promise<T>): Promise<T> => operation(),
  store: {
    templates: {
      read: async (): Promise<ProjectTemplate[]> => data.templates
    },
    workspaces: {
      read: async (): Promise<Workspace[]> => data.workspaces,
      write: async (value: Workspace[]): Promise<void> => {
        data.workspaces = value
      }
    }
  }
}))

vi.mock('@main/infrastructure/shell-environment', () => ({
  getUserShellEnvironment: async (): Promise<NodeJS.ProcessEnv> => ({})
}))

// 本用例关注模板创建后的元数据回填，扫描结果使用当前工作区快照。
vi.mock('@main/services/workspaces', () => ({
  scanWorkspace: async (workspaceId: string): Promise<Workspace[]> => {
    const { readdir } = await import('node:fs/promises')
    data.workspaces = await Promise.all(
      data.workspaces.map(async (workspace) => {
        if (workspace.id !== workspaceId) return workspace
        const entries = await readdir(workspace.rootPath, { withFileTypes: true })
        const knownPaths = new Set(workspace.projects.map((project) => project.path))
        const discovered = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => `${workspace.rootPath}/${entry.name}`)
          .filter((path) => !knownPaths.has(path))
          .map((path) => ({
            id: `project-${path.split('/').at(-1)}`,
            workspaceId,
            name: path.split('/').at(-1) ?? '',
            path,
            source: 'scanned' as const,
            directoryExists: true
          }))
        return { ...workspace, projects: [...workspace.projects, ...discovered] }
      })
    )
    return data.workspaces
  }
}))

import { createProject } from '@main/services/templates'

let temporaryDirectory = ''

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'devdesk-template-'))
  const templatePath = join(temporaryDirectory, 'template')
  const workspacePath = join(temporaryDirectory, 'workspace')
  const parentPath = join(workspacePath, 'platform')
  await mkdir(templatePath, { recursive: true })
  await mkdir(parentPath, { recursive: true })
  await writeFile(join(templatePath, 'README.md'), '# service\n', 'utf8')
  data.templates = [
    {
      id: 'template-local',
      name: '本地模板',
      description: '',
      type: 'local',
      source: templatePath
    }
  ]
  data.workspaces = [
    {
      id: 'workspace-1',
      name: '个人项目',
      rootPath: workspacePath,
      description: '',
      projects: [
        {
          id: 'project-platform',
          workspaceId: 'workspace-1',
          name: 'platform',
          path: parentPath,
          directoryExists: true
        }
      ]
    }
  ]
})

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true })
})

describe('从模板创建项目', () => {
  it('可在一级项目下创建带备注的子项目', async () => {
    const result = await createProject({
      templateId: 'template-local',
      workspaceId: 'workspace-1',
      parentProjectId: 'project-platform',
      projectName: 'api-service',
      remark: 'API 服务'
    })

    const subproject = result[0].projects[0].subprojects?.[0]
    expect(subproject).toMatchObject({
      name: 'api-service',
      source: 'created',
      remark: 'API 服务',
      directoryExists: true
    })
    expect(await readFile(join(subproject!.path, 'README.md'), 'utf8')).toBe('# service\n')
  })

  it('可在一级项目下创建带备注的空目录子项目', async () => {
    const result = await createProject({
      source: 'empty',
      workspaceId: 'workspace-1',
      parentProjectId: 'project-platform',
      projectName: 'empty-service',
      remark: '待初始化的服务'
    })

    const subproject = result[0].projects[0].subprojects?.[0]
    expect(subproject).toMatchObject({
      name: 'empty-service',
      source: 'created',
      remark: '待初始化的服务',
      directoryExists: true
    })
    await expect(readFile(join(subproject!.path, 'README.md'), 'utf8')).rejects.toThrow()
  })

  it('可创建一级空目录且不会覆盖已存在目录', async () => {
    const options = {
      source: 'empty' as const,
      workspaceId: 'workspace-1',
      projectName: 'empty-app'
    }

    await createProject(options)
    expect((await stat(join(temporaryDirectory, 'workspace', 'empty-app'))).isDirectory()).toBe(
      true
    )
    await expect(createProject(options)).rejects.toThrow('目标目录已经存在，无法覆盖')
  })
})
