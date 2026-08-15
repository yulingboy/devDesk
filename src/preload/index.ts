import { contextBridge, ipcRenderer } from 'electron'
import type { RuntimeInfo } from '../shared/types'

const api = {
  getRuntimeInfo: (): Promise<RuntimeInfo> => ipcRenderer.invoke('app:get-runtime-info')
}

contextBridge.exposeInMainWorld('api', api)
