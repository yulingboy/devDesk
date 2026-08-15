import { LoaderCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** 列表型业务页面的统一加载占位，避免读取阶段短暂显示空状态。 */
export function PageLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="h-full overflow-hidden p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-400">
        <LoaderCircle className="animate-spin" />
        正在加载页面数据
      </div>
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-52" />
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Skeleton className="h-7 w-full" />
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton className="h-9 w-full" key={index} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-14 w-full" key={index} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
