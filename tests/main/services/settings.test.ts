import { afterEach, describe, expect, it, vi } from 'vitest'
import { testNodeDownloadSource, validateNodeSettings } from '@main/services/settings'

const settings = {
  indexUrl: 'https://nodejs.org/dist/index.json',
  downloadSource: 'https://nodejs.org/dist',
  packageManager: 'pnpm',
  registry: 'https://registry.npmjs.org'
}

describe('Node 下载源安全策略', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('拒绝通过公网 HTTP 下载可执行安装包', () => {
    expect(() =>
      validateNodeSettings({
        ...settings,
        indexUrl: 'http://mirror.example.com/index.json',
        downloadSource: 'http://mirror.example.com/dist'
      })
    ).toThrow('必须使用 HTTPS')
  })

  it('允许本机 HTTP 镜像用于开发和离线代理', () => {
    expect(
      validateNodeSettings({
        ...settings,
        indexUrl: 'http://127.0.0.1:8080/index.json',
        downloadSource: 'http://localhost:8080/dist'
      })
    ).toMatchObject({
      indexUrl: 'http://127.0.0.1:8080/index.json',
      downloadSource: 'http://localhost:8080/dist'
    })
  })

  it('镜像不支持 HEAD 时使用 Range GET 探测文件', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ version: 'v22.1.0' }]), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response('x', { status: 206 }))
      .mockResolvedValueOnce(new Response('x', { status: 206 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(testNodeDownloadSource(settings)).resolves.toMatchObject({
      indexReachable: true,
      packageReachable: true,
      checksumReachable: true,
      version: 'v22.1.0'
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('node-v22.1.0-'),
      expect.objectContaining({ headers: { Range: 'bytes=0-0' } })
    )
  })
})
