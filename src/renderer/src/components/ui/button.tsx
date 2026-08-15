import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#202123] text-white hover:bg-[#343538]',
        secondary: 'border border-[#d9dcdf] bg-white text-[#34373a] hover:bg-[#f5f5f4]',
        ghost: 'text-[#5f6368] hover:bg-[#ededeb] hover:text-[#202123]',
        outline: 'border border-[#d9dcdf] bg-transparent text-[#34373a] hover:bg-[#f5f5f4]',
        success: 'bg-[var(--accent)] text-white hover:brightness-90'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-5',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps): React.JSX.Element {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
