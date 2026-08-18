import { useState, type FormEvent, type ReactNode } from 'react'
import { UserPlus, Users, Pencil, Trash2, Mail, Phone, MapPin, Hash } from 'lucide-react'
import { useData } from '@/store/data'
import { Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, SectionTitle, Textarea } from '@/components/ui'
import type { Client, ClientInput } from '@shared/types'

const EMPTY: ClientInput = { name: '', email: '', phone: '', address: '', tax_id: '', notes: '' }

function ClientForm({ initial, onSubmit, submitLabel }: { initial: ClientInput; onSubmit: (c: ClientInput) => Promise<void>; submitLabel: string }): ReactNode {
  const [form, setForm] = useState<ClientInput>(initial)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof ClientInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit(form)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name *">
        <Input required value={form.name} onChange={set('name')} placeholder="Acme Corp" autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="billing@acme.com" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} placeholder="+1 555 000 1234" />
        </Field>
      </div>
      <Field label="Address">
        <Textarea value={form.address} onChange={set('address')} placeholder="Street, City, Country" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tax / VAT ID">
          <Input value={form.tax_id} onChange={set('tax_id')} placeholder="VAT-123456" />
        </Field>
        <Field label="Notes">
          <Input value={form.notes} onChange={set('notes')} placeholder="Anything to remember" />
        </Field>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default function Clients(): ReactNode {
  const { clients, refreshClients, refreshProjects } = useData()
  const [editing, setEditing] = useState<{ client?: Client; isNew: boolean } | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)

  const create = async (input: ClientInput): Promise<void> => {
    await window.api.clients.create(input)
    await refreshClients()
    setEditing(null)
  }

  const update = async (input: ClientInput): Promise<void> => {
    if (!editing?.client) return
    await window.api.clients.update(editing.client.id, input)
    await refreshClients()
    setEditing(null)
  }

  const remove = async (): Promise<void> => {
    if (!deleting) return
    await window.api.clients.remove(deleting.id)
    await Promise.all([refreshClients(), refreshProjects()])
    setDeleting(null)
  }

  return (
    <div className="mx-auto w-full">
      <SectionTitle
        right={
          <Button onClick={() => setEditing({ isNew: true })}>
            <UserPlus size={18} /> Add Client
          </Button>
        }
      >
        Clients
      </SectionTitle>

      {clients.length === 0 && (
        <Card>
          <EmptyState icon={<Users size={28} />} title="No clients yet" hint="Add your first client to organize projects and invoices." />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {clients.map((c) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-bold text-slate-900 dark:text-white">{c.name}</h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact info'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton title="Edit" onClick={() => setEditing({ client: c, isNew: false })}>
                  <Pencil size={18} />
                </IconButton>
                <IconButton title="Delete" variant="ghost" className="hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30" onClick={() => setDeleting(c)}>
                  <Trash2 size={18} />
                </IconButton>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {c.address && (
                <p className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" /> {c.address}
                </p>
              )}
              {c.tax_id && (
                <p className="flex items-center gap-2">
                  <Hash size={16} className="shrink-0 text-slate-400" /> {c.tax_id}
                </p>
              )}
              {c.email && (
                <p className="flex items-center gap-2">
                  <Mail size={16} className="shrink-0 text-slate-400" /> {c.email}
                </p>
              )}
              {c.phone && (
                <p className="flex items-center gap-2">
                  <Phone size={16} className="shrink-0 text-slate-400" /> {c.phone}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={editing !== null}
        title={editing?.isNew ? 'Add Client' : 'Edit Client'}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ClientForm
            initial={editing.isNew || !editing.client ? EMPTY : { ...editing.client }}
            onSubmit={editing.isNew ? create : update}
            submitLabel={editing.isNew ? 'Create Client' : 'Save Changes'}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete client"
        message={`Delete "${deleting?.name}"? Its projects will be kept but unassigned, and time entries will be preserved.`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}