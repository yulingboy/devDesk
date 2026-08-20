import { useState } from 'react'
import { Activity, Cpu, HardDrive, MemoryStick } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { SystemOverviewSnapshot } from '@shared/domain'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'

type MetricKey = 'cpu' | 'memory' | 'disk'

interface ResourceTrendChartProps {
  history: SystemOverviewSnapshot[]
}

const metrics: Array<{
  value: MetricKey
  label: string
  icon: typeof Cpu
  color: string
}> = [
  { value: 'memory', label: '内存', icon: MemoryStick, color: '#7c3aed' },
  { value: 'cpu', label: 'CPU', icon: Cpu, color: '#2563eb' },
  { value: 'disk', label: '磁盘', icon: HardDrive, color: '#0f766e' }
]

/** 复用 shadcn ChartContainer 和 Recharts，展示设备资源历史采样。 */
export function ResourceTrendChart({ history }: ResourceTrendChartProps): React.JSX.Element {
  const [metric, setMetric] = useState<MetricKey>('memory')
  const availableMetrics = metrics.filter(
    (item) => item.value !== 'disk' || history.some((snapshot) => snapshot.disks.length > 0)
  )
  const effectiveMetric = availableMetrics.some((item) => item.value === metric) ? metric : 'memory'
  const selected = metrics.find((item) => item.value === effectiveMetric) ?? metrics[0]
  const SelectedIcon = selected.icon
  const latestValue = history.at(-1) ? getMetricValue(history.at(-1)!, effectiveMetric) : null
  const chartConfig: ChartConfig = {
    usage: { label: selected.label, color: selected.color }
  }

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader className="gap-1.5 p-2.5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5">
              <Activity className="text-[var(--accent)]" size={14} />
              资源趋势
            </CardTitle>
            <CardDescription>最近采样的设备资源占用，数据每 30 秒更新。</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
            <SelectedIcon className="text-[var(--accent)]" size={14} />
            <span className="font-mono font-medium tabular-nums text-slate-700">
              {latestValue === null ? '--' : `${latestValue}%`}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col border-t border-slate-100 p-2.5 pt-2">
        <Tabs
          className="min-h-0 flex-1"
          fill
          items={availableMetrics.map((item) => ({
            value: item.value,
            label: item.label,
            content: (
              <TrendPlot
                chartConfig={chartConfig}
                color={item.color}
                history={history}
                metric={item.value}
              />
            )
          }))}
          onValueChange={(value) => setMetric(value as MetricKey)}
          value={effectiveMetric}
        />
      </CardContent>
    </Card>
  )
}

function TrendPlot({
  chartConfig,
  color,
  history,
  metric
}: {
  chartConfig: ChartConfig
  color: string
  history: SystemOverviewSnapshot[]
  metric: MetricKey
}): React.JSX.Element {
  const data = history.map((snapshot) => ({
    time: formatSampleTime(snapshot.sampledAt),
    usage: getMetricValue(snapshot, metric)
  }))
  return (
    <ChartContainer className="mt-1.5 h-[240px] w-full lg:h-[280px]" config={chartConfig}>
      {data.filter((item) => item.usage !== null).length >= 2 ? (
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${metric}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.24} />
                <stop offset="95%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.22)" strokeDasharray="3 4" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(value: number) => `${value}%`}
              ticks={[0, 25, 50, 75, 100]}
              tickLine={false}
              width={42}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 4' }}
            />
            <Area
              dataKey="usage"
              fill={`url(#fill-${metric})`}
              fillOpacity={1}
              stroke={color}
              strokeWidth={2.5}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-full place-items-center text-xs text-slate-400">
          正在积累趋势数据，至少需要两个采样点
        </div>
      )}
    </ChartContainer>
  )
}

function getMetricValue(snapshot: SystemOverviewSnapshot, metric: MetricKey): number | null {
  if (metric === 'cpu') return snapshot.cpu.usagePercent
  if (metric === 'memory') return snapshot.memory.usedPercent
  if (!snapshot.disks.length) return null
  return Math.round(
    snapshot.disks.reduce((total, disk) => total + disk.usedPercent, 0) / snapshot.disks.length
  )
}

function formatSampleTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
