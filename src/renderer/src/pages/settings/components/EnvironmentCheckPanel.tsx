import { useState } from 'react'
import { CheckCircle2, Play, XCircle } from 'lucide-react'
import type { EnvironmentCheck } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function EnvironmentCheckPanel({
  report
}: {
  report: (error: unknown) => void
}): React.JSX.Element {
  const [checks, setChecks] = useState<EnvironmentCheck[]>([])
  const [running, setRunning] = useState(false)

  const run = (): void => {
    setRunning(true)
    void window.api?.settings
      .environmentCheck()
      .then(setChecks)
      .catch(report)
      .finally(() => setRunning(false))
  }
  const passed = checks.filter((item) => item.status === 'passed').length

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>环境检测</CardTitle>
          <CardDescription>逐项执行真实版本命令，并保留命令输出用于排障。</CardDescription>
        </div>
        <Button disabled={running} onClick={run} variant="secondary">
          <Play size={15} />
          {running ? '检测中...' : '开始检测'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!!checks.length && (
          <p className="pb-2 text-xs text-[#777b80]">
            通过 {passed} 项，失败 {checks.length - passed} 项
          </p>
        )}
        {checks.map((item) => (
          <details className="rounded-md border border-[#e7e8e9] p-3" key={item.id}>
            <summary className="flex cursor-pointer items-center gap-3 text-sm">
              {item.status === 'passed' ? (
                <CheckCircle2 className="text-[#1f845a]" size={17} />
              ) : (
                <XCircle className="text-[#c13c37]" size={17} />
              )}
              <span className="font-medium">{item.name}</span>
              <Badge variant={item.status === 'passed' ? 'success' : 'secondary'}>
                {item.status === 'passed' ? '通过' : '未通过'}
              </Badge>
              <span className="ml-auto truncate text-xs text-[#777b80]">
                {item.version || '未检测到'}
              </span>
            </summary>
            <div className="mt-3 rounded-md bg-[#f4f4f2] p-3 font-mono text-xs text-[#62666a]">
              <p>$ {item.command}</p>
              <pre className="mt-2 whitespace-pre-wrap">{item.detail}</pre>
            </div>
          </details>
        ))}
        {!checks.length && (
          <p className="py-6 text-center text-sm text-[#85878a]">尚未执行环境检测。</p>
        )}
      </CardContent>
    </Card>
  )
}
