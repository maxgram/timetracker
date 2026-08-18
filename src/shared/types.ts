export type ThemeMode = 'light' | 'dark' | 'system'

export interface Client {
  id: number
  name: string
  email: string
  phone: string
  address: string
  tax_id: string
  notes: string
  created_at: string
}

export interface ClientInput {
  name: string
  email?: string
  phone?: string
  address?: string
  tax_id?: string
  notes?: string
}

export interface Project {
  id: number
  client_id: number | null
  name: string
  hourly_rate: number
  notes: string
  created_at: string
}

export interface ProjectInput {
  client_id: number | null
  name: string
  hourly_rate: number
  notes?: string
}

export interface ProjectWithClient extends Project {
  client_name: string | null
}

export interface TimeEntry {
  id: number
  project_id: number | null
  name: string
  start_at: string
  end_at: string | null
  notes: string
  created_at: string
  /** seconds, null while running */
  duration: number | null
  project_name: string | null
  client_name: string | null
  hourly_rate: number | null
  /** entry is currently running */
  running: boolean
}

export interface TimeEntryInput {
  project_id: number | null
  name: string
  start_at: string
  end_at: string | null
  notes?: string
}

export interface EntryDay {
  date: string
  total: number
  entries: TimeEntry[]
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface InvoiceItem {
  id: number
  invoice_id: number
  description: string
  hours: number
  unit_price: number
  amount: number
}

export interface Invoice {
  id: number
  number: string
  client_id: number
  status: InvoiceStatus
  issue_date: string
  due_date: string
  tax_rate: number
  notes: string
  created_at: string
  client_name: string | null
  total: number
  tax_amount: number
}

export interface InvoiceInput {
  number: string
  client_id: number
  status: InvoiceStatus
  issue_date: string
  due_date: string
  tax_rate: number
  notes: string
}

export interface InvoiceItemInput {
  description: string
  hours: number
  unit_price: number
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[]
  client: Client | null
}

export interface InvoiceIssuer {
  company_name: string
  address: string
  email: string
  phone: string
  tax_id: string
  bank_details: string
  currency: string
  logo_path: string
}

export interface AppSettings {
  theme: ThemeMode
  issuer: InvoiceIssuer
}

export interface EntryFilters {
  from?: string | null
  to?: string | null
  client_id?: number | null
  project_id?: number | null
}

export interface SummaryRow {
  entry_id: number
  name: string
  date: string
  project_id: number | null
  project_name: string | null
  client_name: string | null
  hours: number
  amount: number | null
}

export interface SummaryTotals {
  hours: number
  amount: number | null
}

export interface SummaryData {
  rows: SummaryRow[]
  totals: SummaryTotals
  perProject: { project_id: number | null; project_name: string | null; hours: number; amount: number | null }[]
  perDay: { date: string; hours: number; amount: number | null }[]
}

export interface DashboardStats {
  today: number
  week: number
  month: number
  total: number
  running: number
  perProject: { project_id: number | null; project_name: string | null; hours: number }[]
  last7days: { date: string; hours: number }[]
  recent: TimeEntry[]
}

export interface EntriesResult {
  running: TimeEntry[]
  days: EntryDay[]
}