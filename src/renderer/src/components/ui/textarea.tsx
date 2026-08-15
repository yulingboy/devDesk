import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full resize-y rounded-md border border-[#d9dadb] bg-white px-3 py-2 text-sm text-[#202123] outline-none placeholder:text-[#a0a2a5] focus:border-[#22a06b] focus:ring-2 focus:ring-[#22a06b]/15',
        className
      )}
      {...props}
    />
  )
}
