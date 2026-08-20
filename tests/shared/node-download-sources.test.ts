import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NODE_DOWNLOAD_SETTINGS,
  getNodeDownloadSourcePresetId,
  NODE_DOWNLOAD_SOURCE_PRESETS
} from '@shared/node-download-sources'

describe('Node 下载源', () => {
  it('能识别官方源并忽略结尾斜杠', () => {
    expect(
      getNodeDownloadSourcePresetId({
        indexUrl: `${DEFAULT_NODE_DOWNLOAD_SETTINGS.indexUrl}/`,
        downloadSource: `${DEFAULT_NODE_DOWNLOAD_SETTINGS.downloadSource}/`
      })
    ).toBe('official')
  })

  it('只有索引和安装包地址都匹配时才识别为预设', () => {
    expect(
      getNodeDownloadSourcePresetId({
        indexUrl: DEFAULT_NODE_DOWNLOAD_SETTINGS.indexUrl,
        downloadSource: 'https://example.com/node'
      })
    ).toBe('custom')
  })

  it('提供 npmmirror 镜像预设', () => {
    const mirror = NODE_DOWNLOAD_SOURCE_PRESETS.find((item) => item.id === 'npmmirror')
    expect(mirror?.settings.indexUrl).toContain('/mirrors/node/index.json')
    expect(mirror?.settings.downloadSource).toContain('/mirrors/node')
  })
})
