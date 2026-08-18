import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  FileText,
  FilePlus2,
  Trash2,
  Download,
  Pencil,
  Plus,
  Settings,
  X,
  Check,
  ImagePlus
} from 'lucide-react'
import { useApp } from '@/store/app'
import { useData } from '@/store/data'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SectionTitle,
  Select,
  Textarea
} from '@/components/ui'
import { dateLabel, formatDuration } from '@/lib/format'
import { buildInvoiceDoc, moneyStr, savePdf } from '@/lib/pdf'
import { moneyAdd, moneyMul, moneyPct } from '@shared/money'
import type { Client, EntryFilters, Invoice, InvoiceDetail, InvoiceItem, InvoiceStatus, TimeEntry } from '@shared/types'

const STATUS_COLORS: Record<InvoiceStatus, 'slate' | 'amber' | 'emerald'> = {
  draft: 'slate',
  sent: 'amber',
  paid: 'emerald'
}

export function IssuerSettings({ onClose }: { onClose: () => void }): ReactNode {
  const { settings, updateIssuer } = useApp()
  const issuer = settings?.issuer
  const [logo, setLogo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(issuer)

  useEffect(() => {
    if (issuer) setForm({ ...issuer })
    window.api.settings.logoBase64().then(setLogo)
  }, [issuer])

  if (!form) return null

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const pickLogo = async (): Promise<void> => {
    setBusy(true)
    try {
      const path = await window.api.settings.chooseLogo()
      if (path) {
        await window.api.settings.set({ ...settings!, issuer: { ...form, logo_path: path } })
        setLogo(await window.api.settings.logoBase64())
        setForm({ ...form, logo_path: path })
      }
    } finally {
      setBusy(false)
    }
  }

  const save = async (): Promise<void> => {
    await updateIssuer({ ...form })
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
        {logo ? (
          <img src={logo} alt="Logo" className="h-16 w-16 rounded-lg bg-white object-contain p-1" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
            <ImagePlus size={24} />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Invoice logo</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, SVG or WebP — shown on exported invoices.</p>
        </div>
        <Button variant="secondary" onClick={pickLogo} disabled={busy}>
          {form.logo_path ? 'Replace' : 'Upload'}
        </Button>
      </div>

      <Field label="Company name">
        <Input value={form.company_name} onChange={set('company_name')} placeholder="Your company" />
      </Field>
      <Field label="Address">
        <Textarea value={form.address} onChange={set('address')} placeholder="Street, City, Country" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="billing@company.com" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
        </Field>
        <Field label="Tax / VAT ID">
          <Input value={form.tax_id} onChange={set('tax_id')} placeholder="VAT-123456" />
        </Field>
        <Field label="Currency">
          <Input value={form.currency} onChange={set('currency')} placeholder="USD" maxLength={3} />
        </Field>
      </div>
      <Field label="Bank / payment details">
        <Textarea value={form.bank_details} onChange={set('bank_details')} placeholder="IBAN / account number / payment terms" />
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>Save Issuer Info</Button>
      </div>
    </div>
  )
}

function AddEntriesModal({ onClose, onAdd }: { onClose: () => void; onAdd: (items: InvoiceItem['id'][], entries: TimeEntry[]) => void }): ReactNode {
  const { clients, projects } = useData()
  const [filters, setFilters] = useState<EntryFilters>({})
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const load = useCallback(async (f: EntryFilters): Promise<void> => {
    const list = await window.api.invoices.entries(f)
    setEntries(list.filter((e) => !e.running && e.end_at))
    setSelected(new Set())
  }, [])

  useEffect(() => {
    load(filters)
  }, [load, filters])

  const toggle = (id: number): void => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const add = (): void => {
    const chosen = entries.filter((e) => selected.has(e.id))
    onAdd(
      chosen.map((e) => e.id),
      chosen
    )
  }

  const totalHours = entries.filter((e) => selected.has(e.id)).reduce((a, e) => a + (e.duration ?? 0) / 3600, 0)

  return (
    <Modal
      open
      title="Add items from time entries"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-slate-500 dark:text-slate-400">
            {selected.size} selected · {formatDuration(totalHours * 3600)}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={add} disabled={selected.size === 0}>
            Add to invoice
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="From">
          <Input type="date" value={filters.from ?? ''} onChange={(e) => setFilters({ ...filters, from: e.target.value || null })} />
        </Field>
        <Field label="To">
          <Input type="date" value={filters.to ?? ''} onChange={(e) => setFilters({ ...filters, to: e.target.value || null })} />
        </Field>
        <Field label="Client">
          <Select value={filters.client_id ?? ''} onChange={(e) => setFilters({ ...filters, client_id: e.target.value ? Number(e.target.value) : null, project_id: null })}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project">
          <Select value={filters.project_id ?? ''} onChange={(e) => setFilters({ ...filters, project_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No completed entries match these filters.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => toggle(e.id)}
              className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 dark:border-slate-800 ${
                selected.has(e.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  selected.has(e.id) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {selected.has(e.id) && <Check size={12} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{e.name || 'Untitled'}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {dateLabel(e.start_at)} · {e.project_name ?? 'No project'} · {e.client_name ?? ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold text-slate-600 dark:text-slate-300">
                {formatDuration(e.duration ?? 0)}
              </span>
              <span className="hidden shrink-0 font-mono text-sm text-slate-500 dark:text-slate-400 sm:inline">
                {e.hourly_rate != null ? moneyStr(e.hourly_rate, '') : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

function InvoiceEditor({ invoice, onClose }: { invoice: InvoiceDetail; onClose: () => void }): ReactNode {
  const { clients, projects, refreshInvoices } = useData()
  const { settings } = useApp()
  const [form, setForm] = useState({
    number: invoice.number,
    client_id: invoice.client_id,
    status: invoice.status,
    issue_date: invoice.issue_date.slice(0, 10),
    due_date: invoice.due_date.slice(0, 10),
    tax_rate: invoice.tax_rate,
    notes: invoice.notes
  })
  const [items, setItems] = useState<InvoiceItem[]>(invoice.items)
  const [addEntries, setAddEntries] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings.logoBase64().then(setLogo)
  }, [])

  const currency = settings?.issuer.currency ?? 'USD'

  const subtotal = items.reduce((a, i) => moneyAdd(a, i.amount), 0)
  const tax = moneyPct(subtotal, form.tax_rate)
  const total = moneyAdd(subtotal, tax)

  const saveInvoice = async (): Promise<Invoice> => {
    const updated = await window.api.invoices.update(invoice.id, {
      ...form,
      issue_date: new Date(`${form.issue_date}T00:00:00`).toISOString(),
      due_date: new Date(`${form.due_date}T00:00:00`).toISOString()
    })
    await window.api.invoices.setItems(invoice.id, items.map((i) => ({ description: i.description, hours: i.hours, unit_price: i.unit_price })))
    await refreshInvoices()
    return updated
  }

  const exportPdf = async (): Promise<void> => {
    setBusy(true)
    try {
      await saveInvoice()
      const detail = await window.api.invoices.detail(invoice.id)
      if (!detail) return
      const doc = buildInvoiceDoc({
        number: detail.number,
        issueDate: form.issue_date,
        dueDate: form.due_date,
        status: detail.status,
        currency,
        issuer: {
          company_name: settings?.issuer.company_name ?? '',
          address: settings?.issuer.address ?? '',
          email: settings?.issuer.email ?? '',
          phone: settings?.issuer.phone ?? '',
          tax_id: settings?.issuer.tax_id ?? '',
          bank_details: settings?.issuer.bank_details ?? '',
          logo
        },
        client: detail.client,
        items: detail.items.map((i) => ({ description: i.description, hours: i.hours, unit_price: i.unit_price, amount: i.amount })),
        taxRate: detail.tax_rate,
        notes: detail.notes
      })
      await savePdf(doc, `invoice-${detail.number}.pdf`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    await window.api.invoices.remove(invoice.id)
    await refreshInvoices()
    setConfirmDelete(false)
    onClose()
  }

  const addFromEntries = (ids: number[], chosen: TimeEntry[]): void => {
    const existing = new Set(items.map((i) => i.description))
    const newItems: InvoiceItem[] = chosen.map((e, i) => ({
      id: Date.now() + i,
      invoice_id: invoice.id,
      description: e.name || 'Untitled',
      hours: Number(((e.duration ?? 0) / 3600).toFixed(2)),
      unit_price: e.hourly_rate ?? 0,
      amount: moneyMul(((e.duration ?? 0) / 3600), (e.hourly_rate ?? 0))
    }))
    setItems([...items, ...newItems.filter((n) => !existing.has(n.description))])
    setAddEntries(false)
    void ids
  }

  const updateItem = (id: number, patch: Partial<InvoiceItem>): void => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const next = { ...i, ...patch }
        next.hours = Number(next.hours) || 0
        next.unit_price = Number(next.unit_price) || 0
        next.amount = moneyMul(next.hours, next.unit_price)
        return next
      })
    )
  }

  const addManualItem = (): void => {
    setItems((prev) => [
      ...prev,
      { id: Date.now(), invoice_id: invoice.id, description: '', hours: 0, unit_price: 0, amount: 0 }
    ])
  }

  const client = clients.find((c) => c.id === form.client_id)

  return (
    <Modal
      open
      title={`Invoice ${form.number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Delete
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={exportPdf} disabled={busy}>
            <Download size={16} /> Save & Export PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Invoice number">
            <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          </Field>
          <Field label="Client">
            <Select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: Number(e.target.value) })}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </Select>
          </Field>
          <Field label="Issue date">
            <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <Field label="Tax rate (%)">
            <Input type="number" min={0} step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) || 0 })} />
          </Field>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Line items</h3>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAddEntries(true)}>
              <Plus size={16} /> From time entries
            </Button>
            <Button variant="ghost" onClick={addManualItem}>
              <Plus size={16} /> Manual
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No line items yet — add them from time entries or manually.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="w-24 px-3 py-2.5 text-right font-semibold">Hours</th>
                  <th className="w-28 px-3 py-2.5 text-right font-semibold">Rate</th>
                  <th className="w-28 px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="w-12 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2">
                      <Input
                        value={i.description}
                        onChange={(e) => updateItem(i.id, { description: e.target.value })}
                        placeholder="Description"
                        className="min-h-[38px] text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={i.hours}
                        onChange={(e) => updateItem(i.id, { hours: Number(e.target.value) })}
                        className="min-h-[38px] text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={i.unit_price}
                        onChange={(e) => updateItem(i.id, { unit_price: Number(e.target.value) })}
                        className="min-h-[38px] text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                      {moneyStr(i.amount, currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <IconButton title="Remove item" className="h-9 w-9" onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}>
                        <X size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span className="font-mono">{moneyStr(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Tax ({form.tax_rate}%)</span>
              <span className="font-mono">{moneyStr(tax, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white">
              <span>Total</span>
              <span className="font-mono">{moneyStr(total, currency)}</span>
            </div>
          </div>
        </div>

        <Field label="Notes (shown on invoice)">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, thanks, etc." />
        </Field>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Billing to: <span className="font-medium">{client?.name ?? '—'}</span>
          {client?.address && <span> · {client.address}</span>}
        </p>
      </div>

      {addEntries && <AddEntriesModal onClose={() => setAddEntries(false)} onAdd={addFromEntries} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete invoice"
        message={`Delete invoice ${form.number}? This cannot be undone.`}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  )
}

export default function Invoices(): ReactNode {
  const { invoices, clients, refreshInvoices } = useData()
  const { settings } = useApp()
  const [editing, setEditing] = useState<InvoiceDetail | null>(null)
  const [issuerOpen, setIssuerOpen] = useState(false)
  const [deleting, setDeleting] = useState<Invoice | null>(null)
  const [creating, setCreating] = useState(false)

  const create = async (): Promise<void> => {
    setCreating(true)
    try {
      const number = await window.api.invoices.nextNumber()
      const now = new Date()
      const due = new Date(now.getTime() + 30 * 86400000)
      const inv = await window.api.invoices.create({
        number,
        client_id: clients[0]?.id ?? 0,
        status: 'draft',
        issue_date: now.toISOString(),
        due_date: due.toISOString(),
        tax_rate: 0,
        notes: ''
      })
      await refreshInvoices()
      const detail = await window.api.invoices.detail(inv.id)
      if (detail) setEditing(detail)
    } finally {
      setCreating(false)
    }
  }

  const openEditor = async (id: number): Promise<void> => {
    const detail = await window.api.invoices.detail(id)
    if (detail) setEditing(detail)
  }

  const remove = async (): Promise<void> => {
    if (!deleting) return
    await window.api.invoices.remove(deleting.id)
    await refreshInvoices()
    setDeleting(null)
  }

  const currency = settings?.issuer.currency ?? 'USD'

  return (
    <div className="mx-auto w-full">
      <SectionTitle
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIssuerOpen(true)}>
              <Settings size={18} /> Issuer Info
            </Button>
            <Button onClick={create} disabled={creating || clients.length === 0}>
              <FilePlus2 size={18} /> New Invoice
            </Button>
          </div>
        }
      >
        Invoices
      </SectionTitle>

      {clients.length === 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Add at least one client before creating an invoice.
        </Card>
      )}

      {invoices.length === 0 && (
        <Card>
          <EmptyState
            icon={<FileText size={28} />}
            title="No invoices yet"
            hint="Create an invoice, add line items from tracked time, and export a professional PDF."
          />
        </Card>
      )}

      <div className="space-y-3">
        {invoices.map((inv) => (
          <Card key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openEditor(inv.id)}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-slate-900 dark:text-white">{inv.number}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {inv.client_name ?? 'No client'} · Issued {dateLabel(inv.issue_date)} · Due {dateLabel(inv.due_date)}
                </p>
              </div>
            </button>
            <Badge color={STATUS_COLORS[inv.status]}>{inv.status}</Badge>
            <span className="font-mono text-[15px] font-bold text-slate-900 dark:text-white">{moneyStr(inv.total, currency)}</span>
            <div className="flex gap-1">
              <IconButton title="Edit invoice" onClick={() => openEditor(inv.id)}>
                <Pencil size={18} />
              </IconButton>
              <IconButton
                title="Delete invoice"
                className="hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
                onClick={() => setDeleting(inv)}
              >
                <Trash2 size={18} />
              </IconButton>
            </div>
          </Card>
        ))}
      </div>

      {editing && <InvoiceEditor invoice={editing} onClose={() => setEditing(null)} />}
      {issuerOpen && <Modal open title="Invoice issuer info" onClose={() => setIssuerOpen(false)}><IssuerSettings onClose={() => setIssuerOpen(false)} /></Modal>}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete invoice"
        message={`Delete invoice "${deleting?.number}"? This cannot be undone.`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}