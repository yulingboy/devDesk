import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/** 测试复用主进程与共享层的路径别名，避免契约测试出现双重导入。 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
