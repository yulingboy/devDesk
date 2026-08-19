import { Plus, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResourcePanel } from '@/components/common/ResourcePanel'
import { SearchInput } from '@/components/common/SearchInput'

export function SshToolbar({
  query,
  refreshing,
  onQueryChange,
  onManual,
  onGenerate,
  onRefresh,
  children
}: {
  query: string
  refreshing: boolean
  onQueryChange: (value: string) => void
  onManual: () => void
  onGenerate: () => void
  onRefresh: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <ResourcePanel
      actions={
        <div className="flex items-center gap-1">
          <Button onClick={onManual} size="sm" variant="secondary">
            <Plus size={14} />
            录入公钥
          </Button>
          <Button onClick={onGenerate} size="sm" variant="success">
            <Sparkles size={14} />
            生成密钥
          </Button>
          <Button loading={refreshing} onClick={onRefresh} size="sm" variant="outline">
            <RefreshCw size={15} />
            刷新
          </Button>
        </div>
      }
      contentClassName="space-y-4 pt-5"
      description="只读取和保存公钥、指纹与私钥路径，不会保存私钥内容。"
      headerClassName="border-b border-slate-100"
      title="SSH 密钥"
    >
      <SearchInput onValueChange={onQueryChange} placeholder="搜索名称、指纹或公钥" value={query} />
      {children}
    </ResourcePanel>
  )
}
