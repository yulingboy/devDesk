import { ChevronDown, Code2 } from 'lucide-react'
import { PROJECT_EDITOR_OPTIONS } from '@shared/domain'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { usePageFeedback } from '@/hooks/usePageFeedback'

interface ProjectEditorMenuProps {
  path: string
  disabled?: boolean
  labeled?: boolean
}

/** 项目和子项目共用同一组编辑器入口，避免各页面继续写死 VS Code。 */
export function ProjectEditorMenu({
  path,
  disabled,
  labeled = false
}: ProjectEditorMenuProps): React.JSX.Element {
  const { report } = usePageFeedback('使用编辑器打开项目失败', { keepStatus: false })

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
          <DropdownMenuItem
            key={editor.id}
            onSelect={() =>
              void window.api?.workspaces.openProjectEditor(path, editor.id).catch(report)
            }
          >
            <Code2 />
            {editor.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
