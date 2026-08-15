import { useEffect, useState } from 'react'
import { Download, RefreshCw, Trash2 } from 'lucide-react'
import type { GlobalPackage, NodeState } from '@shared/domain'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface PackagePanelProps {
  state: NodeState | null
  report: (error: unknown) => void
}

export function PackagePanel({ state, report }: PackagePanelProps): React.JSX.Element {
  const [packages, setPackages] = useState<GlobalPackage[]>([])
  const [keyword, setKeyword] = useState('')
  const [packageName, setPackageName] = useState('')

  const load = (): void => {
    void window.api?.node.packages(keyword).then(setPackages).catch(report)
  }
  useEffect(() => {
    if (state?.packageManagerVersion)
      void window.api?.node.packages('').then(setPackages).catch(report)
  }, [report, state?.packageManagerVersion])

  return (
    <Card>
      <CardHeader>
        <CardTitle>包管理器与全局包</CardTitle>
        <CardDescription>
          全局包操作使用当前默认包管理器 {state?.packageManager || '--'}。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {state?.packageManagers.map((manager) => (
            <div className="rounded-md border border-[#e7e8e9] p-3" key={manager.name}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm font-semibold">{manager.name}</p>
                {manager.isDefault && <Badge variant="success">默认</Badge>}
              </div>
              <p className="mt-2 text-xs text-[#777b80]">
                {manager.available ? `v${manager.version}` : '未安装'}
              </p>
              <p className="mt-1 truncate text-[11px] text-[#9a9ca0]" title={manager.registry}>
                {manager.registry || '无 Registry 信息'}
              </p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索全局包"
            value={keyword}
          />
          <Button onClick={load} size="icon" title="刷新全局包" variant="secondary">
            <RefreshCw size={15} />
          </Button>
        </div>
        <div className="space-y-2">
          {packages.map((item) => (
            <div
              className="flex items-center gap-3 rounded-md border border-[#e7e8e9] px-3 py-2"
              key={item.name}
            >
              <p className="min-w-0 flex-1 truncate font-mono text-sm">{item.name}</p>
              <Badge variant="secondary">{item.current || '未知'}</Badge>
              {item.latest && item.latest !== item.current && (
                <Badge variant="outline">可更新 {item.latest}</Badge>
              )}
              <Button
                onClick={() =>
                  void window.api?.node.updatePackage(item.name).then(setPackages).catch(report)
                }
                size="icon"
                title="更新包"
                variant="ghost"
              >
                <RefreshCw size={14} />
              </Button>
              <Button
                onClick={() => {
                  if (window.confirm(`卸载全局包“${item.name}”？`))
                    void window.api?.node.removePackage(item.name).then(setPackages).catch(report)
                }}
                size="icon"
                title="卸载包"
                variant="ghost"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          {!packages.length && (
            <p className="py-5 text-center text-sm text-[#85878a]">
              未发现全局包，或当前包管理器不支持读取。
            </p>
          )}
        </div>
        <div className="flex gap-2 border-t border-[#e7e8e9] pt-4">
          <Input
            onChange={(event) => setPackageName(event.target.value)}
            placeholder="包名，例如 typescript"
            value={packageName}
          />
          <Button
            disabled={!packageName.trim()}
            onClick={() =>
              void window.api?.node
                .installPackage(packageName)
                .then((value) => {
                  setPackages(value)
                  setPackageName('')
                })
                .catch(report)
            }
            variant="secondary"
          >
            <Download size={15} />
            安装全局包
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
