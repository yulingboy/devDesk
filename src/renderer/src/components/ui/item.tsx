import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** 紧凑列表单元，统一“图标、内容、操作”三段式信息布局。 */
export function Item({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-md border border-slate-100 px-2.5 py-2 text-xs transition-colors hover:bg-slate-50/70',
        className
      )}
      {...props}
    />
  )
}

export function ItemMedia({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)] [&_svg]:size-4',
        className
      )}
      {...props}
    />
  )
}

export function ItemContent({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('min-w-0 flex-1', className)} {...props} />
}

export function ItemTitle({ className, ...props }: ComponentProps<'p'>): React.JSX.Element {
  return <p className={cn('font-medium text-slate-800', className)} {...props} />
}

export function ItemDescription({ className, ...props }: ComponentProps<'p'>): React.JSX.Element {
  return <p className={cn('mt-0.5 truncate text-[11px] text-slate-500', className)} {...props} />
}

export function ItemActions({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('flex shrink-0 items-center gap-1', className)} {...props} />
}
