import type { ButtonProps } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TooltipButtonProps extends Omit<ButtonProps, 'title'> {
  tooltip: string
}
export function TooltipButton({ tooltip, ...props }: TooltipButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={props['aria-label'] ?? tooltip} {...props} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
