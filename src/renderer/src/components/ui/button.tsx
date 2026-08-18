import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'
import { Spinner } from '@/components/ui/spinner'

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** 异步操作期间统一禁用按钮并显示加载指示。 */
  loading?: boolean
  loadingText?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      children,
      className,
      disabled,
      loading = false,
      loadingText,
      variant,
      size,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && <Spinner className="size-3.5" />}
        {/* 图标按钮保持固定尺寸，加载时只显示 Spinner，避免短暂文案撑破操作列。 */}
        {loading ? (size === 'icon' ? null : loadingText) : children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'
