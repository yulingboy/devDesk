import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { GitPage } from '@/pages/git'
import { HomePage } from '@/pages/home'
import { HostsPage } from '@/pages/hosts'
import { NodePage } from '@/pages/node'
import { SettingsPage } from '@/pages/settings'
import { SshPage } from '@/pages/ssh'
import { TemplatesPage } from '@/pages/templates'
import { WorkspacesPage } from '@/pages/workspaces'

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
