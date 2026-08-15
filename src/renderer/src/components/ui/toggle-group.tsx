import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const ToggleGroup = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    className={cn('flex flex-wrap gap-1.5', className)}
    ref={ref}
    {...props}
  />
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName
export const ToggleGroupItem = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    className={cn(
      'flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none hover:bg-slate-50 data-[state=on]:border-[var(--accent)] data-[state=on]:bg-[var(--theme-lighter)] data-[state=on]:text-[var(--accent)]',
      className
    )}
    ref={ref}
    {...props}
  />
))
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName
