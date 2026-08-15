import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** 支持手输和 Electron 原生目录选择，用户取消时保持原值。 */
export function DirectoryPickerInput({
  value,
  placeholder,
  onChange
}: {
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
    <div className="flex gap-2">
      <Input
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <Button onClick={selectDirectory} variant="secondary">
        <FolderOpen size={15} />
        选择
      </Button>
    </div>
  )
}
