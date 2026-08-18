import { getDb } from '../index'
import type { AppSettings, InvoiceIssuer, ThemeMode } from '@shared/types'

const DEFAULTS: AppSettings = {
  theme: 'system',
  issuer: {
    company_name: '',
    address: '',
    email: '',
    phone: '',
    tax_id: '',
    bank_details: '',
    currency: 'USD',
    logo_path: ''
  }
}

function get(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined
  return row?.value ?? null
}

function set(key: string, value: string): void {
  getDb().prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value)
}

export const settingsRepo = {
  get(): AppSettings {
    const raw = get('app_settings')
    if (!raw) return structuredClone(DEFAULTS)
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        theme: parsed.theme ?? DEFAULTS.theme,
        issuer: { ...DEFAULTS.issuer, ...(parsed.issuer ?? {}) }
      }
    } catch {
      return structuredClone(DEFAULTS)
    }
  },

  set(settings: AppSettings): AppSettings {
    set('app_settings', JSON.stringify(settings))
    return settings
  },

  patchTheme(theme: ThemeMode): AppSettings {
    const s = this.get()
    s.theme = theme
    return this.set(s)
  },

  patchIssuer(issuer: Partial<InvoiceIssuer>): AppSettings {
    const s = this.get()
    s.issuer = { ...s.issuer, ...issuer }
    return this.set(s)
  }
}