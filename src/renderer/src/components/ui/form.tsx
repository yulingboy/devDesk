import { Slot } from '@radix-ui/react-slot'
import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export function FormItem({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('space-y-1.5', className)} {...props} />
}

interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
  htmlFor?: string
  labelExtra?: ReactNode
  description?: ReactNode
  error?: ReactNode
  children: ReactNode
}

/**
 * 紧凑表单字段，统一管理标签行、控件和描述的垂直间距。
 * labelExtra 用于字数、单位等标签右侧信息，不再让业务页面重复拼接标签布局。
 */
export function Field({
  children,
  className,
  description,
  error,
  htmlFor,
  label,
  labelExtra,
  ...props
}: FieldProps): React.JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)} {...props}>
      <div className="flex min-h-4 items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {labelExtra}
      </div>
      {children}
      {description && <FormDescription>{description}</FormDescription>}
      {error && <FormMessage>{error}</FormMessage>}
    </div>
  )
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
