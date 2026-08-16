import { access, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const ignoredDirectoryNames = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  'bin',
  'obj'
])

const projectMarkers = [
  '.git',
  'package.json',
  'pnpm-workspace.yaml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'pyproject.toml',
  'requirements.txt',
  'Pipfile',
  'setup.py',
  'manage.py',
  'go.mod',
  'Cargo.toml',
  'composer.json',
  'Gemfile',
  'mix.exs',
  'CMakeLists.txt'
]

export interface WorkspaceDiscoveryResult {
  projects: DiscoveredWorkspaceProject[]
  total: number
  subprojectTotal: number
  truncated: boolean
}

export interface DiscoveredWorkspaceProject {
  path: string
  subprojectPaths: string[]
}

function shouldInspectDirectory(name: string): boolean {
  return !name.startsWith('.') && !ignoredDirectoryNames.has(name)
}

async function hasProjectMarker(path: string): Promise<boolean> {
  // 命中一个标记即可结束，避免每个目录同时发起全部 access 请求。
  for (const marker of projectMarkers) {
    if (
      await access(resolve(path, marker))
        .then(() => true)
        .catch(() => false)
    )
      return true
  }
  return false
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const result = new Array<R>(items.length)
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      result[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return result
}

/** 只检查项目目录的下一层，子项目不会继续递归形成无限层级。 */
export async function discoverProjectSubprojectPaths(
  projectPath: string,
  limit = 200
): Promise<{ paths: string[]; truncated: boolean }> {
  const entries = await readdir(projectPath, { withFileTypes: true }).catch(() => [])
  const directories = entries
    .filter((entry) => entry.isDirectory() && shouldInspectDirectory(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  const inspectedDirectories = directories.slice(0, limit)
  const paths = (
    await mapWithConcurrency(inspectedDirectories, 16, async (entry) => {
      const path = resolve(projectPath, entry.name)
      return (await hasProjectMarker(path)) ? path : undefined
    })
  ).filter((path): path is string => Boolean(path))
  return { paths, truncated: directories.length > inspectedDirectories.length }
}

/**
 * 工作区根目录下的每个一级目录都是顶级项目。
 * 其下一层仅作为子项目识别，不能再平铺到工作区项目列表中。
 */
export async function discoverWorkspaceProjectPaths(
  rootPath: string,
  limit = 500,
  subprojectLimit = 200
): Promise<WorkspaceDiscoveryResult> {
  const entries = await readdir(rootPath, { withFileTypes: true })
  const directDirectories = entries
    .filter((entry) => entry.isDirectory() && shouldInspectDirectory(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  const inspectedDirectories = directDirectories.slice(0, limit)
  const projects = await mapWithConcurrency(inspectedDirectories, 16, async (entry) => {
    const directPath = resolve(rootPath, entry.name)
    const nested = await discoverProjectSubprojectPaths(directPath, subprojectLimit)
    return {
      project: { path: directPath, subprojectPaths: nested.paths },
      truncated: nested.truncated
    }
  })
  return {
    projects: projects.map((item) => item.project),
    total: directDirectories.length,
    subprojectTotal: projects.reduce(
      (total, item) => total + item.project.subprojectPaths.length,
      0
    ),
    truncated:
      directDirectories.length > inspectedDirectories.length ||
      projects.some((item) => item.truncated)
  }
}
