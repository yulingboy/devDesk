import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** 每次路由切换都显示短暂进度条，避免本地页面切换快到完全没有反馈。 */
export function RouteLoadingIndicator(): React.JSX.Element | null {
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showTimer = window.setTimeout(() => setVisible(true), 0)
    const hideTimer = window.setTimeout(() => setVisible(false), 420)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      aria-label="页面加载中"
      className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-blue-100"
    >
      <div className="route-loading-bar h-full w-1/3 bg-blue-500" />
    </div>
  )
}
