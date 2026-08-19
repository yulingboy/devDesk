import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'

export function WorkspaceEmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <FolderKanban size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800">工作区</p>
            <p className="mt-0.5 text-[10px] text-slate-400">集中管理项目目录与 Git 身份</p>
          </div>
        </div>
        <Button onClick={onCreate} variant="success">
          <Plus />
          新增工作区
        </Button>
      </div>
      <Empty className="min-h-0 flex-1 rounded-none border-0 bg-white">
        <EmptyTitle>还没有工作区</EmptyTitle>
        <EmptyDescription>新增一个项目根目录，即可扫描其中的一级项目。</EmptyDescription>
        <Button className="mt-3" onClick={onCreate} variant="outline">
          <Plus />
          新增工作区
        </Button>
      </Empty>
    </div>
  )
}
