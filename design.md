# DevDesk 技术设计基线

> 版本：2.0
> 更新时间：2026-08-20

## 1. 架构

DevDesk 使用 Electron 三进程边界：

```text
React Renderer
    │ window.api（类型化 Promise + 事件订阅）
Preload Bridge
    │ ipcRenderer.invoke / ipcRenderer.on
Electron Main
    ├── IPC 参数校验
    ├── 领域服务
    ├── JSON 数据存储
    ├── 系统命令与文件系统
    └── Node 安装 Worker
```

- Renderer：React 19、React Router、Tailwind CSS v4、shadcn/ui、Recharts。
- Preload：只暴露 `AppApi`，不暴露 Electron 或 Node 原始对象。
- Main：持有文件、命令、窗口、更新和所有业务写入权限。
- Worker：执行 Node 安装包下载、校验和解压，避免阻塞主进程。

## 2. 目录边界

```text
src/main/app/              应用生命周期和托盘
src/main/infrastructure/   存储、日志、路径、Shell 环境
src/main/ipc/              IPC 注册和输入校验
src/main/services/         领域服务
src/main/windows/          主窗口与窗口池
src/main/workers/          Node 安装 Worker
src/preload/               安全桥接
src/renderer/src/pages/    路由页面及页面私有组件
src/renderer/src/components/common/  跨页面业务组件
src/renderer/src/components/ui/      shadcn/ui 基础组件
src/shared/                领域模型、IPC channel 和 AppApi
tests/                     统一测试目录
```

页面入口负责组合区域和抽屉；只被单页使用的状态与操作留在该路由目录。组件自行完成与其职责紧密相关的轻量操作，避免把所有点击处理逐层传到页面入口。

## 3. 数据模型

主要关系：

```text
SSHKey 1 <- 0..n GitIdentity 1 <- 0..n Workspace
Workspace 1 <- 0..n Project 1 <- 0..n WorkspaceSubproject
ProjectTemplate -> Project / WorkspaceSubproject
```

- `Workspace.projects` 只保存一级项目。
- `Project.subprojects` 保存递归发现的独立工程，界面不平铺到一级列表。
- 项目不保存 Node 依赖、脚本或任务状态。
- 工作区保存 `scanDepth` 和 `ignoredDirectories`。
- Git 配置实际生效值按需从真实仓库读取，不持久化诊断结果。

## 4. 本地存储

| 文件                            | 内容                          |
| ------------------------------- | ----------------------------- |
| `settings.json`                 | 应用设置和业务数据目录指针    |
| `hosts.json`                    | DevDesk 受管 Hosts 记录       |
| `hosts.backup`                  | 首次写入前的系统 Hosts 备份   |
| `ssh-keys.json`                 | SSH 公钥元数据，不含私钥      |
| `git-configs.json`              | Git 身份                      |
| `workspaces.json`               | 工作区、一级项目和子项目      |
| `templates.json`                | 项目模板                      |
| `node-manager.json`             | Node 状态、缓存快照和任务     |
| `node-releases.json`            | Node 版本索引缓存             |
| `system-overview-snapshot.json` | 最近一次系统采样              |
| `system-overview-history.json`  | 最近 48 个系统采样            |
| `git-rules/`                    | Git profile 和 includeIf 规则 |

同一数据文件的写入按目标路径串行化，每次使用唯一临时文件并通过 rename 提交。跨文件导入和数据目录迁移使用可重入全局数据锁。损坏 JSON 会被重命名为带时间戳的 `.corrupt` 文件。

schema 当前为 v2。导入先按 `v1 -> v2 -> ...` 顺序迁移，再验证和写入；失败时恢复导入前完整快照。设备相关的数据目录路径不会从备份覆盖当前机器的运行时指针。

## 5. 工作区发现

工作区根目录下每个非隐藏一级目录都是一级项目，不要求存在语言标记文件。一级项目内部按广度逐层发现子项目：

1. 应用内置忽略 `node_modules`、构建产物、虚拟环境等目录。
2. 叠加工作区自定义忽略目录。
3. 扫描深度限制为 1 至 5，默认 3。
4. 命中 `.git`、`package.json`、`pom.xml`、`pyproject.toml`、`go.mod` 等标记后停止该分支下钻。
5. 一级候选和子目录检查均有预算；超限返回 `truncated`。
6. 用户取消后停止发现新目录，不写入部分扫描结果。
7. 手动纳入的外部项目和模板创建的无标记子项目在后续扫描中保留。

项目 Git 扫描只读取当前界面消费的分支、脏状态、仓库/远程状态和错误，不执行提交日志或上下游差异等无用命令。

## 6. Git 与 SSH

每个 Git 身份生成一个 profile。统一 include 文件按工作区根路径生成 `includeIf gitdir` 规则，全局 `.gitconfig` 只维护这一受管入口。

“验证实际配置”从工作区选择真实 Git 仓库，并执行：

```text
git -C <project> config --show-origin --get user.name
git -C <project> config --show-origin --get user.email
git -C <project> config --show-origin --get core.sshCommand
```

结果展示预期值、实际值和来源文件，用于发现 include 顺序、路径规则或本地配置覆盖。私钥内容从不写入业务 JSON。

## 7. Node 下载与安装

- 版本列表直接请求配置的 `index.json`，缓存记录来源 URL，避免不同镜像缓存互相污染。
- 公网下载源必须使用 HTTPS；HTTP 仅允许回环地址。
- 下载源测试验证索引结构、当前平台安装包和 `SHASUMS256.txt`。
- 安装 Worker 下载包和同目录校验表并校验 SHA256。
- 同源 SHA256 只证明一致性，不构成发布者真实性证明，UI 必须提示信任边界。
- 安装目标使用临时目录，失败或取消时回滚；完成后再提交最终版本目录。
- nvm/nrm 能力由主进程真实命令探测决定，渲染层不猜测。

## 8. Hosts

系统 Hosts 中只有 DevDesk 标记区块由应用维护。首次读取时：

- 受管区块进入主列表。
- 系统已有有效映射进入独立预览。
- 用户确认导入后才把系统映射移入受管区块。

macOS 通过系统授权写入 `/etc/hosts`；其他平台直接写入失败时返回管理员权限提示。首次写入前创建备份。

## 9. IPC 与错误

- `src/shared/ipc.ts` 是 channel 唯一来源。
- `src/shared/types.ts` 是 preload API 契约。
- 所有来自 Renderer 的对象在 `handlers.ts` 重新解析和限制长度。
- Main 抛出的内部错误由 IPC registry 转换为稳定中文错误。
- Renderer 统一使用页面反馈 Hook 和 Sonner 展示失败与成功，不静默吞掉按钮操作。
- 系统概览、窗口、Node 任务和数据变更使用 `ipcRenderer.on` 事件订阅；普通请求使用 `invoke`。

## 10. 发布

Release 工作流顺序：

```text
lint + typecheck + test + diff check
                 ↓
      macOS / Windows / Linux build
                 ↓
      artifact verification + GitHub Release
```

macOS 开启 hardened runtime、Developer ID 签名和 notarization。CI 从 GitHub Secrets 读取证书与 App Store Connect API Key，不允许把证书或私钥提交到仓库。

## 11. 验证策略

- 单元测试：数据写队列、迁移、工作区发现/层级、Git 生效验证、下载源策略、SSH 绑定和模板回滚。
- 服务测试：Hosts 解析与导入、Node 安装和任务状态、Git 规则同步、设置目录迁移。
- 页面测试：加载、空态、抽屉编辑、确认操作和失败反馈。
- 发布回归：三平台产物结构，以及 macOS 旧版本到新版本的签名更新。
