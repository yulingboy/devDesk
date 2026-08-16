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
  paths: string[]
  total: number
  truncated: boolean
}

function shouldInspectDirectory(name: string): boolean {
  return !name.startsWith('.') && !ignoredDirectoryNames.has(name)
}

async function hasProjectMarker(path: string): Promise<boolean> {
  const checks = await Promise.all(
    projectMarkers.map((marker) =>
      access(resolve(path, marker))
        .then(() => true)
        .catch(() => false)
    )
  )
  return checks.some(Boolean)
}

/**
 * 工作区允许“项目目录”与“项目分组目录”并存。
 * 为避免误入依赖和构建产物，只向下检查一层子目录，并以跨语言标志文件识别子项目。
 */
export async function discoverWorkspaceProjectPaths(
  rootPath: string,
  limit = 500
): Promise<WorkspaceDiscoveryResult> {
  const entries = await readdir(rootPath, { withFileTypes: true })
  const directDirectories = entries
    .filter((entry) => entry.isDirectory() && shouldInspectDirectory(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  const inspectedDirectories = directDirectories.slice(0, limit)
  const groups = await Promise.all(
    inspectedDirectories.map(async (entry) => {
      const directPath = resolve(rootPath, entry.name)
      const [directIsProject, nestedEntries] = await Promise.all([
        hasProjectMarker(directPath),
        readdir(directPath, { withFileTypes: true }).catch(() => [])
      ])
      const nestedDirectories = nestedEntries
        .filter((nested) => nested.isDirectory() && shouldInspectDirectory(nested.name))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      const nestedProjects = (
        await Promise.all(
          nestedDirectories.map(async (nested) => {
            const nestedPath = resolve(directPath, nested.name)
            return (await hasProjectMarker(nestedPath)) ? nestedPath : undefined
          })
        )
      ).filter((path): path is string => Boolean(path))

      // 没有可识别子项目时仍保留一级目录，兼容没有标准标志文件的本地项目。
      return directIsProject || !nestedProjects.length
        ? [directPath, ...nestedProjects]
        : nestedProjects
    })
  )
  const paths = [...new Set(groups.flat())]
  return {
    paths: paths.slice(0, limit),
    total: paths.length,
    truncated: directDirectories.length > inspectedDirectories.length || paths.length > limit
  }
}
