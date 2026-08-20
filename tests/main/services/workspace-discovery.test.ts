import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverWorkspaceProjectPaths } from '@main/services/workspace-discovery'

const temporaryDirectories: string[] = []

async function createWorkspace(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'devdesk-workspace-'))
  temporaryDirectories.push(path)
  return path
}

async function createProject(root: string, relativePath: string, marker?: string): Promise<string> {
  const path = join(root, relativePath)
  await mkdir(path, { recursive: true })
  if (marker) await writeFile(join(path, marker), '', 'utf8')
  return path
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })))
})

describe('工作区项目发现', () => {
  it('保留没有标准标志文件的一级项目目录', async () => {
    const root = await createWorkspace()
    const project = await createProject(root, 'notes-tool')

    const result = await discoverWorkspaceProjectPaths(root)

    expect(result.projects).toEqual([{ path: project, subprojectPaths: [] }])
    expect(result).toMatchObject({ total: 1, subprojectTotal: 0, truncated: false })
  })

  it('从一级分组目录中发现 Java、Python、Go 和 Node 子项目', async () => {
    const root = await createWorkspace()
    const java = await createProject(root, 'backend/java-service', 'pom.xml')
    const python = await createProject(root, 'backend/python-service', 'pyproject.toml')
    const go = await createProject(root, 'backend/go-service', 'go.mod')
    const node = await createProject(root, 'frontend/web-app', 'package.json')

    const result = await discoverWorkspaceProjectPaths(root)

    expect(result.projects).toEqual([
      {
        path: join(root, 'backend'),
        subprojectPaths: [go, java, python]
      },
      {
        path: join(root, 'frontend'),
        subprojectPaths: [node]
      }
    ])
    expect(result.total).toBe(2)
    expect(result.subprojectTotal).toBe(4)
  })

  it('父目录和子目录都是项目时只平铺父目录', async () => {
    const root = await createWorkspace()
    const parent = await createProject(root, 'platform', 'settings.gradle.kts')
    const child = await createProject(root, 'platform/api', 'go.mod')

    const result = await discoverWorkspaceProjectPaths(root)

    expect(result.projects).toEqual([{ path: parent, subprojectPaths: [child] }])
    expect(result.total).toBe(1)
    expect(result.subprojectTotal).toBe(1)
  })

  it('可以递归发现多层子项目并在命中项目后停止下钻', async () => {
    const root = await createWorkspace()
    const api = await createProject(root, 'platform/services/backend/api', 'go.mod')
    await createProject(root, 'platform/services/backend/api/examples/demo', 'package.json')

    const result = await discoverWorkspaceProjectPaths(root, 500, 200, 4)

    expect(result.projects).toEqual([{ path: join(root, 'platform'), subprojectPaths: [api] }])
  })

  it('支持工作区自定义忽略目录', async () => {
    const root = await createWorkspace()
    await createProject(root, 'platform/archive/legacy', 'pom.xml')
    const active = await createProject(root, 'platform/services/active', 'go.mod')

    const result = await discoverWorkspaceProjectPaths(root, 500, 200, 4, ['archive'])

    expect(result.projects[0]?.subprojectPaths).toEqual([active])
  })

  it('忽略依赖、构建产物和隐藏目录', async () => {
    const root = await createWorkspace()
    const project = await createProject(root, 'application', 'Cargo.toml')
    await createProject(root, 'application/node_modules/package-a', 'package.json')
    await createProject(root, 'application/build/generated', 'pom.xml')
    await createProject(root, 'application/target/debug', 'Cargo.toml')
    await createProject(root, '.hidden/service', 'go.mod')

    const result = await discoverWorkspaceProjectPaths(root)

    expect(result.projects).toEqual([{ path: project, subprojectPaths: [] }])
  })

  it('达到上限时截断结果并返回提示', async () => {
    const root = await createWorkspace()
    await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createProject(root, `project-${index}`, 'requirements.txt')
      )
    )

    const result = await discoverWorkspaceProjectPaths(root, 3)

    expect(result.projects).toHaveLength(3)
    expect(result.total).toBe(4)
    expect(result.truncated).toBe(true)
  })

  it('子项目按名称稳定排序且达到单项目上限时标记截断', async () => {
    const root = await createWorkspace()
    const second = await createProject(root, 'platform/service-b', 'go.mod')
    const first = await createProject(root, 'platform/service-a', 'pom.xml')
    await createProject(root, 'platform/service-c', 'pyproject.toml')

    const result = await discoverWorkspaceProjectPaths(root, 500, 2)

    expect(result.projects).toEqual([
      { path: join(root, 'platform'), subprojectPaths: [first, second] }
    ])
    expect(result.subprojectTotal).toBe(2)
    expect(result.truncated).toBe(true)
  })
})
