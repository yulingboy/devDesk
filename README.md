# DevDesk

基于 Electron、electron-vite、React 19 和 Tailwind CSS v4 的本机开发环境管理工具。

## 已实现功能

- 系统概览：CPU、内存、磁盘、网络、运行时与目录信息，30 秒后台采样。
- Hosts：受管区块、增删改查、启用禁用、备份恢复、DNS 刷新和域名访问。
- SSH：自动发现、手动录入、编辑、ed25519/RSA 4096 生成、指纹和关联删除。
- Git：真实全局配置、多身份、SSH 绑定、profile、工作区 includeIf 规则和文件查看。
- 工作区：身份绑定、首层扫描、Git 状态、目录打开和 VS Code 打开。
- 模板：Git 浅克隆、本地复制、编辑删除、失败回滚和项目清单同步。
- Node：版本索引、nvm 安装/切换/删除、任务状态流、镜像测速切换、包管理器、全局包和缓存管理。
- 设置：固定 Codex 浅色主题、开机自启、系统托盘、数据导入导出、日志级别、开发者工具和运行时信息。

## 环境要求

- Node.js 22 或更高版本
- pnpm 11

## 开发命令

```bash
pnpm install
pnpm dev
```

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 打包

```bash
pnpm build:mac
pnpm build:win
pnpm build:linux
```

## 项目结构

- `src/main`：Electron 主进程
- `src/main/lifecycle.ts`：应用生命周期和单实例恢复
- `src/main/window.ts`：窗口创建、安全导航和状态监听
- `src/main/window-pool.ts`：按业务名称复用和集中关闭应用窗口
- `src/main/ipc-handlers.ts`：应用与窗口 IPC 处理器
- `src/main/infrastructure`：日志、IPC 校验和应用目录服务
- `src/preload`：类型安全的渲染层桥接
- `src/renderer`：React 19 渲染层
- `src/renderer/src/components/AppHeader.tsx`：跨平台自定义标题栏与窗口控制。macOS 保留原生红黄绿交通灯，Windows/Linux 使用右侧自定义按钮
- `src/renderer/src/components/AppErrorBoundary.tsx`：根级渲染错误降级
- `src/renderer/src/components/ui`：基于 shadcn/ui 约定维护的本地 Button、Badge、Card、Separator 组件
- `src/renderer/src/routes.tsx`：路由元数据与导航配置
- `src/renderer/src/pages/<route>/index.tsx`：每个路由独立目录和页面入口
- `src/renderer/src/pages/_components`：仅供路由页面复用的页面级组件
- `electron.vite.config.ts`：electron-vite 与 Tailwind CSS v4 配置
- `components.json`：shadcn/ui 组件生成和路径别名配置
- `electron-builder.yml`：桌面应用打包配置

## 日志

主进程、IPC 请求、渲染进程崩溃和 React 未捕获错误统一写入 Electron `userData/logs/main.log`。单个日志文件最大 5 MB，渲染层只能通过受限 preload API 上报日志。

导入会校验备份结构；写入失败会自动回滚。发现损坏的 JSON 数据文件时，应用会将其重命名为 `.corrupt` 文件保留在原目录，并以安全默认值继续启动。

## 路径别名

- `@/*`、`@renderer/*`：渲染层源码
- `@shared/*`：主进程、预加载与渲染层共享类型和 IPC 定义
- `@main/*`：主进程源码

路由使用 `HashRouter`，适配 Electron 打包后的本地 `file://` 页面。
