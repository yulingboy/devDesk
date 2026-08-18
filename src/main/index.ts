import { app } from 'electron'
import { registerAppLifecycle } from './app/lifecycle'
import { registerProcessErrorLogging } from './infrastructure/logger'

registerProcessErrorLogging()

// 先获取单实例锁，再注册窗口和 IPC；第二个进程会立即退出。
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  registerAppLifecycle()
}
