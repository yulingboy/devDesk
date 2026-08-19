import { useEffect, useState } from 'react'
import { Check, Download, RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { AppUpdateState, RuntimeInfo } from '@shared/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { SettingsSection } from './SettingsSection'

export function AboutPanel({
  runtime,
  error
}: {
  runtime: RuntimeInfo | null
  error?: string
}): React.JSX.Element {
  const [update, setUpdate] = useState<AppUpdateState>({
    status: 'idle',
    currentVersion: runtime?.appVersion ?? '--'
  })
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    const updateApi = window.api?.update
    if (!updateApi) return
    let active = true
    void updateApi
      .getState()
      .then((value) => {
        if (active) setUpdate(value)
      })
      .catch(() => undefined)
    const unsubscribe = updateApi.onStateChanged((value) => {
      if (active) {
        setUpdate(value)
        if (value.status === 'error' && value.message) setUpdateError(value.message)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const runUpdateAction = async (action: () => Promise<AppUpdateState>): Promise<void> => {
    setUpdateError('')
    try {
      setUpdate(await action())
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '更新操作失败，请稍后重试'
      setUpdateError(message)
      toast.error(message)
    }
  }

  const installUpdate = async (): Promise<void> => {
    setUpdateError('')
    try {
      await window.api!.update.install()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '安装更新失败，请稍后重试'
      setUpdateError(message)
      toast.error(message)
    }
  }

  const statusText: Record<AppUpdateState['status'], string> = {
    disabled: '开发模式',
    idle: '尚未检查',
    checking: '检查中',
    available: '有新版本',
    'not-available': '已是最新',
    downloading: '下载中',
    downloaded: '等待安装',
    error: '检查失败'
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {updateError && (
        <Alert className="mb-3" variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{updateError}</span>
            <Button
              onClick={() => setUpdateError('')}
              size="icon"
              title="关闭错误提示"
              variant="ghost"
            >
              <RotateCcw />
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card className="overflow-hidden">
        <SettingsSection
          actions={
            <Badge variant={update.status === 'error' ? 'outline' : 'secondary'}>
              {statusText[update.status]}
            </Badge>
          }
          description="从 GitHub Releases 获取新版本，下载完成后由你确认重启安装。"
          title="应用更新"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="min-w-0 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>当前版本</span>
                <span className="font-mono text-slate-800">
                  v{runtime?.appVersion ?? update.currentVersion}
                </span>
                {update.version && update.status === 'available' && (
                  <span className="text-[11px] text-[var(--accent)]">
                    可升级至 v{update.version}
                  </span>
                )}
              </div>
              {update.message && (
                <p className="mt-1 text-[11px] text-slate-400">{update.message}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(update.status === 'idle' ||
                update.status === 'not-available' ||
                update.status === 'error') && (
                <Button
                  onClick={() => void runUpdateAction(() => window.api!.update.check())}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw />
                  检查更新
                </Button>
              )}
              {update.status === 'available' && (
                <Button
                  onClick={() => void runUpdateAction(() => window.api!.update.download())}
                  size="sm"
                >
                  <Download />
                  下载更新
                </Button>
              )}
              {update.status === 'downloaded' && (
                <Button onClick={() => void installUpdate()} size="sm">
                  <Check />
                  重启并安装
                </Button>
              )}
            </div>
          </div>
          {update.status === 'downloading' && (
            <div className="mt-3 space-y-1.5">
              <Progress value={update.progress ?? 0} />
              <div className="text-right text-[11px] text-slate-400">{update.progress ?? 0}%</div>
            </div>
          )}
          {update.releaseNotes && update.status === 'available' && (
            <div className="mt-3 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] leading-4 text-slate-500">
              {update.releaseNotes}
            </div>
          )}
        </SettingsSection>
        <SettingsSection description="DevDesk 本地开发环境管理工具" title="应用信息">
          <dl className="grid gap-x-6 gap-y-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-[11px] text-slate-400">应用版本</dt>
              <dd className="mt-1 font-mono">{runtime?.appVersion ?? '--'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Electron / Chrome</dt>
              <dd className="mt-1 font-mono">
                {runtime ? `${runtime.versions.electron} / ${runtime.versions.chrome}` : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Node / 架构</dt>
              <dd className="mt-1 font-mono">
                {runtime ? `${runtime.versions.node} / ${runtime.arch}` : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">构建时间</dt>
              <dd className="mt-1 font-mono">
                {runtime ? new Date(runtime.buildDate).toLocaleString('zh-CN') : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">平台</dt>
              <dd className="mt-1 font-mono">
                {runtime ? `${runtime.platform} / ${runtime.arch}` : '--'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">许可证</dt>
              <dd className="mt-1">MIT License</dd>
            </div>
          </dl>
        </SettingsSection>
      </Card>
    </div>
  )
}
