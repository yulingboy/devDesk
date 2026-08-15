import { useState } from 'react'
import { Gauge, Plus, Trash2 } from 'lucide-react'
import type { NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface RegistryPanelProps {
  state: NodeState | null
  onState: (state: NodeState) => void
  report: (error: unknown) => void
}

export function RegistryPanel({ state, onState, report }: RegistryPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState({ name: '', url: '' })

  const save = (): void => {
    void window.api?.node
      .saveRegistry(draft)
      .then((registries) => {
        if (state) onState({ ...state, registries })
        setDraft({ name: '', url: '' })
      })
      .catch(report)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>nrm 镜像</CardTitle>
        <CardDescription>维护 Registry 列表；未安装 nrm 时使用默认包管理器切换。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state?.registries.map((registry) => (
          <div
            className="flex items-center gap-3 rounded-md border border-[#e7e8e9] p-3"
            key={registry.id}
          >
            <Gauge className="text-[#62666a]" size={17} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{registry.name}</p>
                {registry.isCurrent && <Badge variant="success">当前</Badge>}
                {registry.latencyMs !== undefined && (
                  <Badge variant="secondary">{registry.latencyMs} ms</Badge>
                )}
              </div>
              <p className="truncate text-xs text-[#777b80]">{registry.url}</p>
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
            <Button
              disabled={registry.isCurrent}
              onClick={() => {
                if (window.confirm(`删除镜像“${registry.name}”？`))
                  void window.api?.node
                    .removeRegistry(registry.id)
                    .then((registries) => state && onState({ ...state, registries }))
                    .catch(report)
              }}
              size="icon"
              title="删除镜像"
              variant="ghost"
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
        <div className="grid gap-2 border-t border-[#e7e8e9] pt-4 md:grid-cols-[160px_1fr_auto]">
          <Input
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="镜像名称"
            value={draft.name}
          />
          <Input
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            placeholder="https://registry.example.com"
            value={draft.url}
          />
          <Button
            disabled={!draft.name.trim() || !draft.url.trim()}
            onClick={save}
            variant="secondary"
          >
            <Plus size={15} />
            添加
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
