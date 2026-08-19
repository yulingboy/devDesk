import { useState } from 'react'
import { Save } from 'lucide-react'
import type { SSHKeyDraft, SSHKeyGenerateOptions } from '@shared/domain'
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

export function SshKeyDrawer({
  mode,
  draft,
  status,
  saving,
  onClose,
  onSave,
  onGenerate
}: {
  mode: 'generate' | 'manual' | 'edit' | null
  draft: SSHKeyDraft
  status: string
  saving: boolean
  onClose: () => void
  onSave: (draft: SSHKeyDraft) => void
  onGenerate: (options: SSHKeyGenerateOptions) => void
}): React.JSX.Element {
  const generating = mode === 'generate'
  const [localDraft, setLocalDraft] = useState(draft)
  const [localGenerateOptions, setLocalGenerateOptions] = useState<SSHKeyGenerateOptions>({
    name: 'id_ed25519_devdesk',
    algorithm: 'ed25519',
    comment: '',
    passphrase: ''
  })
  return (
    <Drawer
      description={
        generating
          ? '调用本机 ssh-keygen，私钥内容不会进入应用存储。'
          : '名称必须唯一，系统会自动计算算法和指纹。'
      }
      footer={
        <DrawerActions
          onCancel={onClose}
          onSubmit={() => (generating ? onGenerate(localGenerateOptions) : onSave(localDraft))}
          submitIcon={<Save size={15} />}
          submitting={saving}
          submitText={generating ? '生成中' : '保存中'}
        />
      }
      onClose={onClose}
      open={mode !== null}
      title={
        generating
          ? '新增 SSH 密钥（自动生成）'
          : mode === 'edit'
            ? '编辑 SSH 公钥'
            : '录入 SSH 公钥'
      }
    >
      {!generating ? (
        <div className="space-y-3">
          <Field htmlFor="key-name" label="名称">
            <Input
              id="key-name"
              onChange={(event) => setLocalDraft({ ...localDraft, name: event.target.value })}
              value={localDraft.name}
            />
          </Field>
          <Field htmlFor="key-value" label="公钥">
            <Textarea
              id="key-value"
              onChange={(event) => setLocalDraft({ ...localDraft, publicKey: event.target.value })}
              placeholder="ssh-ed25519 AAAA..."
              value={localDraft.publicKey}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <Alert variant="warning">
            <AlertDescription>不设置口令会降低私钥安全性，重要密钥建议配置口令。</AlertDescription>
          </Alert>
          <Field htmlFor="generate-name" label="文件名">
            <Input
              id="generate-name"
              onChange={(event) =>
                setLocalGenerateOptions({ ...localGenerateOptions, name: event.target.value })
              }
              value={localGenerateOptions.name}
            />
          </Field>
          <Field htmlFor="generate-algorithm" label="算法">
            <Select
              value={localGenerateOptions.algorithm}
              onValueChange={(value) =>
                setLocalGenerateOptions({
                  ...localGenerateOptions,
                  algorithm: value as SSHKeyGenerateOptions['algorithm']
                })
              }
            >
              <SelectTrigger id="generate-algorithm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ed25519">ed25519</SelectItem>
                <SelectItem value="rsa">RSA 4096</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field htmlFor="generate-comment" label="注释">
            <Input
              id="generate-comment"
              onChange={(event) =>
                setLocalGenerateOptions({ ...localGenerateOptions, comment: event.target.value })
              }
              placeholder="邮箱或用途"
              value={localGenerateOptions.comment}
            />
          </Field>
          <Field htmlFor="generate-passphrase" label="口令（可选）">
            <Input
              id="generate-passphrase"
              onChange={(event) =>
                setLocalGenerateOptions({ ...localGenerateOptions, passphrase: event.target.value })
              }
              type="password"
              value={localGenerateOptions.passphrase}
            />
          </Field>
          {status && (
            <Alert variant="destructive">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Drawer>
  )
}
