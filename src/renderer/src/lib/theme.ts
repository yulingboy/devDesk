import type { ThemeName } from '@shared/domain'

/** 把持久化主题映射到根节点，系统模式会随系统明暗偏好变化。 */
export function applyTheme(theme: ThemeName): void {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.dataset.theme = resolved
}
