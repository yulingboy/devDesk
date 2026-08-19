import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** 抽屉统一底部操作区，保证取消、提交按钮尺寸和加载文案一致。 */
export function DrawerActions({
  onCancel,
  onSubmit,
  submitting = false,
  submitText = '保存中',
  submitLabel = '保存',
  submitIcon
}: {
  onCancel: () => void
  onSubmit: () => void
  submitting?: boolean
  submitText?: string
  submitLabel?: string
  submitIcon?: ReactNode
}): React.JSX.Element {
  return (
    <>
      <Button onClick={onCancel} variant="secondary">
        取消
      </Button>
      <Button loading={submitting} loadingText={submitText} onClick={onSubmit} variant="success">
        {submitIcon}
        {submitLabel}
      </Button>
    </>
  )
}
