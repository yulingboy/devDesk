import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  content: ReactNode
}

interface TabsProps {
  items: TabItem[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
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
            ? 'flex w-32 shrink-0 flex-col gap-1 border-r border-slate-200 pr-2'
            : 'flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200'
        )}
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            className={cn(
              'shrink-0 border-transparent px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700 data-[state=active]:text-[var(--accent)]',
              orientation === 'vertical'
                ? 'rounded-sm border-l-2 text-left hover:bg-slate-50 data-[state=active]:border-[var(--accent)] data-[state=active]:bg-slate-50'
                : 'border-b-2 hover:border-slate-300 data-[state=active]:border-[var(--accent)]'
            )}
            key={item.value}
            value={item.value}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          className={cn(
            'min-w-0 outline-none',
            (orientation === 'vertical' || fill) && 'min-h-0 flex-1 overflow-auto'
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
