import type { LucideIcon } from 'lucide-react'
import { Braces, FolderKanban, GitBranch, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/card'

const overviewItems: Array<{ label: string; value: string; detail: string; icon: LucideIcon }> = [
  { label: '工作区', value: '0', detail: '尚未配置', icon: FolderKanban },
  { label: 'Git 身份', value: '0', detail: '尚未配置', icon: GitBranch },
  { label: 'SSH 密钥', value: '0', detail: '等待扫描', icon: KeyRound },
  { label: 'Node 版本', value: '--', detail: '等待检测', icon: Braces }
]

export function OverviewCards(): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {overviewItems.map(({ label, value, detail, icon: Icon }) => (
        <Card className="p-4" key={label}>
          <div className="mb-5 flex items-start justify-between">
            <p className="text-sm font-medium text-[#55595e]">{label}</p>
            <Icon aria-hidden="true" className="text-[#85878a]" size={18} />
          </div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-[#85878a]">{detail}</p>
        </Card>
      ))}
    </div>
  )
}
