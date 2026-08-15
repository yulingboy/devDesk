import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#202123] text-white',
        success: 'border-[#b9decf] bg-[#edf8f3] text-[#17704d]',
        secondary: 'border-[#d9dcdf] bg-[#f5f5f4] text-[#62666a]',
        outline: 'border-[#d9dcdf] text-[#62666a]'
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
