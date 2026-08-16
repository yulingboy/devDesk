import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import type { Project, Workspace, WorkspaceSubproject } from '@shared/domain'
import { createId } from './common'

/** 返回项目在工作区中的一级目录；外部项目保持自身路径。 */
export function getTopLevelProjectPath(rootPath: string, projectPath: string): string {
  const normalizedProjectPath = resolve(projectPath)
  const relativePath = relative(resolve(rootPath), normalizedProjectPath)
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return normalizedProjectPath
  }
  return resolve(rootPath, relativePath.split(sep)[0])
}

function toSubproject(project: Project): WorkspaceSubproject {
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    directoryExists: project.directoryExists,
    lastScannedAt: project.lastScannedAt
  }
}

/**
 * 将旧版平铺的二级项目归并到一级目录下。
 * 该迁移只调整应用内目录索引，不读写或移动用户的源代码目录。
 */
export function normalizeWorkspaceProjectHierarchy(workspace: Workspace): {
  workspace: Workspace
  changed: boolean
} {
  const groups = new Map<string, Project[]>()
  for (const project of workspace.projects) {
    const topLevelPath = getTopLevelProjectPath(workspace.rootPath, project.path)
    const group = groups.get(topLevelPath) ?? []
    group.push(project)
    groups.set(topLevelPath, group)
  }

  let changed = false
  const projects = [...groups.entries()].map(([topLevelPath, group]) => {
    const directProject = group.find((project) => resolve(project.path) === topLevelPath)
    const legacySubprojects = group.filter((project) => resolve(project.path) !== topLevelPath)
    if (!legacySubprojects.length) return directProject ?? group[0]

    changed = true
    const subprojects = new Map<string, WorkspaceSubproject>()
    for (const subproject of directProject?.subprojects ?? []) {
      subprojects.set(resolve(subproject.path), subproject)
    }
    for (const project of legacySubprojects) {
      const path = resolve(project.path)
      if (!subprojects.has(path)) subprojects.set(path, toSubproject(project))
    }
    const normalizedSubprojects = [...subprojects.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'zh-CN')
    )

    if (directProject) return { ...directProject, subprojects: normalizedSubprojects }
    return {
      id: createId('project'),
      workspaceId: workspace.id,
      name: basename(topLevelPath),
      path: topLevelPath,
      source: 'scanned' as const,
      directoryExists: legacySubprojects.some((project) => project.directoryExists !== false),
      lastScannedAt: legacySubprojects[0]?.lastScannedAt,
      subprojects: normalizedSubprojects
    }
  })

  return { workspace: changed ? { ...workspace, projects } : workspace, changed }
}
