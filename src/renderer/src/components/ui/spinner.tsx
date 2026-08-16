import { LoaderCircle } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** shadcn 加载指示器，固定尺寸以免异步状态造成布局抖动。 */
export function Spinner({
  className,
  ...props
}: ComponentProps<typeof LoaderCircle>): React.JSX.Element {
  return (
    <LoaderCircle
      aria-label="加载中"
      className={cn('size-4 animate-spin', className)}
      role="status"
      {...props}
    />
  )
}
