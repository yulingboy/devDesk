import { ChevronDown, Code2 } from 'lucide-react'
import { PROJECT_EDITOR_OPTIONS, type ProjectEditorId } from '@shared/domain'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface ProjectEditorMenuProps {
  path: string
  disabled?: boolean
  labeled?: boolean
  onOpen: (path: string, editor: ProjectEditorId) => void
}

/** 项目和子项目共用同一组编辑器入口，避免各页面继续写死 VS Code。 */
export function ProjectEditorMenu({
  path,
  disabled,
  labeled = false,
  onOpen
}: ProjectEditorMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="选择编辑器打开"
          disabled={disabled}
          size={labeled ? 'default' : 'icon'}
          variant={labeled ? 'success' : 'ghost'}
        >
          <Code2 size={14} />
          {labeled && (
            <>
              选择编辑器
              <ChevronDown size={13} />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PROJECT_EDITOR_OPTIONS.map((editor) => (
          <DropdownMenuItem key={editor.id} onSelect={() => onOpen(path, editor.id)}>
            <Code2 />
            {editor.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
