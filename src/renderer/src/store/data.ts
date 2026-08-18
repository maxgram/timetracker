import { create } from 'zustand'
import type { Client, Invoice, ProjectWithClient, TimeEntry } from '@shared/types'

interface DataState {
  clients: Client[]
  projects: ProjectWithClient[]
  entries: TimeEntry[]
  invoices: Invoice[]
  loaded: boolean
  refreshAll: () => Promise<void>
  refreshClients: () => Promise<void>
  refreshProjects: () => Promise<void>
  refreshEntries: () => Promise<void>
  refreshInvoices: () => Promise<void>
}

export const useData = create<DataState>((set, get) => ({
  clients: [],
  projects: [],
  entries: [],
  invoices: [],
  loaded: false,
  refreshClients: async () => {
    set({ clients: await window.api.clients.list() })
  },
  refreshProjects: async () => {
    set({ projects: await window.api.projects.list() })
  },
  refreshEntries: async () => {
    set({ entries: await window.api.entries.list() })
  },
  refreshInvoices: async () => {
    set({ invoices: await window.api.invoices.list() })
  },
  refreshAll: async () => {
    const [clients, projects, entries, invoices] = await Promise.all([
      window.api.clients.list(),
      window.api.projects.list(),
      window.api.entries.list(),
      window.api.invoices.list()
    ])
    set({ clients, projects, entries, invoices, loaded: true })
  }
}))

export const useNow = create<{ now: number; tick: () => void }>((set) => ({
  now: Date.now(),
  tick: () => set({ now: Date.now() })
}))