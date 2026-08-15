import { Toaster as Sonner } from 'sonner'
export function Toaster(): React.JSX.Element {
  return (
    <Sonner
      closeButton
      position="bottom-right"
      richColors
      toastOptions={{ className: 'text-xs' }}
    />
  )
}
