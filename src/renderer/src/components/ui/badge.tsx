import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-slate-800 text-white',
        success: 'border-[var(--theme-border)] bg-[var(--theme-lighter)] text-[var(--accent)]',
        secondary: 'border-slate-200 bg-slate-50 text-slate-600',
        outline: 'border-slate-200 text-slate-600'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
