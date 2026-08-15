import type { ThemeName } from '@shared/domain'

const themeNames: ThemeName[] = [
  'blue',
  'purple',
  'green',
  'orange',
  'rose',
  'cyan',
  'indigo',
  'teal'
]

/** 旧版本主题统一迁移为蓝色，避免升级后主题选择处于无效状态。 */
export function applyTheme(theme: ThemeName | string): void {
  const resolved = themeNames.includes(theme as ThemeName) ? theme : 'blue'
  document.documentElement.dataset.themeColor = resolved
}
