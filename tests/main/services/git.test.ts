import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { initializeStore, store } from '@main/infrastructure/store'
import { verifyWorkspaceGitIdentity } from '@main/services/git'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('工作区 Git 身份验证', () => {
  it('读取真实仓库最终生效的值和来源', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devdesk-git-'))
    temporaryDirectories.push(directory)
    await initializeStore({ userData: directory, data: directory, logs: directory })
    const repository = join(directory, 'repository')
    await execFileAsync('git', ['init', repository])
    await execFileAsync('git', ['-C', repository, 'config', 'user.name', 'Alice'])
    await execFileAsync('git', ['-C', repository, 'config', 'user.email', 'alice@example.com'])
    await store.gitIdentities.write([
      { id: 'git-alice', name: 'Alice', username: 'Alice', email: 'alice@example.com' }
    ])
    await store.workspaces.write([
      {
        id: 'workspace-one',
        name: '工作区',
        rootPath: directory,
        description: '',
        gitIdentityId: 'git-alice',
        projects: [
          { id: 'project-one', workspaceId: 'workspace-one', name: 'repository', path: repository }
        ]
      }
    ])

    const result = await verifyWorkspaceGitIdentity('workspace-one')

    expect(result.repositoryFound).toBe(true)
    expect(result.username).toMatchObject({ actual: 'Alice', expected: 'Alice', matches: true })
    expect(result.email).toMatchObject({
      actual: 'alice@example.com',
      expected: 'alice@example.com',
      matches: true
    })
    expect(result.username.source).toContain('.git/config')
  })
})
