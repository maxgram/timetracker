import { getDb, entryDurationSql } from '../index'
import type { TimeEntry, TimeEntryInput } from '@shared/types'

const COLS = `t.id, t.project_id, t.name, t.start_at, t.end_at, t.notes, t.created_at,
  ${entryDurationSql('t.end_at', 't.start_at')} AS duration,
  p.name AS project_name, c.name AS client_name, p.hourly_rate,
  CASE WHEN t.end_at IS NULL THEN 1 ELSE 0 END AS running`

function rowToEntry(r: Record<string, unknown>): TimeEntry {
  return {
    id: r.id as number,
    project_id: r.project_id as number | null,
    name: r.name as string,
    start_at: r.start_at as string,
    end_at: (r.end_at as string | null) ?? null,
    notes: (r.notes as string) ?? '',
    created_at: r.created_at as string,
    duration: r.running ? null : Number(r.duration),
    project_name: (r.project_name as string | null) ?? null,
    client_name: (r.client_name as string | null) ?? null,
    hourly_rate: r.hourly_rate == null ? null : Number(r.hourly_rate),
    running: Boolean(r.running)
  }
}

export const entryRepo = {
  list(): TimeEntry[] {
    return (
      getDb()
        .prepare(
          `SELECT ${COLS} FROM time_entries t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN clients c ON c.id = p.client_id
           ORDER BY t.start_at DESC`
        )
        .all() as Record<string, unknown>[]
    ).map(rowToEntry)
  },

  get(id: number): TimeEntry | null {
    const row = getDb()
      .prepare(
        `SELECT ${COLS} FROM time_entries t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN clients c ON c.id = p.client_id
         WHERE t.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined
    return row ? rowToEntry(row) : null
  },

  create(input: TimeEntryInput): TimeEntry {
    const res = getDb()
      .prepare(
        `INSERT INTO time_entries (project_id, name, start_at, end_at, notes) VALUES (@project_id, @name, @start_at, @end_at, @notes)`
      )
      .run({ ...input, notes: input.notes ?? '' })
    return this.get(Number(res.lastInsertRowid))!
  },

  update(id: number, input: Partial<TimeEntryInput>): TimeEntry {
    const cur = this.get(id)
    if (!cur) throw new Error(`Entry ${id} not found`)
    const next = { ...cur, ...input }
    getDb()
      .prepare(`UPDATE time_entries SET project_id=@project_id, name=@name, start_at=@start_at, end_at=@end_at, notes=@notes WHERE id=@id`)
      .run({ id, project_id: next.project_id, name: next.name, start_at: next.start_at, end_at: next.end_at, notes: next.notes })
    return this.get(id)!
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM time_entries WHERE id = ?').run(id)
  }
}