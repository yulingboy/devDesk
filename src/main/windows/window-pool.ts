import { BrowserWindow } from 'electron'

/** 统一管理应用窗口，同一个业务名称始终复用同一个窗口。 */
export class WindowPool {
  private readonly windows = new Map<string, BrowserWindow>()

  /** 打开或聚焦指定业务窗口，确保同名窗口只有一个实例。 */
  open(key: string, factory: () => BrowserWindow): BrowserWindow {
    const existing = this.get(key)
    if (existing) {
      this.focus(key)
      return existing
    }

    const window = factory()
    this.windows.set(key, window)
    window.on('closed', () => {
      if (this.windows.get(key) === window) this.windows.delete(key)
    })
    return window
  }

  /** 获取仍然可用的窗口，并清理已经销毁的缓存引用。 */
  get(key: string): BrowserWindow | undefined {
    const window = this.windows.get(key)
    if (!window || window.isDestroyed()) {
      this.windows.delete(key)
      return undefined
    }
    return window
  }

  /** 恢复被最小化的窗口，并将其带到最前方。 */
  focus(key: string): void {
    const window = this.get(key)
    if (!window) return

    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  /** 应用退出前关闭窗口池中的全部窗口。 */
  closeAll(): void {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) window.close()
    }
    this.windows.clear()
  }
}
