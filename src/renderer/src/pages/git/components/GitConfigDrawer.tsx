import { useState } from 'react'
import { Save } from 'lucide-react'
import type { GitIdentity, GitState, SSHKey } from '@shared/domain'
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

export function GitConfigDrawer({
  mode,
  state,
  keys,
  global,
  identity,
  saving,
  onClose,
  onSaveGlobal,
  onSaveIdentity
}: {
  mode: 'global' | 'identity' | null
  state: GitState | null
  keys: SSHKey[]
  global: { username: string; email: string }
  identity: GitIdentity
  saving: boolean
  onClose: () => void
  onSaveGlobal: (global: { username: string; email: string }) => void
  onSaveIdentity: (identity: GitIdentity) => void
}): React.JSX.Element {
  const editingGlobal = mode === 'global'
  const [localGlobal, setLocalGlobal] = useState(global)
  const [localIdentity, setLocalIdentity] = useState(identity)

  return (
    <Drawer
      description={
        editingGlobal
          ? '此操作会直接修改当前用户的真实 Git 全局配置。'
          : '配置可绑定 SSH 密钥，并由工作区通过 includeIf 自动应用。'
      }
      footer={
        <DrawerActions
          onCancel={onClose}
          onSubmit={() =>
            editingGlobal ? onSaveGlobal(localGlobal) : onSaveIdentity(localIdentity)
          }
          submitIcon={<Save size={15} />}
          submitting={saving}
        />
      }
      onClose={onClose}
      open={editingGlobal || mode === 'identity'}
      title={editingGlobal ? '编辑全局 Git 配置' : identity.id ? '编辑 Git 配置' : '新增 Git 配置'}
    >
      {editingGlobal ? (
        <div className="space-y-3">
          <Alert variant="warning">
            <AlertDescription>
              保存后会立即写入 {state?.global.sourceFile || '~/.gitconfig'}。
            </AlertDescription>
          </Alert>
          <Field htmlFor="global-name" label="用户名">
            <Input
              id="global-name"
              onChange={(event) => setLocalGlobal({ ...localGlobal, username: event.target.value })}
              value={localGlobal.username}
            />
          </Field>
          <Field htmlFor="global-email" label="邮箱">
            <Input
              id="global-email"
              onChange={(event) => setLocalGlobal({ ...localGlobal, email: event.target.value })}
              value={localGlobal.email}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <Field htmlFor="identity-name" label="身份名称">
            <Input
              id="identity-name"
              onChange={(event) => setLocalIdentity({ ...localIdentity, name: event.target.value })}
              value={localIdentity.name}
            />
          </Field>
          <Field htmlFor="identity-user" label="用户名">
            <Input
              id="identity-user"
              onChange={(event) =>
                setLocalIdentity({ ...localIdentity, username: event.target.value })
              }
              value={localIdentity.username}
            />
          </Field>
          <Field htmlFor="identity-email" label="邮箱">
            <Input
              id="identity-email"
              onChange={(event) =>
                setLocalIdentity({ ...localIdentity, email: event.target.value })
              }
              value={localIdentity.email}
            />
          </Field>
          <Field htmlFor="identity-key" label="SSH 密钥">
            <Select
              onValueChange={(value) =>
                setLocalIdentity({
                  ...localIdentity,
                  sshKeyId: value === 'none' ? undefined : value
                })
              }
              value={localIdentity.sshKeyId ?? 'none'}
            >
              <SelectTrigger id="identity-key">
                <SelectValue placeholder="不绑定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不绑定</SelectItem>
                {keys.map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    {key.name} · {key.fingerprint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    </Drawer>
  )
}
