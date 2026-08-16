import { NavLink, useLocation } from 'react-router-dom'
import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { appRoutes } from '@/routes'

/** 左侧导航默认使用参考项目的 64px 图标模式，同时保留用户要求的展开能力。 */
export function Navigation({ appVersion }: { appVersion: string }): React.JSX.Element {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="justify-end">
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="主导航">
          <SidebarMenu>
            {appRoutes.map(({ path, label, icon: Icon }) => {
              const isActive = path === '/' ? pathname === path : pathname.startsWith(path)
              return (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                    <NavLink aria-label={label} end={path === '/'} to={path}>
                      <Icon aria-hidden="true" className="shrink-0" />
                      <span className="min-w-0 truncate" data-sidebar="label">
                        {label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenuButton tooltip="帮助与反馈">
          <CircleHelp />
          <span className="truncate" data-sidebar="label">
            帮助与反馈
          </span>
        </SidebarMenuButton>
        <div className="mt-1 flex h-7 items-center justify-center gap-2 px-2.5 text-[10px] text-slate-400">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="size-2 rounded-full bg-emerald-500" />
            </TooltipTrigger>
            <TooltipContent side="right">本地服务已就绪</TooltipContent>
          </Tooltip>
          <span className="truncate" data-sidebar="label">
            本地模式 · v{appVersion}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
