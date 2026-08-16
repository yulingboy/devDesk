import { FolderOpen } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'

/** 支持手输和 Electron 原生目录选择，用户取消时保持原值。 */
export function DirectoryPickerInput({
  id,
  value,
  placeholder,
  onChange
}: {
  id?: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const selectDirectory = (): void => {
    void window.api?.dialog.selectDirectory(value || undefined).then((path) => {
      if (path) onChange(path)
    })
  }

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <InputGroupAddon className="border-l border-slate-100 px-0.5">
        <InputGroupButton
          aria-label="选择目录"
          className="w-auto px-2 text-[11px]"
          onClick={selectDirectory}
          type="button"
        >
          <FolderOpen aria-hidden="true" />
          选择
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
