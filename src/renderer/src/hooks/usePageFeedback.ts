import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { rendererLogger } from '@/lib/logger'
import { toErrorMessage } from '@/lib/errors'

export interface PageFeedbackOptions {
  /** 不需要页面内错误区块时可关闭，仅保留 toast 与日志。 */
  keepStatus?: boolean
}

/**
 * 统一页面错误反馈，避免每个资源页重复维护状态、toast 和日志。
 * 该 Hook 只负责反馈，不拦截异常，也不改变调用方的业务流程。
 */
export function usePageFeedback(
  logMessage: string,
  { keepStatus = true }: PageFeedbackOptions = {}
): {
  status: string
  report: (error: unknown) => void
  clearError: () => void
} {
  const [status, setStatus] = useState('')

  const report = useCallback(
    (error: unknown): void => {
      const message = toErrorMessage(error)
      if (keepStatus) setStatus(message)
      toast.error(message)
      rendererLogger.error(logMessage, { error: message })
    },
    [keepStatus, logMessage]
  )

  const clearError = useCallback((): void => setStatus(''), [])

  return { status, report, clearError }
}
