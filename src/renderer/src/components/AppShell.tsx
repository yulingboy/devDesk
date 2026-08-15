import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { Navigation } from '@/components/Navigation'
import { applyTheme } from '@/lib/theme'

export function AppShell({ appVersion }: { appVersion: string }): React.JSX.Element {
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
      .catch(() => applyTheme('blue'))
  }, [])

  return (
    <div className="flex h-screen min-h-[640px] flex-col bg-slate-50 text-slate-900">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <Navigation appVersion={displayVersion} />
        <main className="min-w-0 flex-1 overflow-auto bg-slate-50/60">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
