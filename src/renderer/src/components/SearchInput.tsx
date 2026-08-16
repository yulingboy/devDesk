import type { ComponentProps } from 'react'
import { Search, X } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'

interface SearchInputProps extends Omit<
  ComponentProps<typeof InputGroupInput>,
  'onChange' | 'type' | 'value'
> {
  value: string
  onValueChange: (value: string) => void
}

/** 全局搜索输入统一使用 InputGroup，并为有值状态提供可访问的清空操作。 */
export function SearchInput({
  className,
  onValueChange,
  value,
  ...props
}: SearchInputProps): React.JSX.Element {
  return (
    <InputGroup className={className}>
      <InputGroupAddon className="pr-0">
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={props['aria-label'] ?? props.placeholder ?? '搜索'}
        className="[&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => onValueChange(event.target.value)}
        type="search"
        value={value}
        {...props}
      />
      {value && (
        <InputGroupAddon className="pl-0 pr-0.5">
          <InputGroupButton
            aria-label="清空搜索"
            disabled={props.disabled}
            onClick={() => onValueChange('')}
            type="button"
          >
            <X aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
