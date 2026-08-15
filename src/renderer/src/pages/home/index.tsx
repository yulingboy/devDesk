import { useEffect, useState } from 'react'
import type { RuntimeInfo } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { EnvironmentPanel } from '@/components/EnvironmentPanel'
import { OverviewCards } from '@/components/OverviewCards'
import { QuickStart } from '@/components/QuickStart'
import { rendererLogger } from '@/lib/logger'

export function HomePage(): React.JSX.Element {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const hasDesktopRuntime = Boolean(window.api)

  // 首页只读取一次主进程运行时信息，失败时保留可用的浏览器预览状态。
  useEffect(() => {
    void window.api?.app
      .getRuntimeInfo()
      .then(setRuntimeInfo)
      .catch((error: unknown) => {
        rendererLogger.error('运行时信息读取失败', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <section aria-labelledby="overview-heading">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-[#929599]">
              概览
            </p>
            <h2
              className="text-2xl font-semibold tracking-tight text-[#202123]"
              id="overview-heading"
            >
              下午好，欢迎回来
            </h2>
            <p className="mt-2 text-sm text-[#777b80]">环境服务已就绪，可以开始工作。</p>
          </div>
          <Badge variant="success">运行正常</Badge>
        </div>
        <OverviewCards />
      </section>

      <section className="mt-6 grid grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] gap-5">
        <EnvironmentPanel runtimeInfo={runtimeInfo} hasDesktopRuntime={hasDesktopRuntime} />
        <QuickStart />
      </section>
    </div>
  )
}
