import { Check, ChevronRight, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface QuickStartProps {
  status?: {
    sshReady: boolean
    gitReady: boolean
    workspaceReady: boolean
    nodeReady: boolean
  }
}

const quickStartItems = [
  { key: 'sshReady', label: '扫描 SSH 密钥', to: '/ssh' },
  { key: 'gitReady', label: '创建 Git 身份', to: '/git' },
  { key: 'workspaceReady', label: '添加工作区', to: '/workspaces' },
  { key: 'nodeReady', label: '确认 Node 运行时', to: '/node' }
] as const

/** 首页依据本机真实配置显示下一步，避免固定引导和当前状态脱节。 */
export function QuickStart({ status }: QuickStartProps): React.JSX.Element {
  const sortedItems = [...quickStartItems].sort((left, right) => {
    const leftDone = status?.[left.key] ?? false
    const rightDone = status?.[right.key] ?? false
    return Number(leftDone) - Number(rightDone)
  })
  const completed = quickStartItems.filter((item) => status?.[item.key]).length
  return (
    <Card>
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>快速开始</CardTitle>
          <span className="text-[11px] text-slate-400">
            {completed}/{quickStartItems.length}
          </span>
        </div>
        <CardDescription>根据当前本机环境生成</CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        {sortedItems.map(({ key, label, to }) => {
          const done = status?.[key] ?? false
          return (
            <Button
              asChild
              className="h-7 w-full justify-between px-2 text-left text-[11px] text-slate-600"
              key={to}
              variant="ghost"
            >
              <Link to={to}>
                <span className="flex items-center gap-2">
                  {done ? (
                    <span className="grid size-4 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check size={11} />
                    </span>
                  ) : (
                    <Circle className="size-3.5 text-slate-300" />
                  )}
                  <span className={done ? 'text-slate-400 line-through' : ''}>{label}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-3.5 text-slate-400" />
              </Link>
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}
