import { Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResourcePanel } from '@/components/common/ResourcePanel'
import { SearchInput } from '@/components/common/SearchInput'

export function TemplateToolbar({
  query,
  canCreateProject,
  onQueryChange,
  onCreateProject,
  onCreateTemplate,
  children
}: {
  query: string
  canCreateProject: boolean
  onQueryChange: (value: string) => void
  onCreateProject: () => void
  onCreateTemplate: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <ResourcePanel
      actions={
        <div className="flex gap-1">
          <Button
            disabled={!canCreateProject}
            onClick={onCreateProject}
            size="sm"
            variant="secondary"
          >
            <Play size={14} />
            创建项目
          </Button>
          <Button onClick={onCreateTemplate} size="sm" variant="success">
            <Plus size={14} />
            新增模板
          </Button>
        </div>
      }
      contentClassName="space-y-3"
      description="Git 模板使用浅克隆，本地模板会排除 .git、node_modules 和构建目录。"
      title="项目模板"
    >
      <SearchInput
        onValueChange={onQueryChange}
        placeholder="搜索模板名称、描述或来源"
        value={query}
      />
      {children}
    </ResourcePanel>
  )
}
