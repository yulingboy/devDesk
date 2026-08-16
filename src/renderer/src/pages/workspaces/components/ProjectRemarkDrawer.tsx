import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

interface ProjectRemarkDrawerProps {
  open: boolean
  projectName: string
  value: string
  saving: boolean
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
}

/** 备注是用户维护字段，使用独立抽屉编辑并与扫描状态解耦。 */
export function ProjectRemarkDrawer({
  open,
  projectName,
  value,
  saving,
  onChange,
  onClose,
  onSave
}: ProjectRemarkDrawerProps): React.JSX.Element {
  return (
    <Drawer
      description={projectName}
      footer={
        <>
          <Button disabled={saving} onClick={onClose} variant="secondary">
            取消
          </Button>
          <Button disabled={saving} onClick={onSave} variant="success">
            {saving ? <Spinner /> : <Save />}
            保存
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="编辑项目备注"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="project-remark">备注</Label>
          <span className="text-[10px] tabular-nums text-slate-400">{value.length}/200</span>
        </div>
        <Textarea
          autoFocus
          id="project-remark"
          maxLength={200}
          onChange={(event) => onChange(event.target.value)}
          placeholder="填写项目用途、阶段或其他说明"
          rows={5}
          value={value}
        />
      </div>
    </Drawer>
  )
}
