import { useState } from 'react'
import { Gauge, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import type { NodeRegistryDraft, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmAction } from '@/components/ConfirmAction'
import { TooltipButton } from '@/components/TooltipButton'

interface RegistryPanelProps {
  state: NodeState | null
  onState: (state: NodeState) => void
  report: (error: unknown) => void
}

/** Registry 新增与编辑统一使用抽屉，列表区域只保留查看、切换和快捷操作。 */
export function RegistryPanel({ state, onState, report }: RegistryPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState<NodeRegistryDraft>({ name: '', url: '' })
  const [drawerOpen, setDrawerOpen] = useState(false)

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
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>nrm 镜像</CardTitle>
            <CardDescription>
              维护 Registry 列表；未安装 nrm 时使用默认包管理器切换。
            </CardDescription>
          </div>
          <Button
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
        <CardContent className="space-y-3">
          {state?.registries.map((registry) => (
            <div
              className="flex items-center gap-3 rounded-md border border-slate-100 p-3"
              key={registry.id}
            >
              <Gauge className="text-slate-600" size={17} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{registry.name}</p>
                  {registry.isCurrent && <Badge variant="success">当前</Badge>}
                  {registry.latencyMs !== undefined && (
                    <Badge variant="secondary">{registry.latencyMs} ms</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500">{registry.url}</p>
              </div>
              {!registry.isCurrent && (
                <Button
                  onClick={() =>
                    void window.api?.node.useRegistry(registry.id).then(onState).catch(report)
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
            </div>
          ))}
        </CardContent>
      </Card>
      <Drawer
        description="名称必须唯一，地址必须使用 HTTP 或 HTTPS。"
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)} variant="secondary">
              取消
            </Button>
            <Button onClick={save} variant="success">
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
          <div className="space-y-2">
            <Label htmlFor="registry-name">镜像名称</Label>
            <Input
              id="registry-name"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="例如 npmmirror"
              value={draft.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registry-url">Registry 地址</Label>
            <Input
              id="registry-url"
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
              placeholder="https://registry.example.com"
              value={draft.url}
            />
          </div>
        </div>
      </Drawer>
    </>
  )
}
