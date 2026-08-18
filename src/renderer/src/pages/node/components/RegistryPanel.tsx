import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  Download,
  Gauge,
  Pencil,
  Plus,
  Save,
  Trash2
} from 'lucide-react'
import type { NodeRegistryDraft, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/form'
import { ConfirmAction } from '@/components/common/ConfirmAction'
import { TooltipButton } from '@/components/common/TooltipButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'

interface RegistryPanelProps {
  state: NodeState | null
  onState: (state: NodeState) => void
  report: (error: unknown) => void
}

/** Registry 新增与编辑统一使用抽屉，列表区域只保留查看、切换和快捷操作。 */
export function RegistryPanel({ state, onState, report }: RegistryPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState<NodeRegistryDraft>({ name: '', url: '' })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { isPending, run } = useAsyncAction(report)

  const install = async (): Promise<void> => {
    const next = await run('nrm-install', () => window.api!.node.installNrm(), {
      success: 'nrm 已安装，可以开始管理镜像'
    })
    if (next) onState(next)
  }

  const save = async (): Promise<void> => {
    const registries = await run('registry-save', () => window.api!.node.saveRegistry(draft), {
      success: 'Registry 镜像已保存'
    })
    if (registries && state) {
      onState({ ...state, registries })
      setDraft({ name: '', url: '' })
      setDrawerOpen(false)
    }
  }

  return (
    <>
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0 flex-row items-start justify-between">
          <div>
            <CardTitle>nrm 镜像</CardTitle>
            <CardDescription>镜像的新增、编辑、切换和删除均由本机 nrm 执行。</CardDescription>
          </div>
          <Button
            disabled={!state?.nrmAvailable}
            onClick={() => {
              setDraft({ name: '', url: '' })
              setDrawerOpen(true)
            }}
            variant="secondary"
          >
            <Plus size={15} />
            新增镜像
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          {!state?.nrmAvailable ? (
            <div className="space-y-3">
              <Alert className="items-start" variant="warning">
                <AlertTriangle size={15} />
                <AlertDescription className="min-w-0 flex-1">
                  未检测到当前 Node 的 nrm，镜像管理已禁用。可以直接安装到当前 Node 的 npm
                  全局目录。
                </AlertDescription>
                <Button
                  disabled={
                    isPending('nrm-install') ||
                    !state?.packageManagers.some((item) => item.name === 'npm' && item.available)
                  }
                  loading={isPending('nrm-install')}
                  loadingText="安装中"
                  onClick={() => void install()}
                  size="sm"
                  variant="secondary"
                >
                  <Download size={13} />
                  安装 nrm
                </Button>
              </Alert>
              <Empty className="min-h-44">
                <EmptyTitle>nrm 尚未安装</EmptyTitle>
                <EmptyDescription>安装 nrm 后才能读取和管理真实镜像列表。</EmptyDescription>
              </Empty>
            </div>
          ) : (
            <ScrollArea className="h-full pr-2">
              <div className="space-y-1.5">
                {state.registries.map((registry) => (
                  <Item key={registry.id}>
                    <ItemMedia className="bg-slate-100 text-slate-600">
                      <Gauge />
                    </ItemMedia>
                    <ItemContent>
                      <div className="flex items-center gap-2">
                        <ItemTitle>{registry.name}</ItemTitle>
                        {registry.isCurrent && <Badge variant="success">当前</Badge>}
                        {registry.latencyMs !== undefined && (
                          <Badge variant="secondary">{registry.latencyMs} ms</Badge>
                        )}
                      </div>
                      <ItemDescription>{registry.url}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {!registry.isCurrent && (
                        <TooltipButton
                          loading={isPending(`registry-use:${registry.id}`)}
                          loadingText="切换中"
                          onClick={() =>
                            void run(
                              `registry-use:${registry.id}`,
                              () => window.api!.node.useRegistry(registry.id),
                              { success: `已切换到 ${registry.name} 镜像` }
                            ).then((value) => value && onState(value))
                          }
                          size="icon"
                          tooltip="切换镜像"
                          variant="ghost"
                        >
                          <ArrowRightLeft size={13} />
                        </TooltipButton>
                      )}
                      <TooltipButton
                        loading={isPending(`registry-test:${registry.id}`)}
                        loadingText="测速中"
                        onClick={() =>
                          void run(
                            `registry-test:${registry.id}`,
                            () => window.api!.node.testRegistry(registry.id),
                            {
                              success: (value) => {
                                const current = value.find((item) => item.id === registry.id)
                                return current?.latencyMs === undefined
                                  ? `${registry.name} 测速完成`
                                  : `${registry.name} 延迟 ${current.latencyMs} ms`
                              }
                            }
                          ).then((registries) =>
                            registries && state ? onState({ ...state, registries }) : undefined
                          )
                        }
                        size="icon"
                        tooltip="测试镜像速度"
                        variant="ghost"
                      >
                        <Gauge size={13} />
                      </TooltipButton>
                      <TooltipButton
                        onClick={() => {
                          setDraft({ id: registry.id, name: registry.name, url: registry.url })
                          setDrawerOpen(true)
                        }}
                        size="icon"
                        tooltip="编辑镜像"
                        variant="ghost"
                      >
                        <Pencil size={15} />
                      </TooltipButton>
                      <ConfirmAction
                        description={`删除镜像“${registry.name}”后需要重新新增才能恢复。当前镜像不能删除。`}
                        onConfirm={async () => {
                          const registries = await run(
                            `registry-remove:${registry.id}`,
                            () => window.api!.node.removeRegistry(registry.id),
                            { success: `Registry 镜像“${registry.name}”已删除` }
                          )
                          if (registries && state) onState({ ...state, registries })
                        }}
                        title="删除 Registry 镜像？"
                        triggerTooltip="删除镜像"
                      >
                        <Button
                          aria-label="删除镜像"
                          disabled={registry.isCurrent}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </ConfirmAction>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <Drawer
        description="名称必须唯一，地址必须使用 HTTP 或 HTTPS。"
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)} variant="secondary">
              取消
            </Button>
            <Button
              disabled={!state?.nrmAvailable}
              loading={isPending('registry-save')}
              loadingText="保存中"
              onClick={() => void save()}
              variant="success"
            >
              <Save size={15} />
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        title={draft.id ? '编辑 Registry 镜像' : '新增 Registry 镜像'}
      >
        <div className="space-y-3">
          <Field htmlFor="registry-name" label="镜像名称">
            <Input
              id="registry-name"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="例如 npmmirror"
              value={draft.name}
            />
          </Field>
          <Field htmlFor="registry-url" label="Registry 地址">
            <Input
              id="registry-url"
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
              placeholder="https://registry.example.com"
              value={draft.url}
            />
          </Field>
        </div>
      </Drawer>
    </>
  )
}
