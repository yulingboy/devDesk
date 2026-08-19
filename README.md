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

## GitHub 发布与自动更新

仓库已配置 GitHub Actions。推送符合 `v*.*.*` 的版本标签后，Actions 会在 macOS、Windows 和 Linux 上分别打包，并将安装包与更新描述文件发布到 `yulingboy/devDesk` 的 GitHub Release：

```bash
pnpm version patch --no-git-tag-version
git add package.json pnpm-lock.yaml
git commit -m "chore: 发布 v1.0.1"
git tag v1.0.1
git push origin main --tags
```

应用打包后会在启动约 8 秒后后台检查 GitHub Release。检查、下载和安装都可在“设置 > 关于 > 应用更新”中手动操作；下载完成后点击“重启并安装”才会退出应用。

发布前请确认仓库默认分支可正常使用 `GITHUB_TOKEN` 写入 Release。当前 macOS 配置允许生成未签名测试包，但正式自动更新建议在 GitHub Actions 中配置 `CSC_LINK`、`CSC_KEY_PASSWORD` 和 Apple notarization 所需凭据，否则 macOS 可能因 Gatekeeper 或签名校验阻止安装。

开发模式不会请求 GitHub，也不会显示可用更新。

## 项目结构

- `src/main`：Electron 主进程入口
- `src/main/app`：应用生命周期、托盘和运行状态
- `src/main/ipc`：IPC 注册、来源校验和业务处理器
- `src/main/windows`：主窗口创建、状态监听和窗口池
- `src/main/infrastructure`：日志、数据存储、应用目录和 Shell 环境服务
- `src/main/services`：按业务领域划分的主进程服务
- `src/main/workers`：独立运行的后台任务
- `src/preload`：类型安全的渲染层桥接
- `src/renderer`：React 19 渲染层
- `src/renderer/src/components/app`：应用壳、导航、标题栏和根级错误处理
- `src/renderer/src/components/common`：跨页面复用的业务无关组件
- `src/renderer/src/components/project`：项目创建等跨模块项目工作流组件
- `src/renderer/src/components/ui`：基于 shadcn/ui 约定维护的本地 Button、Badge、Card、Separator 组件
- `src/renderer/src/routes.tsx`：路由元数据与导航配置
- `src/renderer/src/pages/<route>`：每个路由独立维护页面入口、组件和 Hooks
- `src/shared`：主进程、预加载与渲染层共享的领域模型和 IPC 契约
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
