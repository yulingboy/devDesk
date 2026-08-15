import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

/** 统一业务抽屉；避开 48px 应用标题栏，并锁定页面滚动防止双滚动。 */
export function Drawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className
}: DrawerProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-12 z-50">
      <button
        aria-label="关闭抽屉"
        className="absolute inset-0 cursor-default bg-slate-950/20 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <section
        aria-modal="true"
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-2xl',
          className
        )}
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          <Button aria-label="关闭" onClick={onClose} size="icon" title="关闭" variant="ghost">
            <X size={17} />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body
  )
}
