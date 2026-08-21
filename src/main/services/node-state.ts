import type { NodeState } from '@shared/domain'

/** 只合并环境探测字段，保留探测期间由其他操作更新的任务、缓存和全局包。 */
export function mergeDetectedNodeState(latest: NodeState, detected: NodeState): NodeState {
  return {
    ...latest,
    currentVersion: detected.currentVersion,
    activeVersion: detected.activeVersion,
    defaultVersion: detected.defaultVersion,
    nodePath: detected.nodePath,
    nvmAvailable: detected.nvmAvailable,
    nrmAvailable: detected.nrmAvailable,
    registry: detected.registry,
    packageManager: detected.packageManager,
    packageManagerVersion: detected.packageManagerVersion,
    packageManagers: detected.packageManagers,
    registries: detected.registries,
    installed: detected.installed,
    capabilities: detected.capabilities
  }
}
