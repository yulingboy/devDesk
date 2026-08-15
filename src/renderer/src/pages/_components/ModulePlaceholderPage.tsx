import { Construction } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getRoute } from '@/routes'

/** 为尚未接入业务逻辑的路由提供统一页面结构。 */
export function ModulePlaceholderPage({ routePath }: { routePath: string }): React.JSX.Element {
  const route = getRoute(routePath)
  const Icon = route.icon

  return (
    <div className="mx-auto flex max-w-5xl flex-1 items-start px-8 py-10">
      <Card className="w-full">
        <CardContent className="p-8 pt-8">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#edf8f3] text-[#1f845a]">
            <Icon aria-hidden="true" size={20} />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-[#202123]">{route.label}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#777b80]">
            此模块正在建设中，基础路由已经就绪，后续功能会在这里逐步接入。
          </p>
          <Badge className="mt-6 gap-2" variant="secondary">
            <Construction aria-hidden="true" size={14} />
            即将推出
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}
