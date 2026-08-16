import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Play, Square, XCircle } from 'lucide-react'
import type { EnvironmentCheck } from '@shared/domain'
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

export function EnvironmentCheckPanel({
  report
}: {
  report: (error: unknown) => void
}): React.JSX.Element {
  const [checks, setChecks] = useState<EnvironmentCheck[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => window.api?.settings.onEnvironmentCheckUpdated(setChecks), [])

  const run = (): void => {
    setRunning(true)
    void window.api?.settings
      .environmentCheck()
      .then(setChecks)
      .catch(report)
      .finally(() => setRunning(false))
  }
  const stop = (): void => {
    void window.api?.settings
      .stopEnvironmentCheck()
      .then(() => setRunning(false))
      .catch(report)
  }
  const passed = checks.filter((item) => item.status === 'passed').length
  const failed = checks.filter((item) => item.status === 'failed').length
  const skipped = checks.filter((item) => item.status === 'skipped').length

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>环境检测</CardTitle>
          <CardDescription>逐项执行真实版本命令，并保留命令输出用于排障。</CardDescription>
        </div>
        {running ? (
          <Button onClick={stop} variant="secondary">
            <Square size={14} />
            停止后续检测
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
            通过 {passed} 项，失败 {failed} 项{skipped ? `，已跳过 ${skipped} 项` : ''}
          </p>
        )}
        <Accordion className="space-y-2" type="multiple">
          {checks.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="gap-3">
                {item.status === 'passed' ? (
                  <CheckCircle2 className="text-emerald-600" size={17} />
                ) : (
                  <XCircle className="text-red-500" size={17} />
                )}
                <span className="font-medium">{item.name}</span>
                <Badge variant={item.status === 'passed' ? 'success' : 'secondary'}>
                  {item.status === 'passed'
                    ? '通过'
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
                  <Button
                    className="mt-2"
                    onClick={() =>
                      void window.api?.settings.openEnvironmentGuide(item.id).catch(report)
                    }
                    size="sm"
                    variant="ghost"
                  >
                    <ExternalLink size={13} />
                    安装指引
                  </Button>
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
