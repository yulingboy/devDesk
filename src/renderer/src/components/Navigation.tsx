import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ChevronDown,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { appRoutes } from '@/routes'

export function Navigation({ appVersion }: { appVersion: string }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-[#e2e3e4] bg-[#f7f7f5] text-[#202123] transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-[248px]'
      )}
    >
      <div
        className={cn(
          'flex h-[52px] items-center px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <Button className="px-2 text-sm font-semibold" variant="ghost">
            <span className="grid size-6 place-items-center rounded-md bg-[#202123] text-white">
              工
            </span>
            <span>开发工坊</span>
            <ChevronDown aria-hidden="true" className="text-[#85878a]" size={14} />
          </Button>
        )}
        <Button
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          className="text-[#62666a]"
          onClick={() => setCollapsed((value) => !value)}
          size="icon"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          variant="ghost"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" size={17} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={17} />
          )}
        </Button>
      </div>

      {!collapsed && (
        <div className="px-5 pb-2 pt-3 text-[11px] font-medium tracking-[0.08em] text-[#919397]">
          工作台
        </div>
      )}
      <nav aria-label="主导航" className="flex-1 space-y-0.5 px-2">
        <Button
          className={cn(
            'mb-1 text-[#62666a]',
            collapsed ? 'w-full justify-center px-0' : 'w-full justify-start px-3'
          )}
          size="sm"
          title="新建工作区"
          variant="ghost"
        >
          <Plus aria-hidden="true" size={16} />
          <span className={cn(collapsed && 'sr-only')}>新建工作区</span>
        </Button>

        {/* 导航项与路由元数据共用，避免菜单和路由路径出现分叉。 */}
        {appRoutes.map(({ path, label, icon: Icon }) => (
          <NavLink
            aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex h-9 w-full items-center rounded-md text-[13px] transition-colors',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive
                  ? 'bg-[#e7e7e5] font-medium text-[#202123]'
                  : 'text-[#62666a] hover:bg-[#ededeb] hover:text-[#202123]'
              )
            }
            end={path === '/'}
            key={path}
            title={collapsed ? label : undefined}
            to={path}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-[#e2e3e4] p-3">
        <Button
          aria-label="帮助与反馈"
          className={cn(
            'text-[#62666a]',
            collapsed ? 'w-full justify-center px-0' : 'w-full justify-start px-3'
          )}
          size="sm"
          title="帮助与反馈"
          variant="ghost"
        >
          <CircleHelp aria-hidden="true" size={15} />
          <span className={cn(collapsed && 'sr-only')}>帮助与反馈</span>
        </Button>
        <Button
          aria-label="系统设置"
          className={cn(
            'text-[#62666a]',
            collapsed ? 'w-full justify-center px-0' : 'w-full justify-start px-3'
          )}
          size="sm"
          title="系统设置"
          variant="ghost"
        >
          <Settings2 aria-hidden="true" size={15} />
          <span className={cn(collapsed && 'sr-only')}>系统设置</span>
        </Button>
        <div
          className={cn(
            'mt-2 flex items-center rounded-md py-2 text-xs text-[#7b7e82]',
            collapsed ? 'justify-center' : 'justify-between px-3'
          )}
        >
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#2da66b]" />
            <span className={cn(collapsed && 'sr-only')}>本地模式</span>
          </span>
          <span className={cn(collapsed && 'sr-only')}>v{appVersion}</span>
        </div>
      </div>
    </aside>
  )
}
