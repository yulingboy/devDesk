import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

/** 功能页面统一标题、说明与操作区，保持各路由首屏信息层级一致。 */
export function PageHeader({
  title,
  subtitle,
  extra
}: {
  title: string
  subtitle?: string
  extra?: ReactNode
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex min-h-[86px] items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {extra && <div className="flex shrink-0 items-center gap-2">{extra}</div>}
      </CardContent>
    </Card>
  )
}
