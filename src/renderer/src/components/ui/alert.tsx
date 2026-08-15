import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('relative flex gap-2 rounded-md border p-3 text-xs leading-5', {
  variants: {
    variant: {
      default: 'border-slate-200 bg-slate-50 text-slate-600',
      warning: 'border-amber-200 bg-amber-50 text-amber-800',
      destructive: 'border-red-200 bg-red-50 text-red-700',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }
  },
  defaultVariants: { variant: 'default' }
})
export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}
export function Alert({ className, variant, ...props }: AlertProps): React.JSX.Element {
  return <div className={cn(alertVariants({ variant }), className)} role="alert" {...props} />
}
export function AlertTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return <h5 className={cn('font-medium', className)} {...props} />
}
export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('text-current/85', className)} {...props} />
}
