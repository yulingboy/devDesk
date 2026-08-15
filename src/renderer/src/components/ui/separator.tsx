import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Separator({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div aria-hidden="true" className={cn('h-px w-full bg-[#e7e8e9]', className)} {...props} />
}
