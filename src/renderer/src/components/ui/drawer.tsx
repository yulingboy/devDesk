import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'

interface DrawerProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  className?: string
}

/** 基于 shadcn Sheet 的业务抽屉，自动处理焦点、遮罩和键盘关闭。 */
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
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className={className} showCloseButton={false}>
        <SheetHeader>
          <div>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </div>
          <Button aria-label="关闭" onClick={onClose} size="icon" variant="ghost">
            <X size={17} />
          </Button>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 py-4">{children}</div>
        </ScrollArea>
        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
