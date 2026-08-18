import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Play, Square, Pencil, Trash2, Timer, Check, X, ChevronRight } from 'lucide-react'
import { useData, useNow } from '@/store/data'
import { Button, Card, ConfirmDialog, IconButton, Input, SectionTitle, Select } from '@/components/ui'
import { dayKey, dayLabel, formatClock, formatDuration, isoToLocalInput, localInputToIso, timeLabel } from '@/lib/format'
import type { TimeEntry } from '@shared/types'

function useTicker(): void {
  const tick = useNow((s) => s.tick)
  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick])
}

function elapsed(entry: TimeEntry, now: number): number {
  if (!entry.running) return entry.duration ?? 0
  return Math.max(0, (now - new Date(entry.start_at).getTime()) / 1000)
}

function EntryRow({ entry, now }: { entry: TimeEntry; now: number }): ReactNode {
  const projects = useData((s) => s.projects)
  const refreshEntries = useData((s) => s.refreshEntries)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(entry.name)
  const [draftProject, setDraftProject] = useState(entry.project_id ?? '')
  const [startDraft, setStartDraft] = useState(isoToLocalInput(entry.start_at))
  const [endDraft, setEndDraft] = useState(entry.end_at ? isoToLocalInput(entry.end_at) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const secs = elapsed(entry, now)

  const save = async (patch: Partial<Pick<TimeEntry, 'name' | 'project_id' | 'start_at' | 'end_at'>>): Promise<void> => {
    await window.api.entries.update(entry.id, patch)
    await refreshEntries()
  }

  const toggle = async (): Promise<void> => {
    if (entry.running) {
      await window.api.entries.stop(entry.id)
    } else {
      await window.api.entries.start(entry.name || 'New entry', entry.project_id)
    }
    await refreshEntries()
  }

  const commitEdit = async (): Promise<void> => {
    await save({
      name: draftName.trim() || 'Untitled',
      project_id: draftProject === '' ? null : Number(draftProject),
      start_at: localInputToIso(startDraft),
      end_at: endDraft ? localInputToIso(endDraft) : entry.end_at
    })
    setEditing(false)
  }

  const remove = async (): Promise<void> => {
    await window.api.entries.remove(entry.id)
    await refreshEntries()
    setConfirmDelete(false)
  }

  return (
    <div className={`px-4 py-3 ${entry.running ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''}`}>
      {editing ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              onClick={toggle}
              title={entry.running ? 'Stop' : 'Start'}
              aria-label={entry.running ? 'Stop' : 'Start'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md transition active:scale-95 ${
                entry.running ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400'
              }`}
            >
              {entry.running ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="min-w-[140px] flex-1" placeholder="Task name" />
            <Select value={draftProject} onChange={(e) => setDraftProject(e.target.value)} className="w-full sm:w-48">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-100/70 p-3 dark:bg-slate-800/50">
            <div className="min-w-[160px] flex-1">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">Start</span>
              <Input type="datetime-local" value={startDraft} onChange={(e) => setStartDraft(e.target.value)} className="w-full" />
            </div>
            <div className="min-w-[160px] flex-1">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">End</span>
              <Input type="datetime-local" value={endDraft} onChange={(e) => setEndDraft(e.target.value)} className="w-full" />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="success" onClick={commitEdit}>
                <Check size={16} /> Save
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                <X size={16} /> Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
          <button
            onClick={toggle}
            title={entry.running ? 'Stop' : 'Start'}
            aria-label={entry.running ? 'Stop' : 'Start'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md transition active:scale-95 ${
              entry.running ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            {entry.running ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{entry.name || 'Untitled'}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {entry.project_name ?? 'No project'}
              {!entry.running && entry.end_at && (
                <span className="hidden sm:inline">
                  {' '}
                  · {timeLabel(entry.start_at)} – {timeLabel(entry.end_at)}
                </span>
              )}
            </p>
          </div>
          <Select
            value={entry.project_id ?? ''}
            onChange={(e) => save({ project_id: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-full sm:w-44"
            title="Change project"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={`min-w-[86px] text-right font-mono text-[15px] font-bold tabular-nums ${
                entry.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {entry.running ? formatClock(secs) : formatDuration(secs)}
            </span>
            {!entry.running && (
              <IconButton title="Edit times" onClick={() => setEditing(true)}>
                <Pencil size={17} />
              </IconButton>
            )}
            <IconButton
              title="Delete"
              className="hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={17} />
            </IconButton>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete entry"
        message={`Delete "${entry.name || 'Untitled'}"? This cannot be undone.`}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

export default function TimeTracker(): ReactNode {
  const { entries, projects, refreshEntries } = useData()
  const now = useNow((s) => s.now)
  const [newName, setNewName] = useState('')
  const [newProject, setNewProject] = useState<string>('')
  useTicker()

  const running = useMemo(() => entries.filter((e) => e.running), [entries])
  const stopped = useMemo(() => entries.filter((e) => !e.running), [entries])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleGroup = (key: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const days = useMemo(() => {
    const byDay = new Map<string, TimeEntry[]>()
    for (const e of stopped) {
      const key = dayKey(new Date(e.start_at))
      const arr = byDay.get(key) ?? []
      arr.push(e)
      byDay.set(key, arr)
    }
    return [...byDay.entries()]
      .map(([date, list]) => {
        list.sort((a, b) => (a.start_at < b.start_at ? 1 : -1))
        const groups = new Map<string, { key: string; name: string; project_id: number | null; project_name: string | null; entries: TimeEntry[] }>()
        for (const e of list) {
          const name = e.name || 'Untitled'
          const gkey = `${date}|${e.project_id ?? 'none'}\u0000${name}`
          const g = groups.get(gkey) ?? { key: gkey, name, project_id: e.project_id, project_name: e.project_name, entries: [] }
          g.entries.push(e)
          groups.set(gkey, g)
        }
        return {
          date,
          total: list.reduce((acc, e) => acc + (e.duration ?? 0), 0),
          groups: [...groups.values()].map((g) => ({
            ...g,
            total: g.entries.reduce((acc, e) => acc + (e.duration ?? 0), 0)
          }))
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [stopped])

  const startNew = async (): Promise<void> => {
    await window.api.entries.start(newName.trim() || 'New entry', newProject === '' ? null : Number(newProject))
    setNewName('')
    setNewProject('')
    await refreshEntries()
  }

  return (
    <div className="mx-auto w-full">
      <SectionTitle>Time Tracker</SectionTitle>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">Task name</span>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') startNew()
              }}
              placeholder="What are you working on?"
            />
          </div>
          <div className="w-full sm:w-52">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">Project</span>
            <Select value={newProject} onChange={(e) => setNewProject(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Button className="w-full sm:w-auto" onClick={startNew}>
              <Play size={18} fill="currentColor" /> Start Timer
            </Button>
        </div>
      </Card>

      {running.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <Timer size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Running now</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {running.map((e) => (
              <EntryRow key={e.id} entry={e} now={now} />
            ))}
          </div>
        </Card>
      )}

      {days.length === 0 && running.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <Timer size={28} />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">Nothing tracked yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter a task name above and hit Start Timer.</p>
            </div>
          </div>
        </Card>
      )}

      {days.map((day) => (
        <Card key={day.date} className="mb-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{dayLabel(day.date)}</h2>
            <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">{formatDuration(day.total)}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {day.groups.map((g) =>
              g.entries.length > 1 ? (
                <div key={g.key}>
                  <button
                    onClick={() => toggleGroup(g.key)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition dark:bg-slate-800 dark:text-slate-300">
                      <ChevronRight size={20} className={`transition-transform ${expanded.has(g.key) ? 'rotate-90' : ''}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-white">{g.name}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {g.project_name ?? 'No project'} · {g.entries.length} entries
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{formatDuration(g.total)}</span>
                  </button>
                  {expanded.has(g.key) && (
                    <div className="ml-11 divide-y divide-slate-100 border-l border-slate-200 pl-1 dark:divide-slate-800/70 dark:border-slate-800">
                      {g.entries.map((e) => (
                        <EntryRow key={e.id} entry={e} now={now} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <EntryRow key={g.entries[0].id} entry={g.entries[0]} now={now} />
              )
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}