import { Slot } from '@radix-ui/react-slot'
import type { HTMLAttributes, LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export function FormItem({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('space-y-1.5', className)} {...props} />
}
export function FormLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>): React.JSX.Element {
  return <Label className={cn('text-xs font-medium text-slate-600', className)} {...props} />
}
export function FormControl(props: React.ComponentPropsWithoutRef<typeof Slot>): React.JSX.Element {
  return <Slot {...props} />
}
export function FormDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-[11px] text-slate-400', className)} {...props} />
}
export function FormMessage({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-xs text-red-600', className)} {...props} />
}
