import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { readFileSync, copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  ClientInput,
  EntryFilters,
  InvoiceInput,
  InvoiceItemInput,
  InvoiceIssuer,
  TimeEntryInput
} from '@shared/types'
import { clientRepo } from './db/repos/clients'
import { projectRepo } from './db/repos/projects'
import { entryRepo } from './db/repos/entries'
import { invoiceRepo, buildSummary } from './db/repos/invoices'
import { settingsRepo } from './db/repos/settings'
import { getDashboard, listEntriesForInvoice } from './db/repos/dashboard'

function handle<T, R>(channel: string, fn: (event: Electron.IpcMainInvokeEvent, arg: T) => R | Promise<R>): void {
  ipcMain.handle(channel, (e, arg: T) => {
    try {
      return fn(e, arg)
    } catch (err) {
      console.error(`[${channel}]`, err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })
}

export function registerIpc(): void {
  handle(IPC.clients.list, () => clientRepo.list())
  handle(IPC.clients.create, (_e, input: ClientInput) => clientRepo.create(input))
  handle(IPC.clients.update, (_e, arg: { id: number; input: Partial<ClientInput> }) => clientRepo.update(arg.id, arg.input))
  handle(IPC.clients.remove, (_e, id: number) => clientRepo.remove(id))

  handle(IPC.projects.list, () => projectRepo.list())
  handle(IPC.projects.create, (_e, input: Parameters<typeof projectRepo.create>[0]) => projectRepo.create(input))
  handle(IPC.projects.update, (_e, arg: { id: number; input: Partial<Parameters<typeof projectRepo.create>[0]> }) =>
    projectRepo.update(arg.id, arg.input)
  )
  handle(IPC.projects.remove, (_e, id: number) => projectRepo.remove(id))

  handle(IPC.entries.list, () => entryRepo.list())
  handle(IPC.entries.create, (_e, input: TimeEntryInput) => entryRepo.create(input))
  handle(IPC.entries.update, (_e, arg: { id: number; input: Partial<TimeEntryInput> }) => entryRepo.update(arg.id, arg.input))
  handle(IPC.entries.remove, (_e, id: number) => entryRepo.remove(id))
  handle(IPC.entries.start, (_e, arg: { name: string; project_id: number | null }) =>
    entryRepo.create({ name: arg.name, project_id: arg.project_id, start_at: new Date().toISOString(), end_at: null })
  )
  handle(IPC.entries.stop, (_e, id: number) => entryRepo.update(id, { end_at: new Date().toISOString() }))

  handle(IPC.summary.get, (_e, filters: EntryFilters) => buildSummary(filters))
  handle(IPC.dashboard.get, () => getDashboard())

  handle(IPC.invoices.list, () => invoiceRepo.list())
  handle(IPC.invoices.create, (_e, input: InvoiceInput) => invoiceRepo.create(input))
  handle(IPC.invoices.update, (_e, arg: { id: number; input: Partial<InvoiceInput> }) => invoiceRepo.update(arg.id, arg.input))
  handle(IPC.invoices.remove, (_e, id: number) => invoiceRepo.remove(id))
  handle(IPC.invoices.detail, (_e, id: number) => invoiceRepo.detail(id))
  handle(IPC.invoices.setItems, (_e, arg: { id: number; items: InvoiceItemInput[] }) => invoiceRepo.setItems(arg.id, arg.items))
  handle(IPC.invoices.nextNumber, () => invoiceRepo.nextNumber())
  handle('invoices:entries', (_e, filters: EntryFilters) => listEntriesForInvoice(filters))

  handle(IPC.settings.get, () => settingsRepo.get())
  handle(IPC.settings.set, (_e, s: import('@shared/types').AppSettings) => settingsRepo.set(s))
  handle(IPC.settings.chooseLogo, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose invoice logo',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }
      ],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths.length) return settingsRepo.get().issuer.logo_path
    const src = res.filePaths[0]
    const ext = src.split('.').pop()?.toLowerCase() ?? 'png'
    const dest = join(app.getPath('userData'), `logo.${ext}`)
    copyFileSync(src, dest)
    settingsRepo.patchIssuer({ logo_path: dest })
    return dest
  })

  handle(IPC.settings.logoBase64, () => readLogoBase64(settingsRepo.get().issuer.logo_path))

  handle(IPC.fs.writeFile, (_e, arg: { path: string; base64: string }) => {
    writeFileSync(arg.path, Buffer.from(arg.base64, 'base64'))
  })

  handle(IPC.dialog.savePdf, async (_e, arg: { defaultName: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const res = await dialog.showSaveDialog(win!, {
      title: 'Export PDF',
      defaultPath: arg.defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (res.canceled || !res.filePath) return null
    return res.filePath
  })

  handle(IPC.app.openPath, async (_e, path: string) => {
    await shell.openPath(path)
  })
}

export function readLogoBase64(logoPath: string): string | null {
  if (!logoPath) return null
  try {
    const buf = readFileSync(logoPath)
    const ext = logoPath.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}