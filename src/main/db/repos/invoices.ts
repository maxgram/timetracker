import { getDb, entryDurationSql } from '../index'
import { moneyAdd, moneyMul, roundMoney } from '@shared/money'
import type {
  EntryFilters,
  Invoice,
  InvoiceDetail,
  InvoiceInput,
  InvoiceItem,
  InvoiceItemInput,
  SummaryData
} from '@shared/types'

const INV_COLS = `i.id, i.number, i.client_id, i.status, i.issue_date, i.due_date, i.tax_rate, i.notes, i.created_at,
  c.name AS client_name,
  COALESCE((SELECT SUM(ii.amount) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0) AS subtotal,
  ROUND(COALESCE((SELECT SUM(ii.amount) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0) * i.tax_rate / 100.0, 2) AS tax_amount,
  ROUND(COALESCE((SELECT SUM(ii.amount) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0) * (1 + i.tax_rate / 100.0), 2) AS total`

function rowToInvoice(r: Record<string, unknown>): Invoice {
  return {
    id: r.id as number,
    number: r.number as string,
    client_id: r.client_id as number,
    status: r.status as Invoice['status'],
    issue_date: r.issue_date as string,
    due_date: r.due_date as string,
    tax_rate: Number(r.tax_rate),
    notes: (r.notes as string) ?? '',
    created_at: r.created_at as string,
    client_name: (r.client_name as string | null) ?? null,
    total: Number(r.total),
    tax_amount: Number(r.tax_amount)
  }
}

