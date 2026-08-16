import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const quickStartItems = [
  { label: '扫描 SSH 密钥', to: '/ssh' },
  { label: '创建 Git 身份', to: '/git' },
  { label: '添加工作区', to: '/workspaces' }
]

export function QuickStart(): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="border-b border-slate-100">
        <CardTitle>快速开始</CardTitle>
        <CardDescription>完成基础环境配置</CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        {quickStartItems.map(({ label, to }) => (
          <Button
            asChild
            className="h-7 w-full justify-between px-2 text-left text-[11px] text-slate-600"
            key={to}
            variant="ghost"
          >
            <Link to={to}>
              <span>{label}</span>
              <ChevronRight aria-hidden="true" className="text-slate-400" />
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
