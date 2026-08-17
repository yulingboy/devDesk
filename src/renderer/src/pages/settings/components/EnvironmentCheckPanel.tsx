import type { EnvironmentCheck, EnvironmentTool } from '@shared/domain'
import { CheckCircle2, ExternalLink, Play, RefreshCw, Square, XCircle } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmAction } from '@/components/ConfirmAction'
import { useEnvironmentChecks } from '../hooks/useEnvironmentChecks'

const groups: Array<{ id: EnvironmentTool['group']; label: string }> = [
  { id: 'base', label: '基础' },
  { id: 'node', label: 'Node' },
  { id: 'java', label: 'Java' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'container', label: '容器' }
]

const statusLabel: Record<EnvironmentCheck['status'], string> = {
  passed: '可用',
  missing: '未安装',
  failed: '异常',
  timeout: '超时',
  'permission-denied': '权限不足',
  'daemon-unavailable': '服务未启动',
  cancelled: '已取消',
  skipped: '已跳过'
}

export function EnvironmentCheckPanel({
  report
}: {
  report: (error: unknown) => void
}): React.JSX.Element {
  const {
    tools,
    checkedAt,
    running,
    stopping,
    pendingTool,
    checkMap,
    summary,
    run,
    retry,
    stop,
    install
  } = useEnvironmentChecks(report)

  const renderGroup = (group: EnvironmentTool['group']): React.JSX.Element => {
    const groupTools = tools.filter((tool) => tool.group === group)
    const groupMeta = groups.find((item) => item.id === group)
    return (
      <section key={group}>
        <div className="flex h-8 items-center justify-between border-y border-slate-100 bg-slate-50/80 px-3 first:border-t-0">
          <h3 className="text-xs font-semibold text-slate-700">{groupMeta?.label}</h3>
          <span className="text-[10px] text-slate-400">{groupTools.length} 项</span>
        </div>
        <Accordion className="divide-y divide-slate-100" type="multiple">
          {groupTools.map((tool) => {
            const check = checkMap.get(tool.id)
            const failed = check && check.status !== 'passed'
            return (
              <AccordionItem className="rounded-none border-0" key={tool.id} value={tool.id}>
                <AccordionTrigger className="h-9 gap-2 px-3 py-1 hover:bg-slate-50/70">
                  {check?.status === 'passed' ? (
                    <CheckCircle2 className="text-emerald-600" />
                  ) : check ? (
                    <XCircle className="text-red-500" />
                  ) : (
                    <span className="size-4 rounded-full border border-slate-300" />
                  )}
                  <span className="w-28 shrink-0 truncate font-medium text-slate-700">
                    {tool.name}
                  </span>
                  <Badge variant={check?.status === 'passed' ? 'success' : 'outline'}>
                    {check ? statusLabel[check.status] : '未检测'}
                  </Badge>
                  <span className="ml-2 min-w-0 flex-1 truncate text-[10px] font-normal text-slate-400">
                    {check?.version ?? tool.command}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="border-t border-slate-100 bg-slate-50/40 px-3 pb-3 pt-2.5">
                  {check ? (
                    <ScrollArea className="max-h-32 rounded-md border border-slate-100 bg-white">
                      <div className="p-2.5 font-mono text-[10px] leading-4 text-slate-600">
                        <p>$ {check.command}</p>
                        <pre className="mt-1.5 whitespace-pre-wrap">{check.detail}</pre>
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-[11px] text-slate-400">尚未执行此项检测。</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      disabled={running || Boolean(pendingTool)}
                      onClick={() => retry(tool.id)}
                      size="sm"
                      variant="secondary"
                    >
                      <RefreshCw size={13} />
                      {pendingTool === tool.id ? '检测中' : '重新检测'}
                    </Button>
                    {failed && tool.installable ? (
                      <ConfirmAction
                        description={`将执行：${tool.installCommand}${tool.prerequisite ? `。${tool.prerequisite}` : ''}`}
                        onConfirm={() => install(tool.id)}
                        title={`安装 ${tool.name}？`}
                      >
                        <Button disabled={Boolean(pendingTool)} size="sm" variant="outline">
                          安装
                        </Button>
                      </ConfirmAction>
                    ) : null}
                    {failed && (
                      <Button
                        onClick={() =>
                          void window.api!.settings.openEnvironmentGuide(tool.id).catch(report)
                        }
                        size="sm"
                        variant="ghost"
                      >
                        <ExternalLink size={13} />
                        安装指引
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
        {!groupTools.length && (
          <Empty className="min-h-24">
            <EmptyTitle>暂无检测项</EmptyTitle>
            <EmptyDescription>此分类尚未配置工具。</EmptyDescription>
          </Empty>
        )}
      </section>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex min-h-14 items-center gap-4 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-700">
            {checkedAt ? '环境快照已更新' : '尚未执行环境检测'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {checkedAt
              ? new Date(checkedAt).toLocaleString('zh-CN')
              : '首次检测会依次读取本机命令和服务状态'}
          </p>
        </div>
        <div className="hidden items-center gap-4 text-[11px] sm:flex">
          <span className="text-emerald-600">可用 {summary.passed}</span>
          <span className={summary.issues ? 'text-red-500' : 'text-slate-400'}>
            异常 {summary.issues}
          </span>
          <span className="text-slate-400">未检测 {summary.unchecked}</span>
        </div>
        {running ? (
          <Button disabled={stopping} onClick={stop} variant="secondary">
            <Square />
            {stopping ? '正在停止' : '停止'}
          </Button>
        ) : (
          <Button onClick={run} variant="secondary">
            <Play />
            检测全部
          </Button>
        )}
      </div>
      {tools.length ? (
        <div>{groups.map((group) => renderGroup(group.id))}</div>
      ) : (
        <Empty>
          <EmptyTitle>未读取到检测项</EmptyTitle>
          <EmptyDescription>请稍后重试或查看应用日志。</EmptyDescription>
        </Empty>
      )}
    </Card>
  )
}
