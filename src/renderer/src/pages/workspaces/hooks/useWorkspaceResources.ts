import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { GitIdentity, ProjectTemplate, SSHKey, Workspace } from '@shared/domain'
import { toErrorMessage } from '@/lib/errors'
import { rendererLogger } from '@/lib/logger'
import { useInitialLoad } from '@/hooks/useInitialLoad'

/**
 * 集中读取工作区页依赖的四类资源，并维护刷新后的有效选择项。
 * Git、SSH 或模板读取失败不会阻止用户查看工作区主体。
 */
export function useWorkspaceResources(report: (error: unknown) => void): {
  workspaces: Workspace[]
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>
  identities: GitIdentity[]
  sshKeys: SSHKey[]
  templates: ProjectTemplate[]
  loading: boolean
  selectedWorkspaceId: string | undefined
  setSelectedWorkspaceId: React.Dispatch<React.SetStateAction<string | undefined>>
  selectedProjectId: string | undefined
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string | undefined>>
  reload: () => Promise<void>
} {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [identities, setIdentities] = useState<GitIdentity[]>([])
  const [sshKeys, setSshKeys] = useState<SSHKey[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>()
  const [selectedProjectId, setSelectedProjectId] = useState<string>()
  const requestId = useRef(0)

  const reload = useCallback(async (): Promise<void> => {
    const currentRequestId = ++requestId.current
    const workspaceRequest = Promise.resolve(window.api?.workspaces.list())
      .then((value) => {
        if (currentRequestId !== requestId.current || !value) return
        setWorkspaces(value)
        setSelectedWorkspaceId((current) =>
          current && value.some((item) => item.id === current) ? current : value[0]?.id
        )
        setSelectedProjectId((current) => {
          if (!current) return undefined
          return value.some((workspace) => workspace.projects.some((item) => item.id === current))
            ? current
            : undefined
        })
      })
      .catch(report)
      .finally(() => {
        // 工作区列表是首屏必需数据，辅助资源不再阻塞主视图展示。
        if (currentRequestId === requestId.current) setLoading(false)
      })

    const optionalRequests = Promise.allSettled([
      Promise.resolve(window.api?.git.getState()),
      Promise.resolve(window.api?.ssh.list()),
      Promise.resolve(window.api?.templates.list())
    ]).then(([gitResult, sshResult, templateResult]) => {
      if (currentRequestId !== requestId.current) return
      const optionalResults = [
        ['Git 身份', gitResult],
        ['SSH 密钥', sshResult],
        ['项目模板', templateResult]
      ] as const
      for (const [label, result] of optionalResults) {
        if (result.status !== 'rejected') continue
        const message = toErrorMessage(result.reason)
        toast.warning(`${label}加载失败：${message}`)
        rendererLogger.warn(`${label}加载失败`, { error: message })
      }
      if (gitResult.status === 'fulfilled' && gitResult.value)
        setIdentities(gitResult.value.identities)
      if (sshResult.status === 'fulfilled' && sshResult.value) setSshKeys(sshResult.value)
      if (templateResult.status === 'fulfilled' && templateResult.value)
        setTemplates(templateResult.value)
    })

    // reload 仍等待辅助资源，手动刷新按钮可以准确反馈“全部资源已更新”。
    await Promise.all([workspaceRequest, optionalRequests])
  }, [report])

  useInitialLoad(reload)

  return {
    workspaces,
    setWorkspaces,
    identities,
    sshKeys,
    templates,
    loading,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedProjectId,
    setSelectedProjectId,
    reload
  }
}
