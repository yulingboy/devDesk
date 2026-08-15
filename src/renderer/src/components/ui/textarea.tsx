import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return (
    <textarea
      className={cn(
        'min-h-14 w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--theme-light)]',
        className
      )}
      {...props}
    />
  )
}
