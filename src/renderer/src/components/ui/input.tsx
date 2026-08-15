import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-md border border-[#d9dadb] bg-white px-3 text-sm text-[#202123] outline-none placeholder:text-[#a0a2a5] focus:border-[#22a06b] focus:ring-2 focus:ring-[#22a06b]/15 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
