import { useState } from 'react'
import {
  ArrowRightLeft,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  SearchCheck,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import type { NodePackageManagerStatus, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { Field } from '@/components/ui/form'
import { ConfirmAction } from '@/components/ConfirmAction'
import { SearchInput } from '@/components/SearchInput'
import { TooltipButton } from '@/components/TooltipButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { useGlobalPackages } from '../hooks/useGlobalPackages'

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
  const [packageName, setPackageName] = useState('')
  const [drawerMode, setDrawerMode] = useState<'package' | 'registry' | 'sync' | null>(null)
  const [editingManager, setEditingManager] = useState<NodePackageManagerStatus | null>(null)
  const [registry, setRegistry] = useState('')
  const [sourceVersion, setSourceVersion] = useState('')
  const [syncing, setSyncing] = useState(false)
  const { packages, setPackages, keyword, setKeyword, loading, checking, load, checkOutdated } =
    useGlobalPackages(state, report)

  const syncSources = state?.installed.filter((item) => item.version !== state.currentVersion) ?? []

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 flex-row items-start justify-between">
        <div>
          <CardTitle>
            {section === 'managers'
              ? '包管理器'
              : section === 'packages'
                ? '全局包'
                : '包管理器与全局包'}
          </CardTitle>
          <CardDescription>
            当前默认包管理器：{state?.packageManager || '--'}。不同 Node 版本的 npm
            全局包目录隔离，可通过同步重新安装。
          </CardDescription>
        </div>
        {section !== 'managers' && (
          <div className="flex shrink-0 gap-1.5">
            <Button
              disabled={
                !state?.capabilities?.canSwitch || !state.currentVersion || !syncSources.length
              }
              onClick={() => {
                setSourceVersion(syncSources[0]?.version ?? '')
                setDrawerMode('sync')
              }}
              size="sm"
              variant="outline"
            >
              <ArrowRightLeft size={14} />
              同步全局包
            </Button>
            <Button
              disabled={!state?.packageManagerVersion}
              onClick={() => setDrawerMode('package')}
              size="sm"
              variant="secondary"
            >
              <Plus size={14} />
              安装全局包
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {section !== 'packages' && (
          <ScrollArea className={section === 'managers' ? 'min-h-0 flex-1 pr-2' : 'max-h-56 pr-2'}>
            <div className="space-y-1.5">
              {state?.packageManagers.map((manager) => (
                <Item className="min-w-0" key={manager.name}>
                  <ItemMedia className="font-mono text-[10px] font-semibold">
                    {manager.name.slice(0, 2)}
                  </ItemMedia>
                  <ItemContent className="flex min-w-0 items-center gap-3">
                    <div className="flex w-32 shrink-0 items-center gap-1.5">
                      <ItemTitle className="truncate font-mono">{manager.name}</ItemTitle>
                      {manager.isDefault && <Badge variant="success">默认</Badge>}
                      {!manager.available && <Badge variant="outline">未安装</Badge>}
                    </div>
                    <ItemDescription className="m-0 w-24 shrink-0 font-mono">
                      {manager.available ? `v${manager.version}` : '不可用'}
                    </ItemDescription>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ItemDescription className="m-0 min-w-0 flex-1">
                          {manager.registry || '无 Registry 信息'}
                        </ItemDescription>
                      </TooltipTrigger>
                      <TooltipContent>{manager.registry || '无 Registry 信息'}</TooltipContent>
                    </Tooltip>
                  </ItemContent>
                  <ItemActions>
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
                  </ItemActions>
                </Item>
              ))}
              {!state?.packageManagers.length && (
                <Empty className="min-h-28">
                  <EmptyTitle>未读取到包管理器</EmptyTitle>
                  <EmptyDescription>请刷新 Node 状态后重试。</EmptyDescription>
                </Empty>
              )}
            </div>
          </ScrollArea>
        )}
        {section !== 'managers' && (
          <>
            <div className="flex shrink-0 gap-1.5">
              <SearchInput
                className="flex-1"
                onValueChange={setKeyword}
                placeholder="搜索全局包"
                value={keyword}
              />
              <TooltipButton
                disabled={loading}
                onClick={load}
                size="icon"
                tooltip="刷新全局包"
                variant="secondary"
              >
                {loading ? <Spinner /> : <RefreshCw size={15} />}
              </TooltipButton>
              <TooltipButton
                disabled={checking || loading}
                onClick={checkOutdated}
                size="icon"
                tooltip="检查过期包"
                variant="secondary"
              >
                {checking ? <Spinner /> : <SearchCheck size={15} />}
              </TooltipButton>
            </div>
            <ScrollArea className="min-h-0 flex-1 pr-2">
              <div className="space-y-1.5">
                {loading && !packages.length && (
                  <div className="flex min-h-20 items-center justify-center gap-2 text-xs text-slate-500">
                    <Spinner />
                    正在读取当前 Node 的本地全局包
                  </div>
                )}
                {packages.map((item) => (
                  <Item key={item.name}>
                    <ItemContent>
                      <ItemTitle className="truncate font-mono">{item.name}</ItemTitle>
                    </ItemContent>
                    <Badge variant="secondary">{item.current || '未知'}</Badge>
                    {item.latest && item.latest !== item.current && (
                      <Badge variant="outline">可更新 {item.latest}</Badge>
                    )}
                    <ItemActions>
                      <TooltipButton
                        onClick={() =>
                          void window.api?.node
                            .updatePackage(item.name)
                            .then(setPackages)
                            .catch(report)
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
                          void window.api?.node
                            .removePackage(item.name)
                            .then(setPackages)
                            .catch(report)
                        }
                        title="卸载全局包？"
                        triggerTooltip="卸载包"
                      >
                        <Button aria-label="卸载包" size="icon" variant="ghost">
                          <Trash2 size={14} />
                        </Button>
                      </ConfirmAction>
                    </ItemActions>
                  </Item>
                ))}
                {!loading && !packages.length && (
                  <Empty className="min-h-20 py-3">
                    <EmptyTitle>尚未发现全局包</EmptyTitle>
                    <EmptyDescription>当前包管理器可能没有全局包，或不支持读取。</EmptyDescription>
                  </Empty>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
      <Drawer
        description="使用 nvm 官方迁移命令，将来源版本的 npm 全局包重新安装到当前 Node；不会共享目录。"
        footer={
          <>
            <Button disabled={syncing} onClick={() => setDrawerMode(null)} variant="secondary">
              取消
            </Button>
            <Button
              disabled={!sourceVersion || syncing}
              onClick={() => {
                setSyncing(true)
                void window.api?.node
                  .syncGlobalPackages(sourceVersion)
                  .then((value) => {
                    setPackages(value)
                    setDrawerMode(null)
                    toast.success(`已将 Node ${sourceVersion} 的 npm 全局包同步到当前版本`)
                  })
                  .catch(report)
                  .finally(() => setSyncing(false))
              }}
              variant="success"
            >
              {syncing ? <Spinner /> : <ArrowRightLeft size={15} />}
              同步
            </Button>
          </>
        }
        onClose={() => setDrawerMode(null)}
        open={drawerMode === 'sync'}
        title="同步 npm 全局包"
      >
        <Field label="来源 Node 版本">
          <Select onValueChange={setSourceVersion} value={sourceVersion}>
            <SelectTrigger>
              <SelectValue placeholder="选择已安装版本" />
            </SelectTrigger>
            <SelectContent>
              {syncSources.map((item) => (
                <SelectItem key={item.version} value={item.version}>
                  v{item.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          当前目标版本：<span className="font-mono">v{state?.currentVersion || '--'}</span>。
          原生模块会在目标版本下重新编译或安装。
        </p>
      </Drawer>
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
        <Field htmlFor="global-package-name" label="包名">
          <Input
            id="global-package-name"
            onChange={(event) => setPackageName(event.target.value)}
            placeholder="例如 typescript 或 @scope/package"
            value={packageName}
          />
        </Field>
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
        <Field htmlFor="package-manager-registry" label="Registry 地址">
          <Input
            id="package-manager-registry"
            onChange={(event) => setRegistry(event.target.value)}
            placeholder="https://registry.npmmirror.com"
            value={registry}
          />
        </Field>
      </Drawer>
    </Card>
  )
}
