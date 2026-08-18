import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BarChart3, Download, FilterX } from 'lucide-react'
import { useApp } from '@/store/app'
import { useData } from '@/store/data'
import { Button, Card, EmptyState, Field, Input, SectionTitle, Select } from '@/components/ui'
import { dayKey, formatDuration, money } from '@/lib/format'
import { buildSummaryDoc, savePdf } from '@/lib/pdf'
import type { EntryFilters, SummaryData } from '@shared/types'

function daysAgo(n: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return dayKey(d)
}

export default function Summary(): ReactNode {
  const { clients, projects } = useData()
  const settings = useApp((s) => s.settings)
  const [filters, setFilters] = useState<EntryFilters>({ from: daysAgo(29), to: daysAgo(0) })
  const [data, setData] = useState<SummaryData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const seq = useRef(0)

  const load = useCallback(async (f: EntryFilters): Promise<void> => {
    const id = ++seq.current
    try {
      const res = await window.api.summary.get(f)
      if (id !== seq.current) return
      setData(res)
      setError(false)
    } catch {
      if (id === seq.current) setError(true)
    }
  }, [])

  useEffect(() => {
    load(filters)
  }, [load, filters])

  const set = (patch: Partial<EntryFilters>): void => setFilters((f) => ({ ...f, ...patch }))

  const exportPdf = async (): Promise<void> => {
    if (!data) return
    setBusy(true)
    try {
      const filterDesc = [
        filters.from ? `From ${filters.from}` : '',
        filters.to ? `To ${filters.to}` : '',
        filters.client_id ? `Client: ${clients.find((c) => c.id === filters.client_id)?.name ?? ''}` : '',
        filters.project_id ? `Project: ${projects.find((p) => p.id === filters.project_id)?.name ?? ''}` : ''
      ].filter(Boolean)
      await savePdf(buildSummaryDoc(data, settings?.issuer.currency ?? 'USD'), `time-summary-${filters.from ?? 'all'}-${filters.to ?? 'all'}.pdf`)
    } finally {
      setBusy(false)
    }
  }

  const projectOptions = filters.client_id
    ? projects.filter((p) => p.client_id === filters.client_id)
    : projects

  return (
    <div className="mx-auto w-full">
      <SectionTitle
        right={
          <Button onClick={exportPdf} disabled={!data || busy}>
            <Download size={18} /> Export PDF
          </Button>
        }
      >
        Summary
      </SectionTitle>

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From">
            <Input type="date" value={filters.from ?? ''} onChange={(e) => set({ from: e.target.value || null })} />
          </Field>
          <Field label="To">
            <Input type="date" value={filters.to ?? ''} onChange={(e) => set({ to: e.target.value || null })} />
          </Field>
          <Field label="Client">
            <Select
              value={filters.client_id ?? ''}
              onChange={(e) => set({ client_id: e.target.value ? Number(e.target.value) : null, project_id: null })}
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={filters.project_id ?? ''} onChange={(e) => set({ project_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => set({ from: null, to: null, client_id: null, project_id: null })}>
            <FilterX size={16} /> Clear filters
          </Button>
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
            {error
              ? 'Failed to load'
              : data
                ? `${data.rows.length} entries · ${formatDuration(data.totals.hours * 3600)}`
                : 'Loading…'}
          </span>
        </div>
      </Card>

      {data && data.rows.length === 0 && !error && (
        <Card>
          <EmptyState icon={<BarChart3 size={28} />} title="No entries match" hint="Adjust the date range or clear the filters to see tracked time." />
        </Card>
      )}

      {error && (
        <Card>
          <EmptyState icon={<BarChart3 size={28} />} title="Couldn't load summary" hint="Try adjusting the filters or restarting the app." />
        </Card>
      )}

      {data && data.rows.length > 0 && (
        <>
          <Card className="mb-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Entry</th>
                    <th className="px-4 py-3 font-semibold">Project</th>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 text-right font-semibold">Hours</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {data.rows.map((r) => (
                    <tr key={r.entry_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.name || 'Untitled'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.project_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.client_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">{r.hours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {money(r.amount, settings?.issuer.currency ?? 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">By project</h3>
              <div className="space-y-2">
                {data.perProject.map((p) => (
                  <div key={p.project_id ?? 'none'} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{p.project_name ?? 'No project'}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                      {formatDuration(p.hours * 3600)}
                      {p.amount != null && <span className="ml-2 text-slate-400 dark:text-slate-500">{money(p.amount, settings?.issuer.currency ?? 'USD')}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Totals</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Total hours</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatDuration(data.totals.hours * 3600)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Total amount</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {data.totals.amount != null ? money(data.totals.amount, settings?.issuer.currency ?? 'USD') : '— (no rates set)'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}