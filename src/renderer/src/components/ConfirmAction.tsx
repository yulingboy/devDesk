import type { ReactElement, ReactNode } from 'react'
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

interface ConfirmActionProps {
  children: ReactElement
  title: string
  description: ReactNode
  confirmLabel?: string
  onConfirm: () => void
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
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
