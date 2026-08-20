import type { NodeDownloadSettings } from './domain'

export type NodeDownloadSourcePresetId = 'official' | 'npmmirror' | 'custom'

export interface NodeDownloadSourcePreset {
  id: Exclude<NodeDownloadSourcePresetId, 'custom'>
  name: string
  description: string
  settings: Pick<NodeDownloadSettings, 'indexUrl' | 'downloadSource'>
}

export const DEFAULT_NODE_DOWNLOAD_SETTINGS = {
  indexUrl: 'https://nodejs.org/dist/index.json',
  downloadSource: 'https://nodejs.org/dist'
} as const

/** 只提供稳定且目录结构与 Node 官方发行源兼容的预设，其他地址允许用户自行填写。 */
export const NODE_DOWNLOAD_SOURCE_PRESETS: NodeDownloadSourcePreset[] = [
  {
    id: 'official',
    name: 'Node.js 官方源',
    description: '直接从 nodejs.org 获取版本索引和安装包。',
    settings: DEFAULT_NODE_DOWNLOAD_SETTINGS
  },
  {
    id: 'npmmirror',
    name: 'npmmirror 镜像',
    description: '使用 npmmirror 提供的 Node.js 二进制镜像。',
    settings: {
      indexUrl: 'https://npmmirror.com/mirrors/node/index.json',
      downloadSource: 'https://npmmirror.com/mirrors/node'
    }
  }
]

const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '')

/** 根据两个地址共同判断预设，防止只修改其中一项时仍错误展示为官方源。 */
export function getNodeDownloadSourcePresetId(
  settings: Pick<NodeDownloadSettings, 'indexUrl' | 'downloadSource'>
): NodeDownloadSourcePresetId {
  return (
    NODE_DOWNLOAD_SOURCE_PRESETS.find(
      (preset) =>
        normalizeUrl(preset.settings.indexUrl) === normalizeUrl(settings.indexUrl) &&
        normalizeUrl(preset.settings.downloadSource) === normalizeUrl(settings.downloadSource)
    )?.id ?? 'custom'
  )
}
