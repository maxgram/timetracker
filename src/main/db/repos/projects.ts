import { getDb } from '../index'
import type { Project, ProjectInput, ProjectWithClient } from '@shared/types'

const COLS = `p.id, p.client_id, p.name, p.hourly_rate, p.notes, p.created_at`

function rowToProject(r: Record<string, unknown>): ProjectWithClient {
  return {
    id: r.id as number,
    client_id: r.client_id as number | null,
    name: r.name as string,
    hourly_rate: r.hourly_rate as number,
    notes: (r.notes as string) ?? '',
    created_at: r.created_at as string,
    client_name: (r.client_name as string | null) ?? null
  }
}

export const projectRepo = {
  list(): ProjectWithClient[] {
    return (
      getDb()
        .prepare(
          `SELECT ${COLS}, c.name AS client_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id ORDER BY p.name COLLATE NOCASE`
        )
        .all() as Record<string, unknown>[]
    ).map(rowToProject)
  },

  get(id: number): Project | null {
    const row = getDb().prepare(`SELECT ${COLS} FROM projects p WHERE p.id = ?`).get(id) as Record<string, unknown> | undefined
    return row ? rowToProject(row) : null
  },

  create(input: ProjectInput): ProjectWithClient {
    const res = getDb()
      .prepare(`INSERT INTO projects (client_id, name, hourly_rate, notes) VALUES (@client_id, @name, @hourly_rate, @notes)`)
      .run({ ...input, notes: input.notes ?? '' })
    return this.list().find((p) => p.id === Number(res.lastInsertRowid))!
  },

  update(id: number, input: Partial<ProjectInput>): ProjectWithClient {
    const cur = this.get(id)
    if (!cur) throw new Error(`Project ${id} not found`)
    const next = { ...cur, ...input }
    getDb()
      .prepare(`UPDATE projects SET client_id=@client_id, name=@name, hourly_rate=@hourly_rate, notes=@notes WHERE id=@id`)
      .run(next)
    return this.list().find((p) => p.id === id)!
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  }
}