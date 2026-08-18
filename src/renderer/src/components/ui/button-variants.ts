import { cva } from 'class-variance-authority'

/** 按钮的共享视觉变体，供 Button 和复合组件复用。 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-[11px] font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25 disabled:pointer-events-none disabled:opacity-50 disabled:active:translate-y-0 disabled:active:scale-100 aria-busy:cursor-wait',
  {
    variants: {
      variant: {
        default: 'bg-slate-800 text-white hover:bg-slate-700',
        secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        link: 'text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline',
        outline: 'border border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        success: 'bg-[var(--accent)] text-white hover:brightness-90'
      },
      size: {
        default: 'h-7 px-2.5 py-1',
        sm: 'h-6 px-2 text-[11px]',
        lg: 'h-8 px-4',
        icon: 'size-7'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)
