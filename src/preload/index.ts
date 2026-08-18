import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppSettings,
  Client,
  ClientInput,
  DashboardStats,
  EntryFilters,
  Invoice,
  InvoiceDetail,
  InvoiceInput,
  InvoiceItemInput,
  Project,
  ProjectInput,
  ProjectWithClient,
  SummaryData,
  TimeEntry,
  TimeEntryInput
} from '@shared/types'

const api = {
  clients: {
    list: (): Promise<Client[]> => ipcRenderer.invoke(IPC.clients.list),
    create: (input: ClientInput): Promise<Client> => ipcRenderer.invoke(IPC.clients.create, input),
    update: (id: number, input: Partial<ClientInput>): Promise<Client> => ipcRenderer.invoke(IPC.clients.update, { id, input }),
    remove: (id: number): Promise<void> => ipcRenderer.invoke(IPC.clients.remove, id)
  },
  projects: {
    list: (): Promise<ProjectWithClient[]> => ipcRenderer.invoke(IPC.projects.list),
    create: (input: ProjectInput): Promise<ProjectWithClient> => ipcRenderer.invoke(IPC.projects.create, input),
    update: (id: number, input: Partial<ProjectInput>): Promise<ProjectWithClient> =>
      ipcRenderer.invoke(IPC.projects.update, { id, input }),
    remove: (id: number): Promise<void> => ipcRenderer.invoke(IPC.projects.remove, id)
  },
  entries: {
    list: (): Promise<TimeEntry[]> => ipcRenderer.invoke(IPC.entries.list),
    create: (input: TimeEntryInput): Promise<TimeEntry> => ipcRenderer.invoke(IPC.entries.create, input),
    update: (id: number, input: Partial<TimeEntryInput>): Promise<TimeEntry> => ipcRenderer.invoke(IPC.entries.update, { id, input }),
    remove: (id: number): Promise<void> => ipcRenderer.invoke(IPC.entries.remove, id),
    start: (name: string, project_id: number | null): Promise<TimeEntry> => ipcRenderer.invoke(IPC.entries.start, { name, project_id }),
    stop: (id: number): Promise<TimeEntry> => ipcRenderer.invoke(IPC.entries.stop, id)
  },
  summary: {
    get: (filters: EntryFilters): Promise<SummaryData> => ipcRenderer.invoke(IPC.summary.get, filters)
  },
  dashboard: {
    get: (): Promise<DashboardStats> => ipcRenderer.invoke(IPC.dashboard.get)
  },
  invoices: {
    list: (): Promise<Invoice[]> => ipcRenderer.invoke(IPC.invoices.list),
    create: (input: InvoiceInput): Promise<Invoice> => ipcRenderer.invoke(IPC.invoices.create, input),
    update: (id: number, input: Partial<InvoiceInput>): Promise<Invoice> => ipcRenderer.invoke(IPC.invoices.update, { id, input }),
    remove: (id: number): Promise<void> => ipcRenderer.invoke(IPC.invoices.remove, id),
    detail: (id: number): Promise<InvoiceDetail | null> => ipcRenderer.invoke(IPC.invoices.detail, id),
    setItems: (id: number, items: InvoiceItemInput[]): Promise<unknown> => ipcRenderer.invoke(IPC.invoices.setItems, { id, items }),
    nextNumber: (): Promise<string> => ipcRenderer.invoke(IPC.invoices.nextNumber),
    entries: (filters: EntryFilters): Promise<TimeEntry[]> => ipcRenderer.invoke('invoices:entries', filters)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settings.get),
    set: (s: AppSettings): Promise<AppSettings> => ipcRenderer.invoke(IPC.settings.set, s),
    chooseLogo: (): Promise<string> => ipcRenderer.invoke(IPC.settings.chooseLogo),
    logoBase64: (): Promise<string | null> => ipcRenderer.invoke(IPC.settings.logoBase64)
  },
  fs: {
    writeFile: (path: string, base64: string): Promise<void> => ipcRenderer.invoke(IPC.fs.writeFile, { path, base64 })
  },
  dialog: {
    savePdf: (defaultName: string): Promise<string | null> => ipcRenderer.invoke(IPC.dialog.savePdf, { defaultName })
  },
  app: {
    openPath: (path: string): Promise<void> => ipcRenderer.invoke(IPC.app.openPath, path)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)