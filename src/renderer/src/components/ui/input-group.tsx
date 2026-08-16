import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * shadcn Input Group 的紧凑实现，用于把输入框与图标、尾部操作组成单一控件。
 * 聚焦边框由容器统一管理，避免页面手动拼接时出现双重边框。
 */
export function InputGroup({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-7 min-w-0 items-center overflow-hidden rounded-md border border-slate-200 bg-white text-slate-700 transition-colors focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--theme-light)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
        className
      )}
      role="group"
      {...props}
    />
  )
}

export function InputGroupInput({
  className,
  ...props
}: ComponentProps<'input'>): React.JSX.Element {
  return (
    <Input
      className={cn(
        'h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 focus:border-transparent focus:ring-0',
        className
      )}
      {...props}
    />
  )
}

export function InputGroupAddon({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-full shrink-0 items-center gap-0.5 px-2 text-slate-400 [&_svg]:size-3.5',
        className
      )}
      {...props}
    />
  )
}

export function InputGroupButton({
  className,
  ...props
}: ComponentProps<typeof Button>): React.JSX.Element {
  return (
    <Button
      className={cn('size-6 rounded-sm p-0', className)}
      size="icon"
      variant="ghost"
      {...props}
    />
  )
}
