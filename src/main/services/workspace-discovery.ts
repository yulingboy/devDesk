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

function shouldInspectDirectory(name: string, customIgnored: Set<string>): boolean {
  return !name.startsWith('.') && !ignoredDirectoryNames.has(name) && !customIgnored.has(name)
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

/**
 * 在一级项目内部按预算递归发现子项目。命中项目标记后停止该分支下钻，
 * 既能发现 apps/web 等常见结构，也避免把项目内部示例目录无限展开。
 */
export async function discoverProjectSubprojectPaths(
  projectPath: string,
  limit = 200,
  maxDepth = 3,
  ignored: string[] = [],
  isCancelled: () => boolean = () => false
): Promise<{ paths: string[]; truncated: boolean }> {
  const customIgnored = new Set(ignored.map((item) => item.trim()).filter(Boolean))
  const paths: string[] = []
  let inspected = 0
  let truncated = false
  let level = [{ path: projectPath, depth: 0 }]
  while (level.length) {
    if (isCancelled()) return { paths, truncated: true }
    const nextLevel: typeof level = []
    for (const parent of level) {
      if (parent.depth >= maxDepth) continue
      const entries = await readdir(parent.path, { withFileTypes: true }).catch(() => [])
      const directories = entries
        .filter((entry) => entry.isDirectory() && shouldInspectDirectory(entry.name, customIgnored))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      for (const entry of directories) {
        if (isCancelled()) return { paths, truncated: true }
        if (inspected >= limit) {
          truncated = true
          break
        }
        inspected += 1
        const path = resolve(parent.path, entry.name)
        if (await hasProjectMarker(path)) paths.push(path)
        else nextLevel.push({ path, depth: parent.depth + 1 })
      }
      if (truncated) break
    }
    if (truncated) break
    level = nextLevel
  }
  return { paths, truncated }
}

/**
 * 工作区根目录下的每个一级目录都是顶级项目。
 * 其下一层仅作为子项目识别，不能再平铺到工作区项目列表中。
 */
export async function discoverWorkspaceProjectPaths(
  rootPath: string,
  limit = 500,
  subprojectLimit = 200,
  scanDepth = 3,
  ignored: string[] = [],
  isCancelled: () => boolean = () => false
): Promise<WorkspaceDiscoveryResult> {
  const entries = await readdir(rootPath, { withFileTypes: true })
  const directDirectories = entries
    .filter((entry) => entry.isDirectory() && shouldInspectDirectory(entry.name, new Set(ignored)))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  const inspectedDirectories = directDirectories.slice(0, limit)
  const projects = await mapWithConcurrency(inspectedDirectories, 16, async (entry) => {
    if (isCancelled()) return { project: undefined, truncated: true }
    const directPath = resolve(rootPath, entry.name)
    const nested = await discoverProjectSubprojectPaths(
      directPath,
      subprojectLimit,
      scanDepth,
      ignored,
      isCancelled
    )
    return {
      project: { path: directPath, subprojectPaths: nested.paths },
      truncated: nested.truncated
    }
  })
  return {
    projects: projects
      .map((item) => item.project)
      .filter((item): item is DiscoveredWorkspaceProject => Boolean(item)),
    total: directDirectories.length,
    subprojectTotal: projects.reduce(
      (total, item) => total + (item.project?.subprojectPaths.length ?? 0),
      0
    ),
    truncated:
      directDirectories.length > inspectedDirectories.length ||
      projects.some((item) => item.truncated)
  }
}
