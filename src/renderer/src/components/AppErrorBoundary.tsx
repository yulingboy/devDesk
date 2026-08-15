import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { rendererLogger } from '@/lib/logger'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // React 渲染异常由错误边界兜底，并通过预加载桥接写入主进程日志。
    rendererLogger.reportError({
      source: 'error-boundary',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined
    })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-800">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="p-6 pt-6">
            <div className="mb-4 grid size-10 place-items-center rounded-md bg-red-50 text-red-600">
              <CircleAlert aria-hidden="true" size={21} />
            </div>
            <h1 className="text-lg font-semibold">页面加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              错误已写入本地日志。重新加载后如果仍然失败，请在系统设置中查看日志目录。
            </p>
            <Button className="mt-5" onClick={() => window.location.reload()} variant="success">
              <RotateCcw aria-hidden="true" size={15} />
              重新加载
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }
}
