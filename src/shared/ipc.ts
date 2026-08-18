export const IPC = {
  clients: {
    list: 'clients:list',
    create: 'clients:create',
    update: 'clients:update',
    remove: 'clients:remove'
  },
  projects: {
    list: 'projects:list',
    create: 'projects:create',
    update: 'projects:update',
    remove: 'projects:remove'
  },
  entries: {
    list: 'entries:list',
    create: 'entries:create',
    update: 'entries:update',
    remove: 'entries:remove',
    start: 'entries:start',
    stop: 'entries:stop'
  },
  summary: {
    get: 'summary:get'
  },
  dashboard: {
    get: 'dashboard:get'
  },
  invoices: {
    list: 'invoices:list',
    create: 'invoices:create',
    update: 'invoices:update',
    remove: 'invoices:remove',
    detail: 'invoices:detail',
    setItems: 'invoices:setItems',
    nextNumber: 'invoices:nextNumber'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    chooseLogo: 'settings:chooseLogo',
    logoBase64: 'settings:logoBase64'
  },
  fs: {
    writeFile: 'fs:writeFile'
  },
  dialog: {
    savePdf: 'dialog:savePdf'
  },
  app: {
    openPath: 'app:openPath'
  }
} as const