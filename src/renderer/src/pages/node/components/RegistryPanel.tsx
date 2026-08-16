import { useState } from 'react'
import { AlertTriangle, Download, Gauge, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { NodeRegistryDraft, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/form'
import { ConfirmAction } from '@/components/ConfirmAction'
import { TooltipButton } from '@/components/TooltipButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
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
  const [installing, setInstalling] = useState(false)

  const install = (): void => {
    setInstalling(true)
    void window.api?.node
      .installNrm()
      .then((next) => {
        onState(next)
        toast.success('nrm 已安装，可以开始管理镜像')
      })
      .catch(report)
      .finally(() => setInstalling(false))
  }

  const save = (): void => {
    void window.api?.node
      .saveRegistry(draft)
      .then((registries) => {
        if (state) onState({ ...state, registries })
        setDraft({ name: '', url: '' })
        setDrawerOpen(false)
      })
      .catch(report)
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
                    installing ||
                    !state?.packageManagers.some((item) => item.name === 'npm' && item.available)
                  }
                  onClick={install}
                  size="sm"
                  variant="secondary"
                >
                  {installing ? <Spinner /> : <Download size={13} />}
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
                        <Button
                          onClick={() =>
                            void window.api?.node
                              .useRegistry(registry.id)
                              .then(onState)
                              .catch(report)
                          }
                          size="sm"
                          variant="secondary"
                        >
                          切换
                        </Button>
                      )}
                      <Button
                        onClick={() =>
                          void window.api?.node
                            .testRegistry(registry.id)
                            .then((registries) => state && onState({ ...state, registries }))
                            .catch(report)
                        }
                        size="sm"
                        variant="ghost"
                      >
                        测速
                      </Button>
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
                        onConfirm={() =>
                          void window.api?.node
                            .removeRegistry(registry.id)
                            .then((registries) => state && onState({ ...state, registries }))
                            .catch(report)
                        }
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
            <Button disabled={!state?.nrmAvailable} onClick={save} variant="success">
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
