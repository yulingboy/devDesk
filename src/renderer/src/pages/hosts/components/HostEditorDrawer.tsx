import { useState } from 'react'
import { FileWarning, Save } from 'lucide-react'
import type { HostRecord } from '@shared/domain'
import { DrawerActions } from '@/components/common/DrawerActions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Drawer } from '@/components/ui/drawer'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function HostEditorDrawer({
  draft,
  open,
  saving,
  status,
  onClose,
  onSave
}: {
  draft: HostRecord
  open: boolean
  saving: boolean
  status: string
  onClose: () => void
  onSave: (draft: HostRecord) => void
}): React.JSX.Element {
  const [localDraft, setLocalDraft] = useState(draft)

  return (
    <Drawer
      description="首次写入前会自动备份原始 Hosts 文件；保存失败时会保留当前输入。"
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
      title={localDraft.id ? '编辑 Host 记录' : '新增 Host 记录'}
    >
      <div className="space-y-3">
        <Field htmlFor="host-ip" label="IP 地址">
          <Input
            id="host-ip"
            onChange={(event) => setLocalDraft({ ...localDraft, ip: event.target.value })}
            placeholder="127.0.0.1"
            value={localDraft.ip}
          />
        </Field>
        <Field htmlFor="host-domain" label="域名">
          <Input
            id="host-domain"
            onChange={(event) => setLocalDraft({ ...localDraft, domain: event.target.value })}
            placeholder="dev.example.com"
            value={localDraft.domain}
          />
        </Field>
        <Field htmlFor="host-remark" label="备注">
          <Input
            id="host-remark"
            onChange={(event) => setLocalDraft({ ...localDraft, remark: event.target.value })}
            placeholder="可选"
            value={localDraft.remark}
          />
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={localDraft.enabled}
            id="host-enabled"
            onCheckedChange={(checked) =>
              setLocalDraft({ ...localDraft, enabled: checked === true })
            }
          />
          <Label htmlFor="host-enabled">启用记录</Label>
        </div>
        {status && (
          <Alert variant="destructive">
            <FileWarning size={14} />
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}
      </div>
    </Drawer>
  )
}
