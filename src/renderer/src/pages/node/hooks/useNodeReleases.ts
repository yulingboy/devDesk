import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NodeRelease } from '@shared/domain'

type ReleaseChannel = 'all' | 'lts' | 'current'

const pageSize = 25

/** 管理 Node 官方版本索引的加载、筛选与分页，页面只负责渲染和安装操作。 */
export function useNodeReleases(report: (error: unknown) => void): {
  keyword: string
  setKeyword: (value: string) => void
  channel: ReleaseChannel
  setChannel: (value: ReleaseChannel) => void
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  pageCount: number
  total: number
  visibleReleases: NodeRelease[]
  loading: boolean
  refresh: () => void
} {
  const [releases, setReleases] = useState<NodeRelease[]>([])
  const [keyword, setKeyword] = useState('')
  const [channel, setChannel] = useState<ReleaseChannel>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const initialRequestStarted = useRef(false)
  const requestId = useRef(0)

  const load = useCallback(
    (refresh = false): void => {
      const currentRequestId = ++requestId.current
      setLoading(true)
      void window.api?.node
        .releases({ channel: 'all', refresh })
        .then((value) => {
          if (currentRequestId !== requestId.current) return
          setReleases(value)
          if (refresh) setPage(1)
        })
        .catch((error: unknown) => {
          if (currentRequestId === requestId.current) report(error)
        })
        .finally(() => {
          if (currentRequestId === requestId.current) setLoading(false)
        })
    },
    [report]
  )

  useEffect(() => {
    if (initialRequestStarted.current) return
    initialRequestStarted.current = true
    load()
  }, [load])

  const filteredReleases = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return releases.filter((release) => {
      const matchesChannel =
        channel === 'all' || (channel === 'lts' ? Boolean(release.lts) : release.lts === false)
      const matchesKeyword =
        !normalized ||
        release.version.toLowerCase().includes(normalized) ||
        release.lts?.toString().toLowerCase().includes(normalized) ||
        release.npm?.toLowerCase().includes(normalized)
      return matchesChannel && matchesKeyword
    })
  }, [channel, keyword, releases])

  const pageCount = Math.max(1, Math.ceil(filteredReleases.length / pageSize))
  const safePage = Math.min(page, pageCount)

  const refresh = useCallback((): void => load(true), [load])

  return {
    keyword,
    setKeyword,
    channel,
    setChannel,
    page: safePage,
    setPage,
    pageCount,
    total: filteredReleases.length,
    visibleReleases: filteredReleases.slice((safePage - 1) * pageSize, safePage * pageSize),
    loading,
    refresh
  }
}
