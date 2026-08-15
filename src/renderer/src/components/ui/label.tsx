import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>): React.JSX.Element {
  return <label className={cn('text-xs font-medium text-[#55595e]', className)} {...props} />
}
