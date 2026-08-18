import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Play, Timer, TrendingUp, Clock, CalendarDays, FolderKanban } from 'lucide-react'
import { useData, useNow } from '@/store/data'
import { Card, SectionTitle } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import type { DashboardStats } from '@shared/types'

function StatCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent: string }): ReactNode {
  return (
    <Card className="p-5">
      <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </Card>
  )
}

function BarChart({ data }: { data: { date: string; hours: number }[] }): ReactNode {
  const max = Math.max(...data.map((d) => d.hours), 0.001)
  return (
    <div className="flex h-36 items-end gap-2">
      {data.map((d) => (
        <div key={d.date} className="group flex h-full flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
            {formatDuration(d.hours * 3600)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-indigo-500 transition group-hover:bg-indigo-400 dark:bg-indigo-600"
              style={{ height: `${Math.max((d.hours / max) * 100, 3)}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard(): ReactNode {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const projects = useData((s) => s.projects)
  const now = useNow((s) => s.now)
  const tick = useNow((s) => s.tick)
  const entries = useData((s) => s.entries)
  const running = useMemo(() => entries.filter((e) => e.running), [entries])
  const entryCount = entries.length

  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick])

  useEffect(() => {
    window.api.dashboard.get().then(setStats)
  }, [running.length, entryCount])

  const maxProjectHours = useMemo(() => Math.max(...(stats?.perProject.map((p) => p.hours) ?? [0]), 0.001), [stats])

  return (
    <div className="mx-auto w-full">
      <SectionTitle>Dashboard</SectionTitle>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Clock size={22} />}
          label="Today"
          value={formatDuration((stats?.today ?? 0) * 3600)}
          accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
        />
        <StatCard
          icon={<CalendarDays size={22} />}
          label="Last 7 days"
          value={formatDuration((stats?.week ?? 0) * 3600)}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          label="Last 30 days"
          value={formatDuration((stats?.month ?? 0) * 3600)}
          accent="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
        />
        <StatCard
          icon={<Timer size={22} />}
          label="Running timers"
          value={String(stats?.running ?? 0)}
          accent="bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
        />
      </div>

      {running.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Running now</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {running.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white">
                  <Play size={16} fill="currentColor" className="ml-0.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{e.name || 'Untitled'}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{e.project_name ?? 'No project'}</p>
                </div>
                <span className="font-mono text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatDuration(Math.max(0, (now - new Date(e.start_at).getTime()) / 1000))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Hours per day</h2>
          <BarChart data={stats?.last7days ?? []} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">This week by project</h2>
          {stats && stats.perProject.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No tracked time this week yet.</p>
          )}
          <div className="space-y-3">
            {stats?.perProject.map((p) => (
              <div key={p.project_id ?? 'none'}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-slate-700 dark:text-slate-200">
                    <FolderKanban size={14} className="shrink-0 text-slate-400" />
                    <span className="truncate">{p.project_name}</span>
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-slate-600 dark:text-slate-300">
                    {formatDuration(p.hours * 3600)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 dark:bg-indigo-500"
                    style={{ width: `${(p.hours / maxProjectHours) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Recent activity</h2>
        </div>
        {stats && stats.recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No completed entries yet. Head to the Time Tracker to log your first one.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {stats?.recent.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{e.name || 'Untitled'}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {e.project_name ?? 'No project'} · {new Date(e.start_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {formatDuration((e.duration ?? 0))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {projects.length === 0 && (
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Tip: add clients and projects to get billable summaries and invoices.
        </p>
      )}
    </div>
  )
}