export const invoiceRepo = {
  list(): Invoice[] {
    return (
      getDb()
        .prepare(`SELECT ${INV_COLS} FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.created_at DESC`)
        .all() as Record<string, unknown>[]
    ).map(rowToInvoice)
  },

  get(id: number): Invoice | null {
    const row = getDb()
      .prepare(`SELECT ${INV_COLS} FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = ?`)
      .get(id) as Record<string, unknown> | undefined
    return row ? rowToInvoice(row) : null
  },

  create(input: InvoiceInput): Invoice {
    const res = getDb()
      .prepare(
        `INSERT INTO invoices (number, client_id, status, issue_date, due_date, tax_rate, notes) VALUES (@number, @client_id, @status, @issue_date, @due_date, @tax_rate, @notes)`
      )
      .run(input)
    return this.get(Number(res.lastInsertRowid))!
  },

  update(id: number, input: Partial<InvoiceInput>): Invoice {
    const cur = this.get(id)
    if (!cur) throw new Error(`Invoice ${id} not found`)
    getDb()
      .prepare(
        `UPDATE invoices SET number=@number, client_id=@client_id, status=@status, issue_date=@issue_date, due_date=@due_date, tax_rate=@tax_rate, notes=@notes WHERE id=@id`
      )
      .run({ ...cur, ...input })
    return this.get(id)!
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM invoices WHERE id = ?').run(id)
  },

  items(invoiceId: number): InvoiceItem[] {
    return (
      getDb()
        .prepare(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id`)
        .all(invoiceId) as Record<string, unknown>[]
    ).map((r) => ({
      id: r.id as number,
      invoice_id: r.invoice_id as number,
      description: r.description as string,
      hours: Number(r.hours),
      unit_price: Number(r.unit_price),
      amount: Number(r.amount)
    }))
  },

  setItems(invoiceId: number, items: InvoiceItemInput[]): InvoiceItem[] {
    const tx = getDb().transaction(() => {
      getDb().prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId)
      const ins = getDb().prepare(
        `INSERT INTO invoice_items (invoice_id, description, hours, unit_price, amount) VALUES (?, ?, ?, ?, ?)`
      )
      for (const it of items) {
        ins.run(invoiceId, it.description, it.hours, it.unit_price, moneyMul(it.hours, it.unit_price))
      }
    })
    tx()
    return this.items(invoiceId)
  },

  nextNumber(): string {
    const row = getDb().prepare(`SELECT COUNT(*) AS n FROM invoices`).get() as { n: number }
    const year = new Date().getFullYear()
    return `INV-${year}-${String(row.n + 1).padStart(4, '0')}`
  },

  detail(id: number): InvoiceDetail | null {
    const inv = this.get(id)
    if (!inv) return null
    const client = inv.client_id
      ? (getDb().prepare(`SELECT * FROM clients WHERE id = ?`).get(inv.client_id) as Record<string, unknown> | undefined)
      : undefined
    return {
      ...inv,
      items: this.items(id),
      client: client
        ? {
            id: client.id as number,
            name: client.name as string,
            email: (client.email as string) ?? '',
            phone: (client.phone as string) ?? '',
            address: (client.address as string) ?? '',
            tax_id: (client.tax_id as string) ?? '',
            notes: (client.notes as string) ?? '',
            created_at: client.created_at as string
          }
        : null
    }
  }
}

export function buildSummary(filters: EntryFilters): SummaryData {
  const where: string[] = []
  const params: Record<string, unknown> = {}
  if (filters.from) {
    where.push(`date(t.start_at, 'localtime') >= date(@from)`)
    params.from = filters.from
  }
  if (filters.to) {
    where.push(`date(t.start_at, 'localtime') <= date(@to)`)
    params.to = filters.to
  }
  if (filters.project_id != null) {
    where.push(`t.project_id = @projectId`)
    params.projectId = filters.project_id
  } else if (filters.client_id != null) {
    where.push(`p.client_id = @clientId`)
    params.clientId = filters.client_id
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const duration = entryDurationSql('t.end_at', 't.start_at')

  const rows = (
    getDb()
      .prepare(
        `SELECT t.id AS entry_id, t.name, date(t.start_at, 'localtime') AS date, t.project_id, p.name AS project_name, c.name AS client_name,
           ROUND(${duration} / 3600.0, 2) AS hours, p.hourly_rate
         FROM time_entries t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN clients c ON c.id = p.client_id
         ${whereSql}
         ORDER BY date(t.start_at, 'localtime') DESC, t.start_at DESC`
      )
      .all(params) as Record<string, unknown>[]
  ).map((r) => ({
    entry_id: r.entry_id as number,
    name: r.name as string,
    date: r.date as string,
    project_id: r.project_id as number | null,
    project_name: (r.project_name as string | null) ?? null,
    client_name: (r.client_name as string | null) ?? null,
    hours: Number(r.hours),
    amount: r.hourly_rate == null ? null : moneyMul(Number(r.hours), Number(r.hourly_rate))
  }))

  const perProject = new Map<number | null, { project_name: string | null; hours: number; amount: number | null }>()
  const perDay = new Map<string, { hours: number; amount: number | null }>()
  let hours = 0
  let amount: number | null = null
  for (const r of rows) {
    hours += r.hours
    if (r.amount != null) amount = moneyAdd(amount ?? 0, r.amount)
    const pp = perProject.get(r.project_id) ?? { project_name: r.project_name, hours: 0, amount: null }
    pp.hours += r.hours
    if (r.amount != null) pp.amount = moneyAdd(pp.amount ?? 0, r.amount)
    perProject.set(r.project_id, pp)
    const pd = perDay.get(r.date) ?? { hours: 0, amount: null }
    pd.hours += r.hours
    if (r.amount != null) pd.amount = moneyAdd(pd.amount ?? 0, r.amount)
    perDay.set(r.date, pd)
  }

  return {
    rows,
    totals: { hours: Number(hours.toFixed(2)), amount: amount == null ? null : roundMoney(amount) },
    perProject: [...perProject.entries()].map(([project_id, v]) => ({ project_id, ...v })).sort((a, b) => b.hours - a.hours),
    perDay: [...perDay.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => (a.date < b.date ? 1 : -1))
  }
}