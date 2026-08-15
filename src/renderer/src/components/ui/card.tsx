import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025)]',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return <h3 className={cn('text-[15px] font-semibold text-slate-800', className)} {...props} />
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-xs leading-5 text-slate-500', className)} {...props} />
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}
