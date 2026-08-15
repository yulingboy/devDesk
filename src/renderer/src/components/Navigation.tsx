import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { appRoutes } from '@/routes'

/** 左侧导航默认使用参考项目的 64px 图标模式，同时保留用户要求的展开能力。 */
export function Navigation({ appVersion }: { appVersion: string }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-slate-100 bg-white text-slate-800 transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-[220px]'
      )}
    >
      <div
        className={cn('flex h-13 items-center px-3', collapsed ? 'justify-center' : 'justify-end')}
      >
        <Button
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          className={cn('text-slate-400', collapsed && 'w-10')}
          onClick={() => setCollapsed((value) => !value)}
          size="icon"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </Button>
      </div>

      <nav aria-label="主导航" className="flex-1 space-y-0.5 overflow-y-auto px-1.5 py-1">
        {/* 路由元数据是导航的唯一来源，展开与收起状态共享同一组选中规则。 */}
        {appRoutes.map(({ path, label, icon: Icon }) => (
          <NavLink
            aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex h-10 w-full items-center rounded-lg text-[13px] transition-colors',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive
                  ? 'bg-[var(--theme-lighter)] font-medium text-[var(--accent)]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
            end={path === '/'}
            key={path}
            title={collapsed ? label : undefined}
            to={path}
          >
            <Icon aria-hidden="true" className="shrink-0" size={17} strokeWidth={1.8} />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-2">
        <Button
          aria-label="帮助与反馈"
          className={cn(collapsed ? 'w-full px-0' : 'w-full justify-start px-3')}
          size="sm"
          title="帮助与反馈"
          variant="ghost"
        >
          <CircleHelp size={16} />
          {!collapsed && <span>帮助与反馈</span>}
        </Button>
        <div
          className={cn(
            'mt-1 flex h-8 items-center text-[11px] text-slate-400',
            collapsed ? 'justify-center' : 'justify-between px-3'
          )}
        >
          <span className="size-2 rounded-full bg-emerald-500" title="本地服务已就绪" />
          {!collapsed && <span>本地模式 · v{appVersion}</span>}
        </div>
      </div>
    </aside>
  )
}
