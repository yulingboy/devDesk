import { Slot } from '@radix-ui/react-slot'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { createContext, useContext, useMemo, useState } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/** shadcn Sidebar 的状态容器，统一管理桌面端收起与展开。 */
export function SidebarProvider({
  children,
  defaultOpen = true
}: {
  children: ReactNode
  defaultOpen?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  const value = useMemo(
    () => ({ open, setOpen, toggleSidebar: () => setOpen((value) => !value) }),
    [open]
  )
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) throw new Error('useSidebar 必须在 SidebarProvider 内使用。')
  return context
}

export function Sidebar({
  children,
  className,
  collapsible = 'icon',
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode
  collapsible?: 'icon' | 'none'
}): React.JSX.Element {
  const { open } = useSidebar()
  return (
    <aside
      className={cn(
        'group/sidebar flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-700 transition-[width] duration-150',
        open || collapsible === 'none' ? 'w-[196px]' : 'w-14',
        className
      )}
      data-collapsible={open ? '' : collapsible}
      data-sidebar="sidebar"
      data-state={open ? 'expanded' : 'collapsed'}
      {...props}
    >
      {children}
    </aside>
  )
}

export function SidebarHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn('flex h-11 shrink-0 items-center justify-between gap-2 px-2.5', className)}
      data-sidebar="header"
      {...props}
    />
  )
}

/** shadcn Sidebar 的折叠开关，图标和提示随当前状态自动变化。 */
export function SidebarTrigger({ className }: { className?: string }): React.JSX.Element {
  const { open, toggleSidebar } = useSidebar()
  const label = open ? '收起侧边栏' : '展开侧边栏'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200',
            className
          )}
          onClick={toggleSidebar}
          type="button"
        >
          {open ? <PanelLeftClose /> : <PanelLeftOpen />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function SidebarContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-1.5 py-1', className)} {...props} />
}

export function SidebarFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('shrink-0 border-t border-slate-100 p-1.5', className)} {...props} />
}

export function SidebarMenu({
  className,
  ...props
}: HTMLAttributes<HTMLUListElement>): React.JSX.Element {
  return <ul className={cn('space-y-0.5', className)} {...props} />
}

export function SidebarMenuItem({
  className,
  ...props
}: HTMLAttributes<HTMLLIElement>): React.JSX.Element {
  return <li className={className} {...props} />
}

interface SidebarMenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string
}

/** shadcn Sidebar 菜单按钮，折叠时只展示图标，并以 Tooltip 补充标签。 */
export function SidebarMenuButton({
  asChild = false,
  className,
  isActive = false,
  tooltip,
  ...props
}: SidebarMenuButtonProps): React.JSX.Element {
  const { open } = useSidebar()
  const Comp = asChild ? Slot : 'button'
  const button = (
    <Comp
      className={cn(
        'relative flex h-9 w-full items-center rounded-md text-xs text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-200 data-[active=true]:bg-blue-50 data-[active=true]:font-medium data-[active=true]:text-blue-600',
        open ? 'gap-2.5 px-2.5' : 'justify-center px-0',
        className
      )}
      data-active={isActive}
      {...props}
    />
  )

  if (!tooltip || open) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
