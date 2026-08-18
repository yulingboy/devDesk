import { lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app/AppShell'

const GitPage = lazy(() => import('@/pages/git').then((module) => ({ default: module.GitPage })))
const HomePage = lazy(() => import('@/pages/home').then((module) => ({ default: module.HomePage })))
const HostsPage = lazy(() =>
  import('@/pages/hosts').then((module) => ({ default: module.HostsPage }))
)
const NodePage = lazy(() => import('@/pages/node').then((module) => ({ default: module.NodePage })))
const SettingsPage = lazy(() =>
  import('@/pages/settings').then((module) => ({ default: module.SettingsPage }))
)
const SshPage = lazy(() => import('@/pages/ssh').then((module) => ({ default: module.SshPage })))
const TemplatesPage = lazy(() =>
  import('@/pages/templates').then((module) => ({ default: module.TemplatesPage }))
)
const WorkspacesPage = lazy(() =>
  import('@/pages/workspaces').then((module) => ({ default: module.WorkspacesPage }))
)

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell appVersion="1.0.0" />}>
          <Route element={<HomePage />} index />
          <Route element={<HostsPage />} path="hosts" />
          <Route element={<GitPage />} path="git" />
          <Route element={<SshPage />} path="ssh" />
          <Route element={<WorkspacesPage />} path="workspaces" />
          <Route element={<TemplatesPage />} path="templates" />
          <Route element={<NodePage />} path="node" />
          <Route element={<SettingsPage />} path="settings" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </HashRouter>
  )
}
