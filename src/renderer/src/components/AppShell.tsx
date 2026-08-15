import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { getRoute } from '@/routes'
import { applyTheme } from '@/lib/theme'

export function AppShell({ appVersion }: { appVersion: string }): React.JSX.Element {
  const route = getRoute(useLocation().pathname)
  const [displayVersion, setDisplayVersion] = useState(appVersion)

  // 版本号从主进程读取，浏览器预览时保留传入的默认值。
  useEffect(() => {
    void window.api?.app
      .getRuntimeInfo()
      .then((runtimeInfo) => setDisplayVersion(runtimeInfo.appVersion))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void window.api?.settings
      .get()
      .then((settings) => applyTheme(settings.general.theme))
      .catch(() => applyTheme('light'))
  }, [])

  return (
    <div className="flex h-screen min-h-[640px] flex-col bg-[#fbfbfa] text-[#202123]">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <Navigation appVersion={displayVersion} />
        <main className="min-w-0 flex-1 overflow-auto bg-[#fbfbfa]">
          <header className="flex h-14 items-center justify-between border-b border-[#e2e3e4] bg-[#fbfbfa] px-8">
            <div>
              <h1 className="text-[15px] font-semibold text-[#202123]">{route.label}</h1>
              <p className="text-xs text-[#85878a]">{route.description}</p>
            </div>
            <Button
              aria-label="刷新环境状态"
              className="border border-[#d9dadb] bg-white text-[#6b6e72] hover:bg-[#f0f0ee] hover:text-[#202123]"
              size="icon"
              title="刷新环境状态"
              type="button"
              onClick={() => window.location.reload()}
            >
              <RefreshCw aria-hidden="true" size={16} />
            </Button>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
