import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function GitGlobalPanel({
  username,
  email,
  sourceFile,
  onEdit,
  onCreateIdentity
}: {
  username: string
  email: string
  sourceFile?: string
  onEdit: () => void
  onCreateIdentity: () => void
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <CardTitle>全局 Git 配置</CardTitle>
        <div className="flex items-center gap-2">
          <CardDescription>来源文件：{sourceFile ?? '读取中'}</CardDescription>
          <Button onClick={onCreateIdentity} variant="success">
            <Plus size={14} /> 新增配置
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">{username || '未配置用户名'}</span>
          <span className="mx-2 text-slate-300">·</span>
          {email || '未配置邮箱'}
        </div>
        <Button onClick={onEdit} variant="secondary">
          <Pencil size={15} /> 编辑全局配置
        </Button>
      </CardContent>
    </Card>
  )
}
