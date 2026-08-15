import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { RuntimeInfo } from '../../shared/types'
import {
  Boxes,
  Braces,
  ChevronRight,
  FolderKanban,
  GitBranch,
  HardDrive,
  House,
  KeyRound,
  MonitorCog,
  Network,
  PackageOpen,
  RefreshCw,
  ServerCog,
  Settings,
  ShieldCheck
} from 'lucide-react'

interface NavItem {
  label: string
  icon: LucideIcon
}

const navigation: NavItem[] = [
  { label: '首页', icon: House },
  { label: 'Host 管理', icon: Network },
  { label: 'Git 配置', icon: GitBranch },
  { label: 'SSH 密钥', icon: KeyRound },
  { label: '工作区', icon: FolderKanban },
  { label: '项目模板', icon: Boxes },
  { label: 'Node 管理', icon: Braces },
  { label: '系统设置', icon: Settings }
]

const overviewItems = [
  { label: '工作区', value: '0', detail: '尚未配置', icon: FolderKanban },
  { label: 'Git 身份', value: '0', detail: '尚未配置', icon: GitBranch },
  { label: 'SSH 密钥', value: '0', detail: '等待扫描', icon: KeyRound },
  { label: 'Node 版本', value: '--', detail: '等待检测', icon: Braces }
]

function App(): React.JSX.Element {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const hasDesktopRuntime = Boolean(window.api)

  useEffect(() => {
    void window.api?.getRuntimeInfo().then(setRuntimeInfo)
  }, [])

  return (
    <div className="flex h-screen min-h-[640px] bg-[#f5f7f8] text-[#182126]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#dce2e5] bg-[#111a1e] text-white">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid size-9 place-items-center rounded-md bg-[#22a06b] text-white">
            <MonitorCog aria-hidden="true" size={20} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[15px] font-semibold">开发工坊</p>
            <p className="text-xs text-[#8fa1a9]">Environment Studio</p>
          </div>
        </div>

        <nav aria-label="主导航" className="flex-1 space-y-1 p-3">
          {navigation.map(({ label, icon: Icon }, index) => (
            <button
              className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                index === 0
                  ? 'bg-[#243238] font-medium text-white'
                  : 'text-[#aebcc2] hover:bg-white/5 hover:text-white'
              }`}
              key={label}
              type="button"
            >
              <Icon aria-hidden="true" size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2 text-xs text-[#8fa1a9]">
            <span className="size-2 rounded-full bg-[#34c987]" />
            <span>本地模式</span>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <header className="flex h-16 items-center justify-between border-b border-[#dce2e5] bg-white px-7">
          <div>
            <h1 className="text-base font-semibold">系统概览</h1>
            <p className="text-xs text-[#69777d]">当前设备与开发环境状态</p>
          </div>
          <button
            className="grid size-9 place-items-center rounded-md border border-[#d7dee1] bg-white text-[#4d5c62] transition-colors hover:bg-[#f4f6f7]"
            title="刷新环境状态"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="mx-auto max-w-7xl p-7">
          <section aria-labelledby="overview-heading">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold" id="overview-heading">
                  下午好
                </h2>
                <p className="mt-1 text-sm text-[#69777d]">环境服务已就绪</p>
              </div>
              <span className="rounded-full border border-[#b9decf] bg-[#edf8f3] px-3 py-1 text-xs font-medium text-[#17704d]">
                运行正常
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {overviewItems.map(({ label, value, detail, icon: Icon }) => (
                <article className="rounded-md border border-[#dce2e5] bg-white p-4" key={label}>
                  <div className="mb-5 flex items-start justify-between">
                    <p className="text-sm font-medium text-[#536168]">{label}</p>
                    <Icon aria-hidden="true" className="text-[#7b898f]" size={18} />
                  </div>
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-[#849197]">{detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-6 grid grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] gap-5">
            <div className="rounded-md border border-[#dce2e5] bg-white">
              <div className="flex items-center justify-between border-b border-[#e4e9eb] px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold">开发环境</h2>
                  <p className="mt-0.5 text-xs text-[#7b898f]">运行时与平台信息</p>
                </div>
                <ShieldCheck aria-hidden="true" className="text-[#22a06b]" size={19} />
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 p-5">
                <RuntimeRow
                  icon={ServerCog}
                  label="操作平台"
                  value={
                    runtimeInfo
                      ? `${runtimeInfo.platform} / ${runtimeInfo.arch}`
                      : hasDesktopRuntime
                        ? '读取中'
                        : '桌面运行时不可用'
                  }
                />
                <RuntimeRow
                  icon={PackageOpen}
                  label="Electron"
                  value={runtimeInfo?.versions.electron ?? (hasDesktopRuntime ? '读取中' : '--')}
                />
                <RuntimeRow
                  icon={Braces}
                  label="Node.js"
                  value={runtimeInfo?.versions.node ?? (hasDesktopRuntime ? '读取中' : '--')}
                />
                <RuntimeRow
                  icon={HardDrive}
                  label="Chromium"
                  value={runtimeInfo?.versions.chrome ?? (hasDesktopRuntime ? '读取中' : '--')}
                />
              </dl>
            </div>

            <div className="rounded-md border border-[#dce2e5] bg-white">
              <div className="border-b border-[#e4e9eb] px-5 py-4">
                <h2 className="text-sm font-semibold">快速开始</h2>
                <p className="mt-0.5 text-xs text-[#7b898f]">完成基础环境配置</p>
              </div>
              <div className="p-2">
                {['扫描 SSH 密钥', '创建 Git 身份', '添加工作区'].map((label) => (
                  <button
                    className="flex h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm text-[#3d4a50] transition-colors hover:bg-[#f2f5f6]"
                    key={label}
                    type="button"
                  >
                    <span>{label}</span>
                    <ChevronRight aria-hidden="true" className="text-[#8b979c]" size={16} />
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function RuntimeRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[#eef2f3] text-[#526168]">
        <Icon aria-hidden="true" size={17} />
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-[#7b898f]">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  )
}

export default App
