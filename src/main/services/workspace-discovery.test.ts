import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverWorkspaceProjectPaths } from './workspace-discovery'

const temporaryDirectories: string[] = []

async function createWorkspace(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'env-tool-workspace-'))
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

    expect(result.paths).toEqual([project])
    expect(result).toMatchObject({ total: 1, truncated: false })
  })

  it('从一级分组目录中发现 Java、Python、Go 和 Node 子项目', async () => {
    const root = await createWorkspace()
    const java = await createProject(root, 'backend/java-service', 'pom.xml')
    const python = await createProject(root, 'backend/python-service', 'pyproject.toml')
    const go = await createProject(root, 'backend/go-service', 'go.mod')
    const node = await createProject(root, 'frontend/web-app', 'package.json')

    const result = await discoverWorkspaceProjectPaths(root)

    expect(result.paths).toEqual(expect.arrayContaining([java, python, go, node]))
    expect(result.paths).not.toContain(join(root, 'backend'))
    expect(result.paths).not.toContain(join(root, 'frontend'))
    expect(result.total).toBe(4)
  })

  it('父目录和子目录都是项目时保留两者', async () => {
    const root = await createWorkspace()
    const parent = await createProject(root, 'platform', 'settings.gradle.kts')
    const child = await createProject(root, 'platform/api', 'go.mod')

    const result = await discoverWorkspaceProjectPaths(root)

    expect(result.paths).toEqual(expect.arrayContaining([parent, child]))
    expect(result.total).toBe(2)
  })

  it('忽略依赖、构建产物和隐藏目录', async () => {
    const root = await createWorkspace()
    const project = await createProject(root, 'application', 'Cargo.toml')
    await createProject(root, 'application/node_modules/package-a', 'package.json')
    await createProject(root, 'application/build/generated', 'pom.xml')
    await createProject(root, 'application/target/debug', 'Cargo.toml')
    await createProject(root, '.hidden/service', 'go.mod')

    const result = await discoverWorkspaceProjectPaths(root)

    expect(result.paths).toEqual([project])
  })

  it('达到上限时截断结果并返回提示', async () => {
    const root = await createWorkspace()
    await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createProject(root, `project-${index}`, 'requirements.txt')
      )
    )

    const result = await discoverWorkspaceProjectPaths(root, 3)

    expect(result.paths).toHaveLength(3)
    expect(result.truncated).toBe(true)
  })
})
