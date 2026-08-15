import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface DrawerProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  className?: string
}

/** 基于 shadcn Sheet/Radix Dialog 的业务抽屉，自动处理焦点、遮罩和键盘关闭。 */
export function Drawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className
}: DrawerProps): React.JSX.Element {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-x-0 bottom-0 top-12 z-50 bg-slate-950/20 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed bottom-0 right-0 top-12 z-50 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl outline-none data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 data-[state=closed]:transition-transform data-[state=open]:transition-transform',
            className
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-slate-800">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-slate-500">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogPrimitive.Close asChild>
                  <Button aria-label="关闭" size="icon" variant="ghost">
                    <X size={17} />
                  </Button>
                </DialogPrimitive.Close>
              </TooltipTrigger>
              <TooltipContent>关闭</TooltipContent>
            </Tooltip>
          </header>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-4 py-4">{children}</div>
          </ScrollArea>
          {footer && (
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
