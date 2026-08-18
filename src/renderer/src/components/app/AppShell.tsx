import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/app/AppHeader'
import { Navigation } from '@/components/app/Navigation'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageLoadingSkeleton } from '@/components/common/PageLoadingSkeleton'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function AppShell({ appVersion }: { appVersion: string }): React.JSX.Element {
  const [displayVersion, setDisplayVersion] = useState(appVersion)
  const hasDesktopRuntime = Boolean(window.api)

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
              {hasDesktopRuntime ? (
                <Suspense fallback={<PageLoadingSkeleton />}>
                  <Outlet />
                </Suspense>
              ) : (
                <div className="flex h-full items-center justify-center p-4">
                  <Alert className="max-w-md" variant="warning">
                    <AlertDescription>
                      当前页面需要通过 Electron 桌面应用运行，浏览器预览不会连接本机开发环境。
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </main>
          </div>
          <Toaster />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
