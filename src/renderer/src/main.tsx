import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { registerGlobalErrorLogging, rendererLogger } from '@/lib/logger'

registerGlobalErrorLogging()
rendererLogger.info('渲染层已初始化', { desktopRuntime: Boolean(window.api) })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
)
