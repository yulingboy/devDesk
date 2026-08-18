export const IPC_CHANNELS = {
  app: {
    getRuntimeInfo: 'app:get-runtime-info',
    reportError: 'app:report-error',
    writeLog: 'app:write-log'
  },
  dialog: {
    selectDirectory: 'dialog:select-directory'
  },
  window: {
    getState: 'window:get-state',
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize',
    close: 'window:close',
    stateChanged: 'window:state-changed'
  },
  overview: {
    getSnapshot: 'overview:get-snapshot',
    updated: 'overview:updated'
  },
  hosts: {
    list: 'hosts:list',
    save: 'hosts:save',
    restoreBackup: 'hosts:restore-backup',
    openFile: 'hosts:open-file',
    flushDns: 'hosts:flush-dns',
    openDomain: 'hosts:open-domain'
  },
  ssh: {
    list: 'ssh:list',
    save: 'ssh:save',
    generate: 'ssh:generate',
    remove: 'ssh:remove',
    deleteImpact: 'ssh:delete-impact'
  },
  git: {
    getState: 'git:get-state',
    saveGlobal: 'git:save-global',
    saveIdentity: 'git:save-identity',
    removeIdentity: 'git:remove-identity',
    files: 'git:files',
    identityDetail: 'git:identity-detail'
  },
  workspaces: {
    list: 'workspaces:list',
    save: 'workspaces:save',
    remove: 'workspaces:remove',
    scan: 'workspaces:scan',
    open: 'workspaces:open',
    openProject: 'workspaces:open-project',
    openProjectEditor: 'workspaces:open-project-editor',
    scanDetailed: 'workspaces:scan-detailed',
    getProjectDetail: 'workspaces:get-project-detail',
    refreshProject: 'workspaces:refresh-project',
    saveProjectRemark: 'workspaces:save-project-remark',
    addProject: 'workspaces:add-project',
    removeProject: 'workspaces:remove-project',
    installDependencies: 'workspaces:install-dependencies',
    runScript: 'workspaces:run-script',
    tasks: 'workspaces:tasks',
    stopTask: 'workspaces:stop-task',
    taskUpdated: 'workspaces:task-updated'
  },
  templates: {
    list: 'templates:list',
    save: 'templates:save',
    remove: 'templates:remove',
    createProject: 'templates:create-project'
  },
  node: {
    getState: 'node:get-state',
    releases: 'node:releases',
    install: 'node:install',
    switch: 'node:switch',
    useInTerminal: 'node:use-in-terminal',
    remove: 'node:remove',
    registries: 'node:registries',
    saveRegistry: 'node:save-registry',
    removeRegistry: 'node:remove-registry',
    useRegistry: 'node:use-registry',
    testRegistry: 'node:test-registry',
    installNrm: 'node:install-nrm',
    packages: 'node:packages',
    syncGlobalPackages: 'node:sync-global-packages',
    setPackageManager: 'node:set-package-manager',
    setPackageRegistry: 'node:set-package-registry',
    installPackage: 'node:install-package',
    removePackage: 'node:remove-package',
    updatePackage: 'node:update-package',
    scanCaches: 'node:scan-caches',
    clearCaches: 'node:clear-caches',
    clearCache: 'node:clear-cache',
    checkOutdated: 'node:check-outdated',
    environmentPaths: 'node:environment-paths',
    tasks: 'node:tasks',
    cancelTask: 'node:cancel-task',
    retryTask: 'node:retry-task',
    clearTasks: 'node:clear-tasks',
    openPath: 'node:open-path',
    taskUpdated: 'node:task-updated'
  },
  settings: {
    get: 'settings:get',
    save: 'settings:save',
    reset: 'settings:reset',
    export: 'settings:export',
    exportFile: 'settings:export-file',
    import: 'settings:import',
    importFile: 'settings:import-file',
    openData: 'settings:open-data',
    changeDataDirectory: 'settings:change-data-directory',
    clearBusinessData: 'settings:clear-business-data',
    dataStats: 'settings:data-stats',
    logStats: 'settings:log-stats',
    openLogs: 'settings:open-logs',
    clearLogArchives: 'settings:clear-log-archives',
    dataChanged: 'settings:data-changed',
    openDeveloperTools: 'settings:open-developer-tools'
  }
} as const
