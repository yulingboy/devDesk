import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const ScrollArea = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    className={cn('relative overflow-hidden', className)}
    ref={ref}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="size-full min-w-0 rounded-[inherit] [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName
export const ScrollBar = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' ? 'h-full w-1.5' : 'h-1.5 flex-col',
      className
    )}
    orientation={orientation}
    ref={ref}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full border border-transparent bg-slate-300/80 bg-clip-content transition-colors hover:bg-slate-400" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName
