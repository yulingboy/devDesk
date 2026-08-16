import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Play, Square, XCircle } from 'lucide-react'
import type { EnvironmentCheck, EnvironmentTool } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmAction } from '@/components/ConfirmAction'

export function EnvironmentCheckPanel({
  report
}: {
  report: (error: unknown) => void
}): React.JSX.Element {
  const [checks, setChecks] = useState<EnvironmentCheck[]>([])
  const [tools, setTools] = useState<EnvironmentTool[]>([])
  const [running, setRunning] = useState(false)
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    void window.api?.settings.environmentTools().then(setTools).catch(report)
    return window.api?.settings.onEnvironmentCheckUpdated(setChecks)
  }, [report])

  const run = (): void => {
    setRunning(true)
    void window.api?.settings
      .environmentCheck()
      .then(setChecks)
      .catch(report)
      .finally(() => {
        setRunning(false)
        setStopping(false)
      })
  }
  const stop = (): void => {
    setStopping(true)
    void window.api?.settings.stopEnvironmentCheck().catch((error) => {
      setStopping(false)
      report(error)
    })
  }
  const passed = checks.filter((item) => item.status === 'passed').length
  const failed = checks.filter((item) => item.status === 'failed').length
  const cancelled = checks.filter((item) => item.status === 'cancelled').length
  const skipped = checks.filter((item) => item.status === 'skipped').length

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>环境检测</CardTitle>
          <CardDescription>逐项执行真实版本命令，并保留命令输出用于排障。</CardDescription>
        </div>
        {running ? (
          <Button disabled={stopping} onClick={stop} variant="secondary">
            <Square size={14} />
            {stopping ? '正在停止当前检测' : '停止检测'}
          </Button>
        ) : (
          <Button onClick={run} variant="secondary">
            <Play size={15} />
            开始检测
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {!!checks.length && (
          <p className="pb-2 text-xs text-slate-500">
            通过 {passed} 项，失败 {failed} 项{cancelled ? `，已取消 ${cancelled} 项` : ''}
            {skipped ? `，已跳过 ${skipped} 项` : ''}
          </p>
        )}
        <Accordion className="space-y-2" type="multiple">
          {checks.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="gap-3">
                {item.status === 'passed' ? (
                  <CheckCircle2 className="text-emerald-600" size={17} />
                ) : item.status === 'cancelled' ? (
                  <Square className="text-amber-500" size={16} />
                ) : (
                  <XCircle className="text-red-500" size={17} />
                )}
                <span className="font-medium">{item.name}</span>
                <Badge variant={item.status === 'passed' ? 'success' : 'secondary'}>
                  {item.status === 'passed'
                    ? '通过'
                    : item.status === 'cancelled'
                      ? '已取消'
                      : item.status === 'skipped'
                        ? '已跳过'
                        : '未通过'}
                </Badge>
                <span className="ml-auto truncate text-xs text-slate-500">
                  {item.version || '未检测到'}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="max-h-40 rounded-md bg-slate-50">
                  <div className="p-3 font-mono text-xs text-slate-600">
                    <p>$ {item.command}</p>
                    <pre className="mt-2 whitespace-pre-wrap">{item.detail}</pre>
                  </div>
                </ScrollArea>
                {item.status === 'failed' && (
                  <div className="mt-2 flex gap-1">
                    {tools.find((tool) => tool.id === item.id)?.installable ? (
                      <ConfirmAction
                        description={`将执行受信任的本机安装命令以安装 ${item.name}，请确认网络与权限。`}
                        onConfirm={() =>
                          void window.api?.settings
                            .installEnvironmentTool(item.id)
                            .then((result) => {
                              setChecks((current) => [
                                ...current.filter((check) => check.id !== result.id),
                                result
                              ])
                            })
                            .catch(report)
                        }
                        title={`安装 ${item.name}？`}
                      >
                        <Button size="sm" variant="secondary">
                          安装
                        </Button>
                      </ConfirmAction>
                    ) : null}
                    <Button
                      onClick={() =>
                        void window.api?.settings.openEnvironmentGuide(item.id).catch(report)
                      }
                      size="sm"
                      variant="ghost"
                    >
                      <ExternalLink size={13} />
                      安装指引
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {!checks.length && (
          <Empty>
            <EmptyTitle>尚未执行环境检测</EmptyTitle>
            <EmptyDescription>开始检测后会展示每个运行时的命令输出。</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
