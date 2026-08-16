import type { LucideIcon } from 'lucide-react'
import { Braces, Cpu, HardDrive, MemoryStick } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { SystemOverviewSnapshot } from '@shared/domain'
import { Skeleton } from '@/components/ui/skeleton'

const overviewItems: Array<{ label: string; value: string; detail: string; icon: LucideIcon }> = [
  { label: 'CPU', value: '--', detail: '等待采样', icon: Cpu },
  { label: '内存', value: '--', detail: '等待采样', icon: MemoryStick },
  { label: '磁盘', value: '--', detail: '等待采样', icon: HardDrive },
  { label: 'Node 版本', value: '--', detail: '等待检测', icon: Braces }
]

export function OverviewCards({
  snapshot
}: {
  snapshot: SystemOverviewSnapshot | null
}): React.JSX.Element {
  const items = overviewItems.map((item) => {
    if (item.label === 'CPU' && snapshot)
      return {
        ...item,
        value: `${snapshot.cpu.usagePercent}%`,
        detail: `${snapshot.cpu.cores} 核 · ${snapshot.cpu.model}`
      }
    if (item.label === '内存' && snapshot)
      return { ...item, value: `${snapshot.memory.usedPercent}%`, detail: '当前已使用' }
    if (item.label === '磁盘' && snapshot) {
      const used = snapshot.disks.length
        ? Math.round(
            snapshot.disks.reduce((total, disk) => total + disk.usedPercent, 0) /
              snapshot.disks.length
          )
        : 0
      return {
        ...item,
        value: `${used}%`,
        detail: snapshot.disks.length ? '磁盘平均已使用' : '未发现磁盘'
      }
    }
    if (item.label === 'Node 版本' && snapshot?.nodeVersion)
      return { ...item, value: snapshot.nodeVersion.replace(/^v/, ''), detail: '当前运行版本' }
    return item
  })
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      {items.map(({ label, value, detail, icon: Icon }) => (
        <Card className="p-3" key={label}>
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <div className="grid size-7 place-items-center rounded-md bg-[var(--theme-lighter)] text-[var(--accent)]">
              <Icon aria-hidden="true" />
            </div>
          </div>
          {!snapshot ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-lg font-semibold text-slate-800">{value}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
        </Card>
      ))}
    </div>
  )
}
