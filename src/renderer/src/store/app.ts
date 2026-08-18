import { create } from 'zustand'
import type { AppSettings, ThemeMode } from '@shared/types'

export type ViewKey = 'dashboard' | 'tracker' | 'clients' | 'projects' | 'summary' | 'invoices'

interface AppState {
  view: ViewKey
  settings: AppSettings | null
  setView: (v: ViewKey) => void
  loadSettings: () => Promise<void>
  setTheme: (t: ThemeMode) => Promise<void>
  updateIssuer: (patch: Partial<AppSettings['issuer']>) => Promise<void>
  setSettings: (s: AppSettings) => Promise<void>
}

function applyTheme(theme: ThemeMode): void {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export const useApp = create<AppState>((set, get) => ({
  view: 'dashboard',
  settings: null,
  setView: (v) => set({ view: v }),
  loadSettings: async () => {
    const settings = await window.api.settings.get()
    set({ settings })
    applyTheme(settings.theme)
  },
  setTheme: async (theme) => {
    const s = get().settings
    if (!s) return
    const next = { ...s, theme }
    set({ settings: next })
    applyTheme(theme)
    await window.api.settings.set(next)
  },
  updateIssuer: async (patch) => {
    const s = get().settings
    if (!s) return
    const next = { ...s, issuer: { ...s.issuer, ...patch } }
    set({ settings: next })
    await window.api.settings.set(next)
  },
  setSettings: async (s) => {
    set({ settings: s })
    applyTheme(s.theme)
    await window.api.settings.set(s)
  }
}))

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { settings } = useApp.getState()
  if (settings?.theme === 'system') applyTheme('system')
})