import type { LucideIcon } from 'lucide-react'
import { Braces, FolderKanban, GitBranch, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { SystemOverviewSnapshot } from '@shared/domain'
import { Skeleton } from '@/components/ui/skeleton'

const overviewItems: Array<{ label: string; value: string; detail: string; icon: LucideIcon }> = [
  { label: '工作区', value: '0', detail: '尚未配置', icon: FolderKanban },
  { label: 'Git 身份', value: '0', detail: '尚未配置', icon: GitBranch },
  { label: 'SSH 密钥', value: '0', detail: '等待扫描', icon: KeyRound },
  { label: 'Node 版本', value: '--', detail: '等待检测', icon: Braces }
]

export function OverviewCards({
  snapshot,
  counts
}: {
  snapshot: SystemOverviewSnapshot | null
  counts?: { workspaces: number; identities: number; keys: number }
}): React.JSX.Element {
  const items = overviewItems.map((item) => {
    if (item.label === '工作区' && counts)
      return {
        ...item,
        value: String(counts.workspaces),
        detail: counts.workspaces ? '已配置' : '尚未配置'
      }
    if (item.label === 'Git 身份' && counts)
      return {
        ...item,
        value: String(counts.identities),
        detail: counts.identities ? '已配置' : '尚未配置'
      }
    if (item.label === 'SSH 密钥' && counts)
      return { ...item, value: String(counts.keys), detail: counts.keys ? '已发现' : '等待扫描' }
    if (item.label === 'Node 版本' && snapshot?.nodeVersion)
      return { ...item, value: snapshot.nodeVersion.replace(/^v/, ''), detail: '当前运行版本' }
    return item
  })
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map(({ label, value, detail, icon: Icon }) => (
        <Card className="p-4" key={label}>
          <div className="mb-5 flex items-start justify-between">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <div className="grid size-8 place-items-center rounded-lg bg-[var(--theme-lighter)] text-[var(--accent)]">
              <Icon aria-hidden="true" size={17} />
            </div>
          </div>
          {(label === 'Node 版本' && !snapshot) || (label !== 'Node 版本' && !counts) ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-2xl font-semibold text-slate-800">{value}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </Card>
      ))}
    </div>
  )
}
