import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** 设置分区作为单个设置面板内的分组，通过分隔线而非多层卡片建立层级。 */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  className
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cn('border-b border-slate-100 px-4 py-3.5 last:border-b-0', className)}>
      <div className="mb-2.5 flex min-h-6 items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-800">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
