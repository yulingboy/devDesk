import { Boxes, GitBranch, Pencil, Play, Trash2 } from 'lucide-react'
import type { ProjectTemplate, Workspace } from '@shared/domain'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'

export function TemplateList({
  templates,
  workspaces,
  query,
  onCreateProject,
  onEdit,
  onRemove
}: {
  templates: ProjectTemplate[]
  workspaces: Workspace[]
  query: string
  onCreateProject: (template: ProjectTemplate) => void
  onEdit: (template: ProjectTemplate) => void
  onRemove: (template: ProjectTemplate) => Promise<void>
}): React.JSX.Element {
  return (
    <>
      {templates.map((template) => (
        <Item key={template.id}>
          <ItemMedia className="bg-slate-100 text-slate-600">
            {template.type === 'git' ? <GitBranch /> : <Boxes />}
          </ItemMedia>
          <ItemContent>
            <div className="flex items-center gap-2">
              <ItemTitle>{template.name}</ItemTitle>
              <Badge variant="secondary">{template.type === 'git' ? 'Git' : '本地'}</Badge>
            </div>
            <ItemDescription>{template.source}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <TooltipButton
              disabled={!workspaces.length}
              onClick={() => onCreateProject(template)}
              size="icon"
              tooltip={workspaces.length ? '使用此模板创建项目' : '请先创建工作区'}
              variant="ghost"
            >
              <Play size={14} />
            </TooltipButton>
            <TooltipButton
              onClick={() => onEdit(template)}
              size="icon"
              tooltip="编辑模板"
              variant="ghost"
            >
              <Pencil size={15} />
            </TooltipButton>
            <ConfirmAction
              description={`删除模板“${template.name}”不会删除已经创建的项目，但模板记录无法恢复。`}
              onConfirm={() => onRemove(template)}
              title="删除项目模板？"
              triggerTooltip="删除模板"
            >
              <Button aria-label="删除模板" size="icon" variant="ghost">
                <Trash2 size={15} />
              </Button>
            </ConfirmAction>
          </ItemActions>
        </Item>
      ))}
      {!templates.length && (
        <Empty>
          <EmptyTitle>{query ? '没有匹配模板' : '尚未添加项目模板'}</EmptyTitle>
          <EmptyDescription>
            {query
              ? '尝试修改搜索条件，或清空搜索框查看全部模板。'
              : '可添加 Git 仓库或本地目录作为项目模板。'}
          </EmptyDescription>
        </Empty>
      )}
    </>
  )
}
