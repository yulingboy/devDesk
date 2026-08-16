/** 主题名称与参考项目保持一致，主题只改变强调色并维持浅色工作区。 */
export type ThemeName = 'blue' | 'purple' | 'green' | 'orange' | 'rose' | 'cyan' | 'indigo' | 'teal'
export type TemplateType = 'git' | 'local'
export type TaskStatus =
  'waiting' | 'downloading' | 'extracting' | 'completed' | 'skipped' | 'failed' | 'cancelled'

export interface HostRecord {
  id: string
  ip: string
  domain: string
  enabled: boolean
  remark: string
}

export interface SSHKey {
  id: string
  name: string
  algorithm: string
  source: 'discovered' | 'manual' | 'generated'
  publicKey: string
  fingerprint: string
  privateKeyPath?: string
  privateKeyExists?: boolean
}

/** 删除密钥前展示真实关联，避免用户只看到静态风险提示。 */
export interface SSHDeleteImpact {
  key: Pick<SSHKey, 'id' | 'name' | 'fingerprint'>
  identities: Array<Pick<GitIdentity, 'id' | 'name' | 'username' | 'email'>>
}

export interface GitIdentity {
  id: string
  name: string
  username: string
  email: string
  sshKeyId?: string
}

export interface GitState {
  global: { username: string; email: string; sourceFile: string }
  identities: GitIdentity[]
  profileDirectory: string
}

export interface GitFileSnapshot {
  name: string
  path: string
  content: string
  exists: boolean
}

/** Git 身份详情由已有持久化数据实时推导，不新增磁盘字段。 */
export interface GitIdentityDetail {
  identity: GitIdentity
  sshKey?: Pick<SSHKey, 'id' | 'name' | 'fingerprint' | 'privateKeyExists'>
  workspaces: Array<Pick<Workspace, 'id' | 'name' | 'rootPath'>>
  profilePath: string
  files: GitFileSnapshot[]
}

export interface Workspace {
  id: string
  name: string
  rootPath: string
  description: string
  gitIdentityId?: string
  projects: Project[]
}

/** 一级项目下识别出的独立工程，仅用于表达目录层级，不承载运行时状态。 */
export interface WorkspaceSubproject {
  id: string
  name: string
  path: string
  directoryExists?: boolean
  lastScannedAt?: string
}

export const PROJECT_EDITOR_OPTIONS = [
  { id: 'codex', label: 'Codex' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'zed', label: 'Zed' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'intellij-idea', label: 'IntelliJ IDEA' },
  { id: 'pycharm', label: 'PyCharm' },
  { id: 'goland', label: 'GoLand' }
] as const

export type ProjectEditorId = (typeof PROJECT_EDITOR_OPTIONS)[number]['id']

export interface Project {
  id: string
  workspaceId: string
  name: string
  path: string
  /** 扫描发现的项目与用户手动纳入的外部项目采用不同刷新策略。 */
  source?: 'scanned' | 'manual'
  branch?: string
  dirty?: boolean
  gitError?: string
  /** Git 状态读取结果，区分非仓库、无远程和实际读取失败。 */
  gitStatus?: 'ready' | 'not-repository' | 'git-missing' | 'no-remote' | 'no-upstream' | 'error'
  /** 以下字段均从项目目录派生，旧项目记录缺失时会在下次扫描补齐。 */
  packageName?: string
  packageVersion?: string
  packageManager?: ProjectPackageManager
  nodeRequirement?: string
  hasPackageJson?: boolean
  dependencyState?: 'ready' | 'missing' | 'not-applicable'
  remote?: string
  scriptCount?: number
  lastScannedAt?: string
  /** 手动纳入的项目目录被移动或删除后，仍保留记录供用户明确移除。 */
  directoryExists?: boolean
  /** 工作区列表只展示一级项目，下一层识别出的工程收纳在这里。 */
  subprojects?: WorkspaceSubproject[]
  /** 用户维护的项目说明，扫描目录时必须原样保留。 */
  remark?: string
  /** 用户行为字段独立于扫描结果，后续扫描不得覆盖。 */
  favorite?: boolean
  archived?: boolean
  lastOpenedAt?: string
  /** 以下字段用于项目列表快速判断，详情页会重新读取磁盘状态。 */
  lockfileType?: ProjectPackageManager
  lockfileState?: 'ready' | 'missing' | 'mismatch'
  gitAhead?: number
  gitBehind?: number
  gitChangedFiles?: number
  lastCommit?: string
}

