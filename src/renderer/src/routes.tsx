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
  { path: '/', label: '首页', description: '当前设备与开发环境状态', icon: House },
  { path: '/hosts', label: 'Host 管理', description: '管理本机 Host 映射', icon: Network },
  { path: '/git', label: 'Git 配置', description: '维护 Git 身份与仓库配置', icon: GitBranch },
  { path: '/ssh', label: 'SSH 密钥', description: '查看和管理 SSH 密钥', icon: KeyRound },
  {
    path: '/workspaces',
    label: '工作区',
    description: '统一管理本地项目工作区',
    icon: FolderKanban
  },
  { path: '/templates', label: '项目模板', description: '复用常用项目初始化模板', icon: Boxes },
  { path: '/node', label: 'Node 管理', description: '查看 Node.js 运行环境', icon: Braces },
  { path: '/settings', label: '系统设置', description: '调整应用行为与数据目录', icon: Settings }
]

export function getRoute(pathname: string): AppRoute {
  return appRoutes.find((route) => route.path === pathname) ?? appRoutes[0]
}
