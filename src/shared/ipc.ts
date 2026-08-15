export const IPC_CHANNELS = {
  app: {
    getRuntimeInfo: 'app:get-runtime-info',
    reportError: 'app:report-error',
    writeLog: 'app:write-log'
  },
  window: {
    getState: 'window:get-state',
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize',
    close: 'window:close',
    stateChanged: 'window:state-changed'
  }
} as const
