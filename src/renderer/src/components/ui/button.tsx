import type { ButtonHTMLAttributes, MouseEventHandler } from 'react'
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
      onClick,
      ...props
    },
    ref
  ) => {
    const inactive = Boolean(disabled || loading)

    if (asChild) {
      const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        if (inactive) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        onClick?.(event)
      }

      // Radix Slot 要求唯一元素子节点，加载图标不能作为兄弟节点注入。
      return (
        <Slot
          aria-busy={loading || undefined}
          aria-disabled={inactive || undefined}
          className={cn(
            buttonVariants({ variant, size }),
            inactive && 'pointer-events-none opacity-50',
            className
          )}
          onClick={handleClick}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={inactive}
        onClick={onClick}
        ref={ref}
        {...props}
      >
        {loading && <Spinner className="size-3.5" />}
        {/* 图标按钮保持固定尺寸，加载时只显示 Spinner，避免短暂文案撑破操作列。 */}
        {loading ? (size === 'icon' ? null : loadingText) : children}
      </button>
    )
  }
)
Button.displayName = 'Button'
