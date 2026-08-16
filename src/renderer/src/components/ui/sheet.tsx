import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** shadcn Sheet 的紧凑实现，抽屉及侧栏等浮层共用此基础能力。 */
export function Sheet(props: ComponentProps<typeof DialogPrimitive.Root>): React.JSX.Element {
  return <DialogPrimitive.Root {...props} />
}

export function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  children: ReactNode
  showCloseButton?: boolean
}): React.JSX.Element {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-x-0 bottom-0 top-12 z-50 bg-slate-950/20 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed bottom-0 right-0 top-12 z-50 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl outline-none data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 data-[state=closed]:transition-transform data-[state=open]:transition-transform',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            aria-label="关闭"
            className="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-light)]"
          >
            <X size={16} />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: ComponentProps<'header'>): React.JSX.Element {
  return (
    <header
      className={cn(
        'flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3',
        className
      )}
      {...props}
    />
  )
}

export function SheetFooter({ className, ...props }: ComponentProps<'footer'>): React.JSX.Element {
  return (
    <footer
      className={cn(
        'flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3',
        className
      )}
      {...props}
    />
  )
}

export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold text-slate-800', className)}
      {...props}
    />
  )
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element {
  return (
    <DialogPrimitive.Description
      className={cn('mt-1 text-xs leading-5 text-slate-500', className)}
      {...props}
    />
  )
}
