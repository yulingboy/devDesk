import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react'
import type { NodeRelease, NodeState } from '@shared/domain'
import { TooltipButton } from '@/components/common/TooltipButton'
import { SearchInput } from '@/components/common/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

export type ReleaseChannel = 'all' | 'lts' | 'current'

interface AvailableVersionsPanelProps {
  state: NodeState | null
  versionAction: string
  keyword: string
  channel: ReleaseChannel
  visibleReleases: NodeRelease[]
  releasesLoading: boolean
  releasePage: number
  releasePageCount: number
  releaseTotal: number
  onKeywordChange: (value: string) => void
  onChannelChange: (value: ReleaseChannel) => void
  onRefresh: () => void
  onPageChange: (page: number | ((page: number) => number)) => void
  onInstall: (version: string) => void
}

/** 可安装版本面板，包含筛选、分页和安装动作。 */
export function AvailableVersionsPanel({
  state,
  versionAction,
  keyword,
  channel,
  visibleReleases,
  releasesLoading,
  releasePage,
  releasePageCount,
  releaseTotal,
  onKeywordChange,
  onChannelChange,
  onRefresh,
  onPageChange,
  onInstall
}: AvailableVersionsPanelProps): React.JSX.Element {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle>可安装版本</CardTitle>
        <CardDescription>版本索引来自 Node.js 官方源，支持 LTS 和 Current 筛选。</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 gap-2">
          <SearchInput
            className="flex-1"
            onValueChange={onKeywordChange}
            placeholder="搜索版本、LTS 或 npm"
            value={keyword}
          />
          <Select onValueChange={onChannelChange} value={channel}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="lts">LTS</SelectItem>
              <SelectItem value="current">Current</SelectItem>
            </SelectContent>
          </Select>
          <TooltipButton
            disabled={releasesLoading}
            onClick={onRefresh}
            size="icon"
            tooltip="刷新版本"
            variant="secondary"
          >
            {releasesLoading ? <Spinner /> : <RefreshCw size={14} />}
          </TooltipButton>
        </div>
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="space-y-1.5">
            {releasesLoading &&
              Array.from({ length: 8 }, (_, index) => (
                <div
                  className="flex h-12 items-center justify-between border border-slate-100 px-3"
                  key={index}
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            {!releasesLoading &&
              visibleReleases.map((release) => (
                <Item key={release.version}>
                  <ItemContent className="flex flex-row items-center gap-2">
                    <ItemTitle className="font-mono">{release.version}</ItemTitle>
                    {release.lts && <Badge variant="success">{release.lts}</Badge>}
                    {release.security && <Badge variant="outline">安全更新</Badge>}
                    {state?.installed.some(
                      (item) => item.version === release.version.replace(/^v/, '')
                    ) && <Badge variant="outline">已安装</Badge>}
                    {!release.platformSupported && (
                      <Badge variant="secondary">当前平台不可用</Badge>
                    )}
                    <ItemDescription className="ml-auto">
                      {release.date || '--'} · npm {release.npm || '--'}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <TooltipButton
                      disabled={
                        !release.platformSupported ||
                        !state?.capabilities?.canInstall ||
                        Boolean(versionAction) ||
                        state?.installed.some(
                          (item) => item.version === release.version.replace(/^v/, '')
                        )
                      }
                      loading={versionAction === `install:${release.version.replace(/^v/, '')}`}
                      loadingText="安装中"
                      onClick={() => onInstall(release.version.replace(/^v/, ''))}
                      size="icon"
                      tooltip="安装 Node 版本"
                      variant="ghost"
                    >
                      <Download size={13} />
                    </TooltipButton>
                  </ItemActions>
                </Item>
              ))}
            {!releasesLoading && !visibleReleases.length && (
              <Empty className="min-h-36">
                <EmptyTitle>没有匹配的 Node 版本</EmptyTitle>
                <EmptyDescription>请调整关键词或版本通道后重试。</EmptyDescription>
              </Empty>
            )}
          </div>
        </ScrollArea>
        <div className="flex shrink-0 items-center justify-between text-xs text-slate-500">
          <span>
            {releasesLoading ? '正在读取 Node 官方版本索引' : `共 ${releaseTotal} 个版本`}
          </span>
          <div className="flex items-center gap-1">
            <TooltipButton
              disabled={releasePage <= 1}
              onClick={() => onPageChange((page) => Math.max(1, page - 1))}
              size="icon"
              tooltip="上一页"
              variant="ghost"
            >
              <ChevronLeft size={14} />
            </TooltipButton>
            <span>
              {Math.min(releasePage, releasePageCount)} / {releasePageCount}
            </span>
            <TooltipButton
              disabled={releasePage >= releasePageCount}
              onClick={() => onPageChange((page) => Math.min(releasePageCount, page + 1))}
              size="icon"
              tooltip="下一页"
              variant="ghost"
            >
              <ChevronRight size={14} />
            </TooltipButton>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
