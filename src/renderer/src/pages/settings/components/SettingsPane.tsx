import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** 为每个设置分类提供统一的内容宽度和标题层级。 */
export function SettingsPane({
  title,
  children,
  className
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('mx-auto w-full max-w-5xl pb-4', className)}>
      <h1 className="sr-only">{title}</h1>
      {children}
    </div>
  )
}
