import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ResourcePanelProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

/** 资源列表页共用的紧凑面板外壳，不包含搜索、表格或业务操作。 */
export function ResourcePanel({
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName
}: ResourcePanelProps): React.JSX.Element {
  return (
    <Card className={className}>
      <CardHeader className={cn('flex-row items-start justify-between', headerClassName)}>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