export type ProjectPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export interface ProjectScript {
  name: string
  command: string
}

export type ProjectIssueType =
  'directory' | 'node' | 'package-manager' | 'dependency' | 'lockfile' | 'git'

/** 环境异常统一转换为可执行问题，页面不再重复拼装判断规则。 */
export interface ProjectIssue {
  id: string
  type: ProjectIssueType
  severity: 'error' | 'warning' | 'info'
  title: string
  description: string
  action?: 'refresh' | 'install-dependencies' | 'open-node' | 'open-git'
}

export type ProjectTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/** 项目脚本由主进程持有，渲染层只能启动已在 package.json 中声明的脚本。 */
export interface ProjectTask {
  id: string
  workspaceId: string
  projectId: string
  projectName: string
  script: string
  command: string
  status: ProjectTaskStatus
  pid?: number
  startedAt: string
  finishedAt?: string
  exitCode?: number
  logs: string[]
  error?: string
}

/** 项目详情只反映磁盘上实时状态，不额外保存敏感命令或依赖内容。 */
export interface ProjectDetail {
  project: Project
  scripts: ProjectScript[]
  issues: ProjectIssue[]
  tasks: ProjectTask[]
  workspace: {
    id: string
    name: string
    rootPath: string
    gitIdentity?: Pick<GitIdentity, 'id' | 'name' | 'username' | 'email'>
  }
  environment: {
    directoryExists: boolean
    currentNodeVersion: string
    nodeSource: 'process' | 'nvmrc' | 'node-version' | 'volta' | 'engines' | 'unknown'
    nodeRequirement?: string
    nodeRequirementSource?: '.nvmrc' | '.node-version' | 'volta' | 'engines.node'
    nodeCompatible: boolean | null
    packageManager?: ProjectPackageManager
    packageManagerAvailable: boolean
    dependencyState: NonNullable<Project['dependencyState']>
    lockfileType?: ProjectPackageManager
    lockfileState: 'ready' | 'missing' | 'mismatch'
  }
  git: {
    branch?: string
    remote?: string
    status?: Project['gitStatus']
    dirty: boolean
    changedFiles: number
    ahead: number
    behind: number
    lastCommit?: string
    error?: string
  }
}

/** 扫描结果额外描述目录变化，旧的 scan 接口仍继续返回 Workspace[]。 */
export interface WorkspaceScanResult {
  workspaces: Workspace[]
  added: number
  removed: number
  total: number
  truncated: boolean
  gitErrorCount: number
}

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  type: TemplateType
  source: string
}

export interface NodeInstall {
  version: string
  path: string
  isCurrent: boolean
  isDefault: boolean
}

export interface NodeTask {
  id: string
  version: string
  status: TaskStatus
  progress: number
  message: string
  startedAt: string
  finishedAt?: string
  logs: string[]
}

export interface NodeState {
  currentVersion: string
  defaultVersion: string
  nodePath: string
  nvmAvailable: boolean
  nrmAvailable: boolean
  registry: string
  packageManager: string
  packageManagerVersion: string
  installed: NodeInstall[]
  tasks: NodeTask[]
  packageManagers: NodePackageManagerStatus[]
  registries: NodeRegistry[]
  globalPackages: GlobalPackage[]
  caches: NodeCacheSnapshot[]
  /** 按当前系统、nvm 实现和可用命令计算，页面不得自行猜测操作是否可用。 */
  capabilities?: NodeRuntimeCapabilities
}

