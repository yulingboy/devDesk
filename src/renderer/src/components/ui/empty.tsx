import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** shadcn Empty 组合，用于列表、任务与检测结果的无数据状态。 */
export function Empty({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex min-h-24 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 px-4 py-5 text-center',
        className
      )}
      {...props}
    />
  )
}

export function EmptyTitle({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-xs font-medium text-slate-600', className)} {...props} />
}

export function EmptyDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('mt-1 text-[11px] text-slate-400', className)} {...props} />
}
