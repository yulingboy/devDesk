import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ checked, className, style, ...props }, ref) => {
  // 所有现有开关均为受控组件，直接按 checked 着色可规避状态选择器被外部样式覆盖。
  const stateStyle =
    typeof checked === 'boolean'
      ? {
          ...style,
          borderColor: checked ? '#2563eb' : '#cbd5e1',
          backgroundColor: checked ? '#2563eb' : '#e2e8f0'
        }
      : style

  return (
    <SwitchPrimitive.Root
      checked={checked}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-slate-300 bg-slate-200 p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--theme-light)] data-[state=unchecked]:border-slate-300 data-[state=unchecked]:bg-slate-200 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      style={stateStyle}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.2)] transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  )
})
Switch.displayName = SwitchPrimitive.Root.displayName
