import { useEffect, useState } from 'react'
import { Download, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { GlobalPackage, NodePackageManagerStatus, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { ConfirmAction } from '@/components/ConfirmAction'
import { TooltipButton } from '@/components/TooltipButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

interface PackagePanelProps {
  state: NodeState | null
  report: (error: unknown) => void
  onState: (state: NodeState) => void
  section?: 'all' | 'managers' | 'packages'
}

export function PackagePanel({
  state,
  report,
  onState,
  section = 'all'
}: PackagePanelProps): React.JSX.Element {
  const [packages, setPackages] = useState<GlobalPackage[]>([])
  const [keyword, setKeyword] = useState('')
  const [packageName, setPackageName] = useState('')
  const [drawerMode, setDrawerMode] = useState<'package' | 'registry' | null>(null)
  const [editingManager, setEditingManager] = useState<NodePackageManagerStatus | null>(null)
  const [registry, setRegistry] = useState('')

  const load = (): void => {
    void window.api?.node.packages(keyword).then(setPackages).catch(report)
  }
  useEffect(() => {
    if (state?.packageManagerVersion)
      void window.api?.node.packages('').then(setPackages).catch(report)
  }, [report, state?.packageManagerVersion])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>
            {section === 'managers'
              ? '包管理器'
              : section === 'packages'
                ? '全局包'
                : '包管理器与全局包'}
          </CardTitle>
          <CardDescription>
            全局包操作使用当前默认包管理器 {state?.packageManager || '--'}。
          </CardDescription>
        </div>
        {section !== 'managers' && (
          <Button
            disabled={!state?.packageManagerVersion}
            onClick={() => setDrawerMode('package')}
            variant="secondary"
          >
            <Plus size={14} />
            安装全局包
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {section !== 'packages' && (
          <div className="grid gap-2 sm:grid-cols-4">
            {state?.packageManagers.map((manager) => (
              <div className="rounded-md border border-slate-100 p-3" key={manager.name}>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-semibold">{manager.name}</p>
                  {manager.isDefault && <Badge variant="success">默认</Badge>}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {manager.available ? `v${manager.version}` : '未安装'}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="mt-1 truncate text-[11px] text-slate-400">
                      {manager.registry || '无 Registry 信息'}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>{manager.registry || '无 Registry 信息'}</TooltipContent>
                </Tooltip>
                <Separator className="mt-3" />
                <div className="mt-2 flex gap-1">
                  <Button
                    disabled={!manager.available || manager.isDefault}
                    onClick={() =>
                      void window.api?.node
                        .setPackageManager(manager.name)
                        .then(onState)
                        .catch(report)
                    }
                    size="sm"
                    variant="ghost"
                  >
                    设为默认
                  </Button>
                  <TooltipButton
                    disabled={!manager.available}
                    onClick={() => {
                      setEditingManager(manager)
                      setRegistry(manager.registry)
                      setDrawerMode('registry')
                    }}
                    size="icon"
                    tooltip={`设置 ${manager.name} Registry`}
                    variant="ghost"
                  >
                    <Pencil size={13} />
                  </TooltipButton>
                </div>
              </div>
            ))}
          </div>
        )}
        {section !== 'managers' && (
          <>
            <div className="flex gap-2">
              <Input
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索全局包"
                value={keyword}
              />
              <TooltipButton onClick={load} size="icon" tooltip="刷新全局包" variant="secondary">
                <RefreshCw size={15} />
              </TooltipButton>
            </div>
            <div className="space-y-2">
              {packages.map((item) => (
                <div
                  className="flex items-center gap-3 rounded-md border border-slate-100 px-3 py-2"
                  key={item.name}
                >
                  <p className="min-w-0 flex-1 truncate font-mono text-sm">{item.name}</p>
                  <Badge variant="secondary">{item.current || '未知'}</Badge>
                  {item.latest && item.latest !== item.current && (
                    <Badge variant="outline">可更新 {item.latest}</Badge>
                  )}
                  <TooltipButton
                    onClick={() =>
                      void window.api?.node.updatePackage(item.name).then(setPackages).catch(report)
                    }
                    size="icon"
                    tooltip="更新包"
                    variant="ghost"
                  >
                    <RefreshCw size={14} />
                  </TooltipButton>
                  <ConfirmAction
                    description={`将从当前默认包管理器中卸载全局包“${item.name}”。`}
                    onConfirm={() =>
                      void window.api?.node.removePackage(item.name).then(setPackages).catch(report)
                    }
                    title="卸载全局包？"
                    triggerTooltip="卸载包"
                  >
                    <Button aria-label="卸载包" size="icon" variant="ghost">
                      <Trash2 size={14} />
                    </Button>
                  </ConfirmAction>
                </div>
              ))}
              {!packages.length && (
                <p className="py-5 text-center text-sm text-slate-400">
                  未发现全局包，或当前包管理器不支持读取。
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
      <Drawer
        description={`将使用 ${state?.packageManager || '默认包管理器'} 执行全局安装，请确认包名和 Registry。`}
        footer={
          <>
            <Button onClick={() => setDrawerMode(null)} variant="secondary">
              取消
            </Button>
            <Button
              disabled={!packageName.trim()}
              onClick={() =>
                void window.api?.node
                  .installPackage(packageName)
                  .then((value) => {
                    setPackages(value)
                    setPackageName('')
                    setDrawerMode(null)
                  })
                  .catch(report)
              }
              variant="success"
            >
              <Download size={15} />
              安装
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'package'}
        title="安装全局包"
      >
        <div className="space-y-2">
          <Label htmlFor="global-package-name">包名</Label>
          <Input
            id="global-package-name"
            onChange={(event) => setPackageName(event.target.value)}
            placeholder="例如 typescript 或 @scope/package"
            value={packageName}
          />
        </div>
      </Drawer>
      <Drawer
        description="Registry 会写入所选包管理器的真实配置，各工具互不覆盖。"
        footer={
          <>
            <Button onClick={() => setDrawerMode(null)} variant="secondary">
              取消
            </Button>
            <Button
              disabled={!editingManager || !registry.trim()}
              onClick={() => {
                if (!editingManager) return
                void window.api?.node
                  .setPackageRegistry(editingManager.name, registry)
                  .then((value) => {
                    onState(value)
                    setDrawerMode(null)
                  })
                  .catch(report)
              }}
              variant="success"
            >
              保存
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'registry'}
        title={`设置 ${editingManager?.name ?? ''} Registry`}
      >
        <div className="space-y-2">
          <Label htmlFor="package-manager-registry">Registry 地址</Label>
          <Input
            id="package-manager-registry"
            onChange={(event) => setRegistry(event.target.value)}
            placeholder="https://registry.npmmirror.com"
            value={registry}
          />
        </div>
      </Drawer>
    </Card>
  )
}
