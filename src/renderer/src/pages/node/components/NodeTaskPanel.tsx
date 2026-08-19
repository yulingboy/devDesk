import { RotateCcw, Square, Trash2 } from 'lucide-react'
import type { NodeState, NodeTask } from '@shared/domain'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { usePageFeedback } from '@/hooks/usePageFeedback'

export function NodeTaskPanel({
  tasks,
  state,
  onState
}: {
  tasks: NodeTask[]
  state: NodeState | null
  onState: (state: NodeState) => void
}): React.JSX.Element {
  const { report } = usePageFeedback('Node 任务操作失败', { keepStatus: false })
  const { isPending, run } = useAsyncAction(report)
  const visibleTasks = (tasks.length ? tasks : (state?.tasks ?? [])).slice().reverse()
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>安装任务</CardTitle>
          <CardDescription>
            任务状态和日志会持久化，失败任务可重试，历史可单独清理。
          </CardDescription>
        </div>
        <ConfirmAction
          description="将清理已完成、已失败和已取消的任务记录；正在执行的安装任务会保留。"
          onConfirm={async () => {
            const value = await run('tasks-clear', () => window.api!.node.clearTasks(), {
              success: '任务历史已清理'
            })
            if (value) onState(value)
          }}
          title="清理任务历史？"
        >
          <Button size="sm" variant="ghost">
            <Trash2 size={14} />
            清理历史
          </Button>
        </ConfirmAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <Accordion className="space-y-2" type="multiple">
          {visibleTasks.map((task) => (
            <AccordionItem key={task.id} value={task.id}>
              <AccordionTrigger>
                <span className="font-mono">Node {task.version}</span>
                <Badge variant={task.status === 'completed' ? 'success' : 'secondary'}>
                  {task.message}
                </Badge>
                <span className="ml-auto mr-2 text-[11px] text-slate-400">{task.progress}%</span>
              </AccordionTrigger>
              <AccordionContent>
                <Progress className="mb-2" value={task.progress} />
                <ScrollArea className="max-h-40 rounded-md bg-slate-50">
                  <pre className="whitespace-pre-wrap p-2 text-[11px] text-slate-600">
                    {task.logs.join('\n') || '暂无日志'}
                  </pre>
                </ScrollArea>
                <div className="mt-2 flex justify-end gap-1">
                  {['waiting', 'downloading', 'extracting'].includes(task.status) && (
                    <ConfirmAction
                      description={`将终止 Node ${task.version} 的安装任务，并清除未完成的安装文件。`}
                      onConfirm={async () => {
                        const value = await run(
                          `task-cancel:${task.id}`,
                          () => window.api!.node.cancelTask(task.id),
                          { success: `Node ${task.version} 安装任务已取消` }
                        )
                        if (value) onState(value)
                      }}
                      title="取消安装任务？"
                      triggerTooltip="取消安装任务"
                    >
                      <Button aria-label="取消安装任务" size="icon" variant="ghost">
                        <Square size={13} />
                      </Button>
                    </ConfirmAction>
                  )}
                  {['failed', 'cancelled'].includes(task.status) && (
                    <TooltipButton
                      loading={isPending(`task-retry:${task.id}`)}
                      loadingText="重试中"
                      onClick={() =>
                        void run(
                          `task-retry:${task.id}`,
                          () => window.api!.node.retryTask(task.id),
                          { success: `Node ${task.version} 安装任务已重新启动` }
                        ).then((value) => value && onState(value))
                      }
                      size="icon"
                      tooltip="重试安装任务"
                      variant="secondary"
                    >
                      <RotateCcw size={13} />
                    </TooltipButton>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {!visibleTasks.length && (
          <Empty>
            <EmptyTitle>暂无 Node 安装任务</EmptyTitle>
            <EmptyDescription>安装或切换版本后，任务记录会显示在这里。</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
