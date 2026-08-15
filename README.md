# 开发工坊

基于 Electron、electron-vite、React 19 和 Tailwind CSS v4 的本机开发环境管理工具。

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
- `src/preload`：类型安全的渲染层桥接
- `src/renderer`：React 19 渲染层
- `electron.vite.config.ts`：electron-vite 与 Tailwind CSS v4 配置
- `electron-builder.yml`：桌面应用打包配置
