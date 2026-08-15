import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { TooltipButton } from '@/components/TooltipButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { appRoutes } from '@/routes'

/** 左侧导航默认使用参考项目的 64px 图标模式，同时保留用户要求的展开能力。 */
export function Navigation({ appVersion }: { appVersion: string }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-slate-100 bg-white text-slate-800 transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-[196px]'
      )}
    >
      <div
        className={cn('flex h-11 items-center px-2', collapsed ? 'justify-center' : 'justify-end')}
      >
        <TooltipButton
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          className={cn('text-slate-400', collapsed && 'w-8')}
          onClick={() => setCollapsed((value) => !value)}
          size="icon"
          tooltip={collapsed ? '展开侧边栏' : '收起侧边栏'}
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </TooltipButton>
      </div>

      <nav aria-label="主导航" className="flex-1 space-y-0.5 overflow-y-auto px-1.5 py-1">
        {/* 路由元数据是导航的唯一来源，展开与收起状态共享同一组选中规则。 */}
        {appRoutes.map(({ path, label, icon: Icon }) => (
          <Tooltip key={path}>
            <TooltipTrigger asChild>
              <NavLink
                aria-label={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 w-full items-center rounded-md text-xs transition-colors',
                    collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                    isActive
                      ? 'bg-[var(--theme-lighter)] font-medium text-[var(--accent)]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )
                }
                end={path === '/'}
                to={path}
              >
                <Icon aria-hidden="true" className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
          </Tooltip>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-2">
        <TooltipButton
          aria-label="帮助与反馈"
          className={cn(collapsed ? 'w-full px-0' : 'w-full justify-start px-3')}
          size="sm"
          tooltip="帮助与反馈"
          variant="ghost"
        >
          <CircleHelp size={16} />
          {!collapsed && <span>帮助与反馈</span>}
        </TooltipButton>
        <div
          className={cn(
            'mt-1 flex h-8 items-center text-[11px] text-slate-400',
            collapsed ? 'justify-center' : 'justify-between px-3'
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="size-2 rounded-full bg-emerald-500" />
            </TooltipTrigger>
            <TooltipContent side="right">本地服务已就绪</TooltipContent>
          </Tooltip>
          {!collapsed && <span>本地模式 · v{appVersion}</span>}
        </div>
      </div>
    </aside>
  )
}
