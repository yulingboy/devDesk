import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  icon?: ReactNode
  content: ReactNode
}

interface TabsProps {
  items: TabItem[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  listClassName?: string
  triggerClassName?: string
  contentClassName?: string
  orientation?: 'horizontal' | 'vertical'
  fill?: boolean
}

/** 基于 Radix Tabs 的 shadcn 页签，自动提供键盘导航和 ARIA 关联。 */
export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
  listClassName,
  triggerClassName,
  contentClassName,
  orientation = 'horizontal',
  fill = false
}: TabsProps): React.JSX.Element {
  return (
    <TabsPrimitive.Root
      className={cn(
        orientation === 'vertical'
          ? 'flex min-h-0 gap-3'
          : fill
            ? 'flex min-h-0 flex-col gap-2.5'
            : 'space-y-2.5',
        className
      )}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={onValueChange}
      value={value}
    >
      <TabsPrimitive.List
        aria-label="页面分区"
        className={cn(
          orientation === 'vertical'
            ? 'flex w-44 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white px-3 py-4'
            : 'flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200',
          listClassName
        )}
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 border-transparent px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700 data-[state=active]:text-[var(--accent)]',
              orientation === 'vertical'
                ? 'flex h-9 items-center gap-2 rounded-md border text-left text-xs hover:bg-slate-50 data-[state=active]:border-[var(--theme-border)] data-[state=active]:bg-[var(--theme-lighter)] data-[state=active]:shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                : 'border-b-2 hover:border-slate-300 data-[state=active]:border-[var(--accent)]',
              triggerClassName
            )}
            key={item.value}
            value={item.value}
          >
            {item.icon}
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          className={cn(
            'min-w-0 outline-none',
            orientation === 'vertical' && 'min-h-0 flex-1 overflow-auto bg-slate-50/70 px-6 py-5',
            fill && orientation !== 'vertical' && 'min-h-0 flex-1 overflow-auto',
            contentClassName
          )}
          key={item.value}
          value={item.value}
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