export interface NodeRuntimeCapabilities {
  canInstall: boolean
  canSwitch: boolean
  canSetDefault: boolean
  canUseInTerminal: boolean
  message?: string
}

export interface NodePackageManagerStatus {
  name: 'npm' | 'pnpm' | 'yarn' | 'bun'
  available: boolean
  version: string
  registry: string
  isDefault: boolean
}

export interface NodeRegistry {
  id: string
  name: string
  url: string
  latencyMs?: number
  isCurrent: boolean
}

export interface GlobalPackage {
  name: string
  current: string
  wanted?: string
  latest?: string
}

export interface NodeCacheSnapshot {
  /** 稳定标识用于按缓存类型执行清理，旧数据没有该字段时由读取端派生。 */
  id?: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'nvm'
  name: string
  path: string
  sizeBytes: number
  exists: boolean
  /** nvm 版本目录用于展示占用，绝不能作为包管理缓存自动删除。 */
  clearable?: boolean
}

export interface NodeEnvironmentPath {
  name: string
  path: string
  exists: boolean
}

export interface EnvironmentCheck {
  id: string
  name: string
  command: string
  status: 'passed' | 'failed' | 'cancelled' | 'skipped'
  version?: string
  detail: string
}

/** 环境检测页使用的工具能力清单，安装能力必须由主进程白名单控制。 */
export interface EnvironmentTool extends Pick<EnvironmentCheck, 'id' | 'name' | 'command'> {
  installable: boolean
  guideUrl?: string
}

export interface DataStats {
  directory: string
  sizeBytes: number
  fileCount: number
  gitIdentityCount: number
  workspaceCount: number
  sshKeyCount: number
}

export interface AppSettings {
  schemaVersion: 1
  general: {
    theme: ThemeName
    launchAtLogin: boolean
    minimizeToTray: boolean
  }
  data: { directory: string }
  advanced: { logLevel: 'debug' | 'info' | 'warn' | 'error'; developerTools: boolean }
  node: { indexUrl: string; downloadSource: string; packageManager: string; registry: string }
}

export interface SystemOverviewSnapshot {
  sampledAt: string
  hostname: string
  username: string
  platform: NodeJS.Platform
  arch: string
  cpu: { model: string; cores: number; usagePercent: number }
  memory: { total: number; free: number; usedPercent: number }
  disks: Array<{ name: string; mount: string; total: number; free: number; usedPercent: number }>
  networks: Array<{ name: string; address: string; family: string }>
  nodeVersion: string
  electronVersion: string
  paths: { userData: string; data: string; logs: string }
}

export interface NodeRelease {
  version: string
  date?: string
  lts?: string | false
  npm?: string
  security?: boolean
  files?: string[]
  /** 由主进程按当前操作系统和 CPU 架构计算，避免用户发起必定失败的安装。 */
  platformSupported?: boolean
}

/** 官网索引的短期缓存，仅用于离线回退和避免筛选时重复网络请求。 */
export interface NodeReleaseCache {
  fetchedAt: string
  items: NodeRelease[]
}

export interface DataExport {
  schemaVersion: 1
  exportedAt: string
  settings: AppSettings
  hosts: HostRecord[]
  sshKeys: SSHKey[]
  gitIdentities: GitIdentity[]
  workspaces: Workspace[]
  templates: ProjectTemplate[]
  nodeState?: NodeState | null
  nodeReleases?: NodeReleaseCache | null
  overview?: SystemOverviewSnapshot | null
  hostsBackup?: string
}

export interface SSHKeyDraft {
  id?: string
  name: string
  publicKey: string
  privateKeyPath?: string
  algorithm?: string
  source?: SSHKey['source']
}

export interface SSHKeyGenerateOptions {
  name: string
  algorithm: 'ed25519' | 'rsa'
  comment?: string
  passphrase?: string
}

export interface ProjectCreateOptions {
  templateId: string
  workspaceId: string
  projectName: string
}

export interface NodeInstallOptions {
  version: string
}

export interface NodeRegistryDraft {
  id?: string
  name: string
  url: string
}
