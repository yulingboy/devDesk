import type { RuntimeInfo } from '../shared/types'

declare global {
  interface Window {
    api?: {
      getRuntimeInfo: () => Promise<RuntimeInfo>
    }
  }
}

export {}
