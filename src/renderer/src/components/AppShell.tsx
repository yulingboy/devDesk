import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { Navigation } from '@/components/Navigation'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RouteLoadingIndicator } from '@/components/RouteLoadingIndicator'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { SidebarProvider } from '@/components/ui/sidebar'

export function AppShell({ appVersion }: { appVersion: string }): React.JSX.Element {
  const [displayVersion, setDisplayVersion] = useState(appVersion)

  // 版本号从主进程读取，浏览器预览时保留传入的默认值。
  useEffect(() => {
    void window.api?.app
      .getRuntimeInfo()
      .then((runtimeInfo) => setDisplayVersion(runtimeInfo.appVersion))
      .catch(() => undefined)
  }, [])

  return (
    <TooltipProvider delayDuration={350}>
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-screen min-h-[640px] flex-col bg-slate-50 text-slate-900">
          <AppHeader />
          <div className="flex min-h-0 flex-1">
            <Navigation appVersion={displayVersion} />
            <main className="relative min-w-0 flex-1 overflow-hidden bg-slate-50/60">
              <RouteLoadingIndicator />
              <Suspense fallback={<PageLoadingSkeleton />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
          <Toaster />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
