import { useEffect, useState } from 'react'
import { Minus, MonitorCog, PanelTop, Square, X } from 'lucide-react'
import type { WindowState } from '@shared/types'
import { TooltipButton } from '@/components/TooltipButton'
import { rendererLogger } from '@/lib/logger'

const defaultWindowState: WindowState = {
  isMaximized: false,
  isFullScreen: false,
  isFocused: true
}

export function AppHeader(): React.JSX.Element {
  const [windowState, setWindowState] = useState(defaultWindowState)
  const hasDesktopRuntime = Boolean(window.api)
  const isMac =
    window.api?.app.platform === 'darwin' ||
    (!window.api && navigator.userAgent.toLowerCase().includes('mac'))

  // macOS 使用原生交通灯，其他平台才显示应用内窗口控制按钮。
  useEffect(() => {
    if (!window.api) return

    void window.api.window.getState().then(setWindowState).catch(logWindowError)
    return window.api.window.onStateChanged(setWindowState)
  }, [])

  const runWindowAction = (action: () => Promise<unknown>): void => {
    void action().catch(logWindowError)
  }

  return (
    <header
      className={`app-drag-region flex h-12 shrink-0 items-center border-b border-slate-200 bg-white/90 text-slate-800 backdrop-blur-md ${
        windowState.isFocused ? '' : 'opacity-90'
      }`}
    >
      {isMac && <div aria-hidden="true" className="w-[78px] shrink-0" />}
      <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${isMac ? 'pr-4' : 'px-4'}`}>
        <div className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-white shadow-sm">
          <MonitorCog aria-hidden="true" size={14} strokeWidth={2.2} />
        </div>
        <span className="truncate text-sm font-medium text-slate-700">开发工坊</span>
      </div>

      <div className="app-no-drag flex h-full items-center">
        <div className="mr-4 hidden items-center gap-2 text-[11px] text-slate-400 md:flex">
          <span
            className={`size-1.5 rounded-full ${hasDesktopRuntime ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
          <span>{hasDesktopRuntime ? '本地服务已就绪' : '浏览器预览'}</span>
        </div>

        {!isMac && (
          <>
            <WindowButton
              disabled={!hasDesktopRuntime}
              label="最小化"
              onClick={() => runWindowAction(() => window.api!.window.minimize())}
            >
              <Minus aria-hidden="true" size={15} />
            </WindowButton>
            <WindowButton
              disabled={!hasDesktopRuntime}
              label={windowState.isMaximized ? '还原' : '最大化'}
              onClick={() => runWindowAction(() => window.api!.window.toggleMaximize())}
            >
              {windowState.isMaximized ? (
                <PanelTop aria-hidden="true" size={14} />
              ) : (
                <Square aria-hidden="true" size={13} />
              )}
            </WindowButton>
            <WindowButton
              close
              disabled={!hasDesktopRuntime}
              label="关闭"
              onClick={() => runWindowAction(() => window.api!.window.close())}
            >
              <X aria-hidden="true" size={16} />
            </WindowButton>
          </>
        )}
      </div>
    </header>
  )
}

function WindowButton({
  children,
  close = false,
  disabled,
  label,
  onClick
}: {
  children: React.ReactNode
  close?: boolean
  disabled: boolean
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <TooltipButton
      aria-label={label}
      className={`h-full w-11 rounded-none text-slate-500 transition-colors disabled:cursor-default disabled:opacity-40 ${
        close ? 'hover:bg-red-500 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'
      }`}
      disabled={disabled}
      onClick={onClick}
      tooltip={label}
      variant="ghost"
    >
      {children}
    </TooltipButton>
  )
}

function logWindowError(error: unknown): void {
  rendererLogger.error('窗口操作失败', {
    error: error instanceof Error ? error.message : String(error)
  })
}
