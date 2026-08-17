import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectTemplate, Workspace } from '@shared/domain'

const data = vi.hoisted(() => ({
  templates: [] as ProjectTemplate[],
  workspaces: [] as Workspace[]
}))

vi.mock('@main/infrastructure/store', () => ({
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
vi.mock('./workspaces', () => ({
  scanWorkspace: async (): Promise<Workspace[]> => data.workspaces
}))

import { createProject } from './templates'

let temporaryDirectory = ''

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'env-tool-template-'))
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
})
