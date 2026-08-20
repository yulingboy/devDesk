import { useEffect, useState } from 'react'
import { Check, Download, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { AppSettings, NodeDownloadSourceTestResult } from '@shared/domain'
import {
  getNodeDownloadSourcePresetId,
  NODE_DOWNLOAD_SOURCE_PRESETS,
  type NodeDownloadSourcePresetId
} from '@shared/node-download-sources'
import { DrawerActions } from '@/components/common/DrawerActions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { usePageFeedback } from '@/hooks/usePageFeedback'

interface NodeDownloadSourceDrawerProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Node 下载源单独使用抽屉管理。版本索引与安装包源必须同时可配置，
 * 否则自定义镜像只能展示版本却无法完成实际安装。
 */
export function NodeDownloadSourceDrawer({
  open,
  onClose,
  onSaved
}: NodeDownloadSourceDrawerProps): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [preset, setPreset] = useState<NodeDownloadSourcePresetId>('official')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<NodeDownloadSourceTestResult>()
  const { status, report, clearError } = usePageFeedback('Node 下载源设置失败')

  useEffect(() => {
    if (!open) return
    let active = true
    const loadSettings = async (): Promise<void> => {
      try {
        const value = await window.api!.settings.get()
        if (!active) return
        setSettings(value)
        setPreset(getNodeDownloadSourcePresetId(value.node))
      } catch (error) {
        if (active) report(error)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadSettings()
    return () => {
      active = false
    }
  }, [clearError, open, report])

  const selectPreset = (value: NodeDownloadSourcePresetId): void => {
    setPreset(value)
    if (value === 'custom') return
    const selected = NODE_DOWNLOAD_SOURCE_PRESETS.find((item) => item.id === value)
    if (!selected) return
    setSettings((current) =>
      current
        ? {
            ...current,
            node: { ...current.node, ...selected.settings }
          }
        : current
    )
  }

  const changeAddress = (field: 'indexUrl' | 'downloadSource', value: string): void => {
    setPreset('custom')
    setTestResult(undefined)
    setSettings((current) =>
      current ? { ...current, node: { ...current.node, [field]: value } } : current
    )
  }

  const testSource = async (): Promise<void> => {
    if (!settings || testing) return
    setTesting(true)
    clearError()
    try {
      const result = await window.api!.settings.testNodeDownloadSource(settings.node)
      setTestResult(result)
      if (result.packageReachable && result.checksumReachable) toast.success('下载源结构验证通过')
      else toast.warning('索引可用，但安装包或校验文件不完整')
    } catch (error) {
      report(error)
    } finally {
      setTesting(false)
    }
  }

  const save = async (): Promise<void> => {
    if (!settings || saving) return
    setSaving(true)
    clearError()
    try {
      const saved = await window.api!.settings.save({
        ...settings,
        node: {
          ...settings.node,
          indexUrl: settings.node.indexUrl.trim(),
          downloadSource: settings.node.downloadSource.trim()
        }
      })
      setSettings(saved)
      toast.success('Node 下载源已保存，正在刷新版本索引')
      onClose()
      onSaved()
    } catch (error) {
      report(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onOpenChange={(next) => !next && onClose()} open={open}>
      <SheetContent>
        <SheetHeader>
          <div>
            <SheetTitle className="flex items-center gap-2">
              <Download size={16} />
              Node 下载源
            </SheetTitle>
            <SheetDescription>配置版本索引与 Node.js 安装包的下载地址。</SheetDescription>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4">
          {status && (
            <Alert variant="destructive">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
          {loading || !settings ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              <Field
                description={
                  NODE_DOWNLOAD_SOURCE_PRESETS.find((item) => item.id === preset)?.description ??
                  '分别填写兼容 Node.js 官方目录结构的地址。'
                }
                htmlFor="node-download-preset"
                label="下载源"
              >
                <Select
                  onValueChange={(value) => selectPreset(value as NodeDownloadSourcePresetId)}
                  value={preset}
                >
                  <SelectTrigger id="node-download-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NODE_DOWNLOAD_SOURCE_PRESETS.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">自定义地址</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                description="必须返回 Node.js 官方 index.json 兼容的版本数组。"
                htmlFor="node-index-url"
                label="版本索引地址"
              >
                <Input
                  id="node-index-url"
                  onChange={(event) => changeAddress('indexUrl', event.target.value)}
                  placeholder="https://nodejs.org/dist/index.json"
                  spellCheck={false}
                  value={settings.node.indexUrl}
                />
              </Field>
              <Field
                description="根目录下需包含 v版本号/安装包 与 SHASUMS256.txt。"
                htmlFor="node-download-source"
                label="安装包根地址"
              >
                <Input
                  id="node-download-source"
                  onChange={(event) => changeAddress('downloadSource', event.target.value)}
                  placeholder="https://nodejs.org/dist"
                  spellCheck={false}
                  value={settings.node.downloadSource}
                />
              </Field>
              <div className="space-y-2 rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
                <p>
                  SHA256 只能校验文件与镜像提供的校验表一致，不能证明自定义镜像的发布者可信。
                  非本机地址必须使用 HTTPS。
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {testResult
                      ? `已验证 ${testResult.version}：安装包${testResult.packageReachable ? '可用' : '缺失'}，校验表${testResult.checksumReachable ? '可用' : '缺失'}`
                      : '保存前建议验证镜像目录结构。'}
                  </span>
                  <Button onClick={() => void testSource()} size="sm" variant="outline">
                    <ShieldCheck />
                    {testing ? '验证中' : '测试下载源'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
        <SheetFooter>
          <DrawerActions
            onCancel={onClose}
            onSubmit={() => void save()}
            submitIcon={<Check size={14} />}
            submitting={saving}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
