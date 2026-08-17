import { useEffect, useRef } from 'react'

/** 在开发环境 Strict Mode 下也只触发一次首屏资源读取。 */
export function useInitialLoad(load: () => void): void {
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    load()
  }, [load])
}
