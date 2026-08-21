import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  Braces,
  FolderKanban,
  GitBranch,
  House,
  KeyRound,
  Network,
  Settings
} from 'lucide-react'

export interface AppRoute {
  path: string
  label: string
  description: string
  icon: LucideIcon
}

// 路由元数据同时驱动侧栏和页面标题，新增模块时只需维护这一处。
export const appRoutes: AppRoute[] = [
  { path: '/', label: '概览', description: '设备与系统状态', icon: House },
  {
    path: '/workspaces',
    label: '工作区',
    description: '扫描、创建并运行本地项目',
    icon: FolderKanban
  },
  { path: '/templates', label: '项目模板', description: '为工作区创建项目', icon: Boxes },
  { path: '/node', label: 'Node 管理', description: '为项目准备 Node.js 运行环境', icon: Braces },
  { path: '/git', label: 'Git 配置', description: '为工作区应用 Git 身份', icon: GitBranch },
  { path: '/ssh', label: 'SSH 密钥', description: '为 Git 身份提供认证密钥', icon: KeyRound },
  { path: '/hosts', label: 'Host 管理', description: '管理本机 Host 映射', icon: Network },
  { path: '/settings', label: '系统设置', description: '调整应用行为与数据目录', icon: Settings }
]

export function getRoute(pathname: string): AppRoute {
  return appRoutes.find((route) => route.path === pathname) ?? appRoutes[0]
}
