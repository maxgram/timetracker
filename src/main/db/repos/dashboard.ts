import { getDb, entryDurationSql } from '../index'
import type { DashboardStats, TimeEntry } from '@shared/types'
import { buildSummary } from './invoices'
import { entryRepo } from './entries'

interface Row {
  hours: number
  [k: string]: unknown
}

function dayStart(daysAgo: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

export function getDashboard(): DashboardStats {
  const duration = entryDurationSql('t.end_at', 't.start_at')
  const sum = (sql: string, params: unknown[] = []): number => {
    const r = getDb().prepare(sql).get(...params) as { s: number | null }
    return Number(r.s ?? 0)
  }

  const today = sum(
    `SELECT ROUND(SUM(${duration}) / 3600.0, 2) AS s FROM time_entries t WHERE t.start_at >= ?`,
    [dayStart(0)]
  )
  const week = sum(
    `SELECT ROUND(SUM(${duration}) / 3600.0, 2) AS s FROM time_entries t WHERE t.start_at >= ?`,
    [dayStart(6)]
  )
  const month = sum(
    `SELECT ROUND(SUM(${duration}) / 3600.0, 2) AS s FROM time_entries t WHERE t.start_at >= ?`,
    [dayStart(29)]
  )
  const total = sum(`SELECT ROUND(SUM(${duration}) / 3600.0, 2) AS s FROM time_entries t`)
  const running = (getDb().prepare(`SELECT COUNT(*) AS n FROM time_entries WHERE end_at IS NULL`).get() as { n: number }).n

  const perProject = (
    getDb()
      .prepare(
        `SELECT t.project_id, p.name AS project_name, ROUND(SUM(${duration}) / 3600.0, 2) AS hours
         FROM time_entries t LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.start_at >= ?
         GROUP BY t.project_id ORDER BY hours DESC`
      )
      .all(dayStart(6)) as Row[]
  ).map((r) => ({ project_id: r.project_id as number | null, project_name: (r.project_name as string | null) ?? 'No project', hours: r.hours }))

  const last7days = Array.from({ length: 7 }, (_, i) => 6 - i).map((d) => {
    const start = dayStart(d)
    const end = dayStart(d - 1)
    const hours = sum(`SELECT ROUND(SUM(${duration}) / 3600.0, 2) AS s FROM time_entries t WHERE t.start_at >= ? AND t.start_at < ?`, [start, end])
    return { date: start.slice(0, 10), hours }
  })

  const recent = (
    getDb()
      .prepare(
        `SELECT t.id, t.project_id, t.name, t.start_at, t.end_at, t.notes, t.created_at,
           ${duration} AS duration, p.name AS project_name, c.name AS client_name, p.hourly_rate,
           CASE WHEN t.end_at IS NULL THEN 1 ELSE 0 END AS running
         FROM time_entries t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN clients c ON c.id = p.client_id
         WHERE t.end_at IS NOT NULL
         ORDER BY t.start_at DESC LIMIT 5`
      )
      .all() as Record<string, unknown>[]
  ).map((r) => ({
    id: r.id as number,
    project_id: r.project_id as number | null,
    name: r.name as string,
    start_at: r.start_at as string,
    end_at: (r.end_at as string | null) ?? null,
    notes: (r.notes as string) ?? '',
    created_at: r.created_at as string,
    duration: Number(r.duration),
    project_name: (r.project_name as string | null) ?? null,
    client_name: (r.client_name as string | null) ?? null,
    hourly_rate: r.hourly_rate == null ? null : Number(r.hourly_rate),
    running: false
  }))

  return { today, week, month, total, running, perProject, last7days, recent }
}

export function listEntriesForInvoice(filters: import('@shared/types').EntryFilters): TimeEntry[] {
  const data = buildSummary(filters)
  const ids = data.rows.map((r) => r.entry_id)
  if (!ids.length) return []
  const all = entryRepo.list()
  const byId = new Map(all.map((e) => [e.id, e]))
  return ids.map((id) => byId.get(id)).filter((e): e is TimeEntry => Boolean(e))
}