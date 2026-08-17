import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { SystemOverviewSnapshot } from '@shared/domain'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { rendererLogger } from '@/lib/logger'
import { toErrorMessage } from '@/lib/errors'
import { ResourceTrendChart } from './components/ResourceTrendChart'

const encouragements = [
  '保持专注，准备开始今天的工作。',
  '一步一个脚印，今天也会有新的进展。',
  '把复杂的问题拆开，答案就会逐渐清晰。',
  '先完成，再完善，持续前进就很棒。',
  '专注眼前的事情，好的结果正在路上。',
  '今天的每一次提交，都是向目标靠近。'
]

/** 首页只承载欢迎语、资源趋势和主机基本信息，不混入环境管理业务。 */
export function HomePage(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<SystemOverviewSnapshot | null>(null)
  const [history, setHistory] = useState<SystemOverviewSnapshot[]>([])
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [encouragement] = useState(
    () => encouragements[Math.floor(Math.random() * encouragements.length)] ?? encouragements[0]
  )

  const appendSnapshot = useCallback((next: SystemOverviewSnapshot): void => {
    setSnapshot(next)
    setHistory((current) => {
      const withoutDuplicate = current.filter((item) => item.sampledAt !== next.sampledAt)
      return [...withoutDuplicate, next].slice(-24)
    })
  }, [])

  useEffect(() => {
    if (!window.api) {
      const timer = window.setTimeout(() => setLoading(false), 0)
      return () => window.clearTimeout(timer)
    }

    const unsubscribe = window.api.overview.onUpdated(appendSnapshot)
    void window.api.overview
      .getSnapshot()
      .then((overview) => {
        if (overview) appendSnapshot(overview)
      })
      .catch((error: unknown) => {
        rendererLogger.error('首页系统信息读取失败', {
          error: toErrorMessage(error)
        })
      })
      .finally(() => setLoading(false))
    return unsubscribe
  }, [appendSnapshot])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const hour = currentTime.getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好'
  const timeText = currentTime.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const dateText = currentTime.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  if (loading) return <PageLoadingSkeleton />

  return (
    <div className="dashboard-scroll h-full overflow-auto bg-slate-50/40 p-2.5">
      <div className="mx-auto flex min-h-full max-w-[1440px] flex-col gap-2">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <Badge className="mb-1.5 gap-1.5" variant="success">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                开发工作台
              </Badge>
              <h1 className="text-base font-semibold text-slate-800">
                {greeting}，{snapshot?.username ?? '开发者'}，开始工作
              </h1>
              <p className="mt-1 text-xs text-slate-500">{encouragement}</p>
              <div className="mt-1.5 text-[11px] text-slate-400">{dateText}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-medium tabular-nums text-slate-700">
                {timeText}
              </div>
              <div className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-emerald-600">
                <CheckCircle2 size={13} />
                本机运行正常
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="min-w-0">
          <ResourceTrendChart history={history} />
        </section>
      </div>
    </div>
  )
}
