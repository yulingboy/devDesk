import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '@/lib/utils'

type ChartTheme = 'light' | 'dark'

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode
    color?: string
    theme?: Partial<Record<ChartTheme, string>>
  }
}

interface ChartContextValue {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart(): ChartContextValue {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error('图表组件必须放在 ChartContainer 内。')
  return context
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & { config: ChartConfig }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId().replace(/:/g, '')
  const chartId = `chart-${id || uniqueId}`
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-slate-400 [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-slate-200/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-slate-300 [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-slate-200/70 [&_.recharts-radial-bar-background-sector]:fill-slate-100 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-slate-100 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-slate-200/70",
          className
        )}
        data-chart={chartId}
        ref={ref}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {children}
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'ChartContainer'

function ChartStyle({ id, config }: { id: string; config: ChartConfig }): React.JSX.Element | null {
  const colorEntries = Object.entries(config).filter(([, item]) => item.color || item.theme)
  if (!colorEntries.length) return null
  const css = (Object.entries({ light: '', dark: '.dark' }) as Array<[ChartTheme, string]>)
    .map(([theme, selector]) => {
      const rules = colorEntries
        .map(([key, item]) => {
          const color = item.theme?.[theme] ?? item.color
          return color ? `  --color-${key}: ${color};` : ''
        })
        .filter(Boolean)
        .join('\n')
      return rules ? `${selector} [data-chart=${id}] {\n${rules}\n}` : ''
    })
    .filter(Boolean)
    .join('\n')
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}

export const ChartTooltip = RechartsPrimitive.Tooltip

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  indicator = 'dot'
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; dataKey?: string; color?: string }>
  label?: React.ReactNode
  className?: string
  indicator?: 'dot' | 'line'
}): React.JSX.Element | null {
  const { config } = useChart()
  if (!active || !payload?.length) return null
  return (
    <div
      className={cn(
        'grid min-w-32 gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-md',
        className
      )}
    >
      {label !== undefined && <div className="font-medium text-slate-700">{label}</div>}
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? item.name ?? index)
        const itemConfig = config[key]
        const color = item.color ?? itemConfig?.color ?? 'var(--accent)'
        return (
          <div className="flex items-center justify-between gap-3" key={`${key}-${index}`}>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span
                className={cn(
                  'shrink-0 rounded-sm',
                  indicator === 'dot' ? 'size-1.5 rounded-full' : 'h-0.5 w-3'
                )}
                style={{ backgroundColor: color }}
              />
              {itemConfig?.label ?? item.name ?? key}
            </span>
            <span className="font-mono tabular-nums text-slate-800">{item.value}%</span>
          </div>
        )
      })}
    </div>
  )
}

export function ChartLegendContent({
  payload,
  className
}: {
  payload?: Array<{ value?: string; dataKey?: string; color?: string }>
  className?: string
}): React.JSX.Element | null {
  const { config } = useChart()
  if (!payload?.length) return null
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 pt-2 text-[10px] text-slate-500',
        className
      )}
    >
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? item.value ?? index)
        return (
          <span className="flex items-center gap-1" key={`${key}-${index}`}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            {config[key]?.label ?? item.value ?? key}
          </span>
        )
      })}
    </div>
  )
}
