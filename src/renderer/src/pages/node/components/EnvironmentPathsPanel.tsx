import { FolderOpen, RefreshCw } from 'lucide-react'
import type { NodeEnvironmentPath } from '@shared/domain'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { usePageFeedback } from '@/hooks/usePageFeedback'

interface EnvironmentPathsPanelProps {
  paths: NodeEnvironmentPath[]
  loading: boolean
  onRefresh: () => void
}

/** 展示 Node、nvm 与包管理器的实际运行时路径。 */
export function EnvironmentPathsPanel({
  paths,
  loading,
  onRefresh
}: EnvironmentPathsPanelProps): React.JSX.Element {
  const { report } = usePageFeedback('打开运行时路径失败', { keepStatus: false })

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>运行时路径</CardTitle>
          <CardDescription>路径快照用于定位 Node、nvm 和各包管理器的实际数据位置。</CardDescription>
        </div>
        <TooltipButton
          disabled={loading}
          onClick={onRefresh}
          size="icon"
          tooltip="刷新运行时路径"
          variant="ghost"
        >
          {loading ? <Spinner /> : <RefreshCw size={14} />}
        </TooltipButton>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading &&
          Array.from({ length: 5 }, (_, index) => <Skeleton className="h-12 w-full" key={index} />)}
        {!loading &&
          paths.map((item) => (
            <Item className="px-1" key={item.id}>
              <ItemContent>
                <ItemTitle>{item.name}</ItemTitle>
                <ItemDescription className="font-mono" title={item.path}>
                  {item.path}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant={item.exists ? 'success' : 'outline'}>
                  {item.exists ? '存在' : '未找到'}
                </Badge>
                <TooltipButton
                  disabled={!item.exists}
                  onClick={() =>
                    void window.api?.node
                      .openPath({ type: 'environment', id: item.id })
                      .catch(report)
                  }
                  size="icon"
                  tooltip="打开目录"
                  variant="ghost"
                >
                  <FolderOpen size={14} />
                </TooltipButton>
              </ItemActions>
            </Item>
          ))}
        {!loading && !paths.length && (
          <Empty className="min-h-20 py-3">
            <EmptyTitle>未读取到环境路径</EmptyTitle>
            <EmptyDescription>请刷新 Node 状态后重试。</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
