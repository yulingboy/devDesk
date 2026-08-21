import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function validateReleaseTag(tag, version) {
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error(`发布标签格式无效：${tag}`)
  }
  const expected = `v${version}`
  if (tag !== expected) throw new Error(`发布标签 ${tag} 与 package.json 版本 ${expected} 不一致`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const tag = process.argv[2] ?? ''
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )
  validateReleaseTag(tag, packageJson.version)
  console.log(`发布版本校验通过：${tag}`)
}
