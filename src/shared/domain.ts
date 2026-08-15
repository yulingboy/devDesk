/** 主题名称与参考项目保持一致，主题只改变强调色并维持浅色工作区。 */
export type ThemeName = 'blue' | 'purple' | 'green' | 'orange' | 'rose' | 'cyan' | 'indigo' | 'teal'
export type TemplateType = 'git' | 'local'
export type TaskStatus =
  'waiting' | 'downloading' | 'extracting' | 'completed' | 'skipped' | 'failed'

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

export interface Workspace {
  id: string
  name: string
  rootPath: string
  description: string
  gitIdentityId?: string
  projects: Project[]
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  path: string
  branch?: string
  dirty?: boolean
  gitError?: string
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
  name: string
  path: string
  sizeBytes: number
  exists: boolean
}

export interface EnvironmentCheck {
  id: string
  name: string
  command: string
  status: 'passed' | 'failed' | 'skipped'
  version?: string
  detail: string
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
  security?: boolean
  files?: string[]
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
