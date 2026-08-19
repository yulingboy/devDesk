import { useState } from 'react'
import { Save } from 'lucide-react'
import type { ProjectTemplate } from '@shared/domain'
import { DrawerActions } from '@/components/common/DrawerActions'
import { DirectoryPickerInput } from '@/components/common/DirectoryPickerInput'
import { Drawer } from '@/components/ui/drawer'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export function TemplateEditorDrawer({
  draft,
  open,
  saving,
  onClose,
  onSave
}: {
  draft: ProjectTemplate
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (draft: ProjectTemplate) => void
}): React.JSX.Element {
  const [localDraft, setLocalDraft] = useState(draft)

  return (
    <Drawer
      description="支持 Git 仓库和本地目录两种来源，模板名称必须唯一。"
      footer={
        <DrawerActions
          onCancel={onClose}
          onSubmit={() => onSave(localDraft)}
          submitIcon={<Save size={15} />}
          submitting={saving}
        />
      }
      onClose={onClose}
      open={open}
      title={localDraft.id ? '编辑模板' : '新增模板'}
    >
      <div className="space-y-3">
        <Field htmlFor="template-name" label="名称">
          <Input
            id="template-name"
            onChange={(event) => setLocalDraft({ ...localDraft, name: event.target.value })}
            value={localDraft.name}
          />
        </Field>
        <Field htmlFor="template-type" label="类型">
          <Select
            value={localDraft.type}
            onValueChange={(value) =>
              setLocalDraft({ ...localDraft, type: value as ProjectTemplate['type'] })
            }
          >
            <SelectTrigger id="template-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">本地目录</SelectItem>
              <SelectItem value="git">Git 仓库</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field htmlFor="template-source" label="来源">
          {localDraft.type === 'local' ? (
            <DirectoryPickerInput
              id="template-source"
              onChange={(source) => setLocalDraft({ ...localDraft, source })}
              placeholder="选择本地模板目录"
              value={localDraft.source}
            />
          ) : (
            <Input
              id="template-source"
              onChange={(event) => setLocalDraft({ ...localDraft, source: event.target.value })}
              placeholder="https://github.com/user/template.git"
              value={localDraft.source}
            />
          )}
        </Field>
        <Field htmlFor="template-description" label="描述">
          <Textarea
            id="template-description"
            onChange={(event) => setLocalDraft({ ...localDraft, description: event.target.value })}
            value={localDraft.description}
          />
        </Field>
      </div>
    </Drawer>
  )
}
