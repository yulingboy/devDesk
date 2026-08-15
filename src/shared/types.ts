export interface RuntimeInfo {
  platform: NodeJS.Platform
  arch: string
  versions: {
    electron: string
    node: string
    chrome: string
  }
}
