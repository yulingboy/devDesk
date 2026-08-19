import { useState } from 'react'
import { Save } from 'lucide-react'
import { DrawerActions } from '@/components/common/DrawerActions'
import { Drawer } from '@/components/ui/drawer'
import { Field } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'

interface ProjectRemarkDrawerProps {
  open: boolean
  projectName: string
  value: string
  saving: boolean
  onClose: () => void
  onSave: (value: string) => void
}

/** 备注是用户维护字段，使用独立抽屉编辑并与扫描状态解耦。 */
export function ProjectRemarkDrawer({
  open,
  projectName,
  value,
  saving,
  onClose,
  onSave
}: ProjectRemarkDrawerProps): React.JSX.Element {
  const [localValue, setLocalValue] = useState(value)
  return (
    <Drawer
      description={projectName}
      footer={
        <DrawerActions
          onCancel={onClose}
          onSubmit={() => onSave(localValue)}
          submitIcon={<Save size={15} />}
          submitting={saving}
        />
      }
      onClose={onClose}
      open={open}
      title="编辑项目备注"
    >
      <Field
        htmlFor="project-remark"
        label="备注"
        labelExtra={
          <span className="text-[10px] tabular-nums text-slate-400">{localValue.length}/200</span>
        }
      >
        <Textarea
          autoFocus
          id="project-remark"
          maxLength={200}
          onChange={(event) => setLocalValue(event.target.value)}
          placeholder="填写项目用途、阶段或其他说明"
          rows={5}
          value={localValue}
        />
      </Field>
    </Drawer>
  )
}
