import { isAbsolute, normalize, sep } from 'node:path'

/** 归档成员必须是相对路径，且规范化后不能逃逸解压根目录。 */
export function assertSafeArchiveEntryPath(entryInput: string): void {
  const entry = entryInput.trim().replace(/\\/g, '/')
  if (!entry) return
  if (entry.includes('\0') || entry.startsWith('/') || /^[A-Za-z]:\//.test(entry)) {
    throw new Error(`安装包包含不安全的绝对路径：${entryInput}`)
  }
  const normalized = normalize(entry).replaceAll(sep, '/')
  if (isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`安装包路径超出解压目录：${entryInput}`)
  }
}

export function validateArchiveEntries(entries: string[]): void {
  for (const entry of entries) assertSafeArchiveEntryPath(entry)
}
