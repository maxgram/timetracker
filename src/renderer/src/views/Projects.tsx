import { useState, type FormEvent, type ReactNode } from 'react'
import { FolderKanban, FolderPlus, Pencil, Trash2, DollarSign, User } from 'lucide-react'
import { useData } from '@/store/data'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, SectionTitle, Select } from '@/components/ui'
import type { ProjectInput } from '@shared/types'

function ProjectForm({
  initial,
  onSubmit,
  submitLabel
}: {
  initial: ProjectInput
  onSubmit: (p: ProjectInput) => Promise<void>
  submitLabel: string
}): ReactNode {
  const clients = useData((s) => s.clients)
  const [form, setForm] = useState<ProjectInput>(initial)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ ...form, hourly_rate: Number(form.hourly_rate) || 0 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Project name *">
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Website redesign" autoFocus />
      </Field>
      <Field label="Client">
        <Select value={form.client_id ?? ''} onChange={(e) => setForm({ ...form, client_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Hourly rate">
        <div className="relative">
          <DollarSign size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: e.target.value === '' ? 0 : Number(e.target.value) })}
            className="pl-9"
            placeholder="0.00"
          />
        </div>
      </Field>
      <Field label="Notes">
        <Input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default function Projects(): ReactNode {
  const { projects, clients, refreshProjects, refreshEntries } = useData()
  const [editing, setEditing] = useState<{ project?: (typeof projects)[number]; isNew: boolean } | null>(null)
  const [deleting, setDeleting] = useState<(typeof projects)[number] | null>(null)

  const create = async (input: ProjectInput): Promise<void> => {
    await window.api.projects.create(input)
    await refreshProjects()
    setEditing(null)
  }

  const update = async (input: ProjectInput): Promise<void> => {
    if (!editing?.project) return
    await window.api.projects.update(editing.project.id, input)
    await refreshProjects()
    setEditing(null)
  }

  const remove = async (): Promise<void> => {
    if (!deleting) return
    await window.api.projects.remove(deleting.id)
    await Promise.all([refreshProjects(), refreshEntries()])
    setDeleting(null)
  }

  return (
    <div className="mx-auto w-full">
      <SectionTitle
        right={
          <Button onClick={() => setEditing({ isNew: true })}>
            <FolderPlus size={18} /> Add Project
          </Button>
        }
      >
        Projects
      </SectionTitle>

      {projects.length === 0 && (
        <Card>
          <EmptyState
            icon={<FolderKanban size={28} />}
            title="No projects yet"
            hint="Create a project, link it to a client and set an hourly rate to track billable time."
          />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-bold text-slate-900 dark:text-white">{p.name}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <User size={14} /> {p.client_name ?? 'No client'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton title="Edit" onClick={() => setEditing({ project: p, isNew: false })}>
                  <Pencil size={18} />
                </IconButton>
                <IconButton
                  title="Delete"
                  className="hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            </div>
            <div className="mt-4">
              <Badge color={p.hourly_rate > 0 ? 'emerald' : 'slate'}>
                {p.hourly_rate > 0 ? `$${p.hourly_rate.toFixed(2)}/hr` : 'No rate set'}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={editing !== null}
        title={editing?.isNew ? 'Add Project' : 'Edit Project'}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ProjectForm
            initial={
              editing.isNew || !editing.project
                ? { name: '', client_id: clients[0]?.id ?? null, hourly_rate: 0, notes: '' }
                : { name: editing.project.name, client_id: editing.project.client_id, hourly_rate: editing.project.hourly_rate, notes: editing.project.notes }
            }
            onSubmit={editing.isNew ? create : update}
            submitLabel={editing.isNew ? 'Create Project' : 'Save Changes'}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete project"
        message={`Delete "${deleting?.name}"? Time entries will be kept but unassigned.`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}