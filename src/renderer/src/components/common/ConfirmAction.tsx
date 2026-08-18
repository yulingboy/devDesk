import { useState, type ReactElement, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Spinner } from '@/components/ui/spinner'

interface ConfirmActionProps {
  children: ReactElement
  title: string
  description: ReactNode
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  triggerTooltip?: string
  onOpenChange?: (open: boolean) => void
}

/** 统一危险操作确认，替代阻塞式 window.confirm。 */
export function ConfirmAction({
  children,
  title,
  description,
  confirmLabel = '确认',
  onConfirm,
  triggerTooltip,
  onOpenChange
}: ConfirmActionProps): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const handleConfirm = async (): Promise<void> => {
    if (pending) return
    setPending(true)
    try {
      await onConfirm()
    } finally {
      setPending(false)
    }
  }
  const trigger = <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
  return (
    <AlertDialog onOpenChange={onOpenChange}>
      {triggerTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{triggerTooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={handleConfirm}>
            {pending && <Spinner className="mr-1.5 size-3.5" />}
            {pending ? '处理中' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
