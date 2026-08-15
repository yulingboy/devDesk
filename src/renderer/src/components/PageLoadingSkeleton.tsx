import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** 列表型业务页面的统一加载占位，避免读取阶段短暂显示空状态。 */
export function PageLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-12 w-full" key={index} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
