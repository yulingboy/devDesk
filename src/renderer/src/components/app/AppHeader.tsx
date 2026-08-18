import { useEffect, useState } from 'react'
import { Minus, PanelTop, Square, Wifi, X } from 'lucide-react'
import type { SystemOverviewSnapshot } from '@shared/domain'
import type { WindowState } from '@shared/types'
import { TooltipButton } from '@/components/common/TooltipButton'
import { rendererLogger } from '@/lib/logger'
import { toErrorMessage } from '@/lib/errors'

const defaultWindowState: WindowState = {
  isMaximized: false,
  isFullScreen: false,
  isFocused: true
}

export function AppHeader(): React.JSX.Element {
  const [windowState, setWindowState] = useState(defaultWindowState)
  const [ipv4Address, setIpv4Address] = useState<string | null>(null)
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

  // 顶部只展示主机当前主要 IPv4，避免把多个虚拟网卡信息带入首页布局。
  useEffect(() => {
    if (!window.api) return
    const updateAddress = (snapshot: SystemOverviewSnapshot): void => {
      const primary =
        snapshot.networks.find((network) => network.name === 'en0') ?? snapshot.networks[0]
      setIpv4Address(primary?.address ?? null)
    }
    const unsubscribe = window.api.overview.onUpdated(updateAddress)
    void window.api.overview
      .getSnapshot()
      .then((snapshot) => {
        if (snapshot) updateAddress(snapshot)
      })
      .catch(() => undefined)
    return unsubscribe
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
      <div className="min-w-0 flex-1" />

      <div className="app-no-drag flex h-full items-center">
        <div className="mr-4 hidden items-center gap-2 text-[11px] text-slate-400 md:flex">
          {ipv4Address && (
            <span className="flex items-center gap-1 font-mono tabular-nums text-slate-500">
              <Wifi size={12} />
              {ipv4Address}
            </span>
          )}
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
      className={`h-full w-10 rounded-none text-slate-500 transition-colors disabled:cursor-default disabled:opacity-40 ${
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
    error: toErrorMessage(error)
  })
}
