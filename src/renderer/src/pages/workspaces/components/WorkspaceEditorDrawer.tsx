import { useState } from 'react'
import { Save } from 'lucide-react'
import type { GitIdentity, Workspace } from '@shared/domain'
import { DirectoryPickerInput } from '@/components/common/DirectoryPickerInput'
import { DrawerActions } from '@/components/common/DrawerActions'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

export function WorkspaceEditorDrawer({
  draft,
  identities,
  status,
  open,
  saving,
  onClose,
  onSave
}: {
  draft: Workspace
  identities: GitIdentity[]
  status: string
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (draft: Workspace) => void
}): React.JSX.Element {
  const [localDraft, setLocalDraft] = useState(draft)

  return (
    <Drawer
      description="名称和规范化根目录不能与现有工作区重复，保存后会同步 Git 规则。"
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
      title={localDraft.id ? '编辑工作区' : '新增工作区'}
    >
      <div className="space-y-3">
        <Field htmlFor="workspace-name" label="名称">
          <Input
            id="workspace-name"
            onChange={(event) => setLocalDraft({ ...localDraft, name: event.target.value })}
            value={localDraft.name}
          />
        </Field>
        <Field htmlFor="workspace-root" label="根目录">
          <DirectoryPickerInput
            id="workspace-root"
            onChange={(rootPath) => setLocalDraft({ ...localDraft, rootPath })}
            placeholder="输入或选择项目根目录"
            value={localDraft.rootPath}
          />
        </Field>
        <Field htmlFor="workspace-description" label="描述">
          <Textarea
            id="workspace-description"
            onChange={(event) => setLocalDraft({ ...localDraft, description: event.target.value })}
            value={localDraft.description}
          />
        </Field>
        <Field htmlFor="workspace-identity" label="Git 身份">
          <Select
            value={localDraft.gitIdentityId ?? 'none'}
            onValueChange={(value) =>
              setLocalDraft({ ...localDraft, gitIdentityId: value === 'none' ? undefined : value })
            }
          >
            <SelectTrigger id="workspace-identity">
              <SelectValue placeholder="不绑定" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不绑定</SelectItem>
              {identities.map((identity) => (
                <SelectItem key={identity.id} value={identity.id}>
                  {identity.name} · {identity.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          description="一级项目列表保持不变，仅在项目内部按此深度发现子项目。"
          htmlFor="workspace-scan-depth"
          label="子项目扫描深度"
        >
          <Select
            value={String(localDraft.scanDepth ?? 3)}
            onValueChange={(value) => setLocalDraft({ ...localDraft, scanDepth: Number(value) })}
          >
            <SelectTrigger id="workspace-scan-depth">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((depth) => (
                <SelectItem key={depth} value={String(depth)}>
                  {depth} 层
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          description="填写目录名并用逗号分隔，将与 node_modules、target 等内置规则叠加。"
          htmlFor="workspace-ignored-directories"
          label="忽略目录"
        >
          <Input
            id="workspace-ignored-directories"
            onChange={(event) =>
              setLocalDraft({
                ...localDraft,
                ignoredDirectories: event.target.value.split(',').map((item) => item.trim())
              })
            }
            placeholder="例如：examples, archive"
            value={(localDraft.ignoredDirectories ?? []).join(', ')}
          />
        </Field>
        {status && (
          <Alert variant="destructive">
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}
      </div>
    </Drawer>
  )
}
