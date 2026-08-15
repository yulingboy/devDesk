import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const quickStartItems = ['扫描 SSH 密钥', '创建 Git 身份', '添加工作区']

export function QuickStart(): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="border-b border-slate-100">
        <CardTitle>快速开始</CardTitle>
        <CardDescription>完成基础环境配置</CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        {quickStartItems.map((label) => (
          <Button
            className="h-7 w-full justify-between px-2 text-left text-[11px] text-slate-600"
            key={label}
            type="button"
            variant="ghost"
          >
            <span>{label}</span>
            <ChevronRight aria-hidden="true" className="text-slate-400" />
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
