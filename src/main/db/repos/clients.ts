import { getDb } from '../index'
import type { Client, ClientInput } from '@shared/types'

const COLS = `id, name, email, phone, address, tax_id, notes, created_at`

function rowToClient(r: Record<string, unknown>): Client {
  return {
    id: r.id as number,
    name: r.name as string,
    email: (r.email as string) ?? '',
    phone: (r.phone as string) ?? '',
    address: (r.address as string) ?? '',
    tax_id: (r.tax_id as string) ?? '',
    notes: (r.notes as string) ?? '',
    created_at: r.created_at as string
  }
}

export const clientRepo = {
  list(): Client[] {
    return (getDb().prepare(`SELECT ${COLS} FROM clients ORDER BY name COLLATE NOCASE`).all() as Record<string, unknown>[]).map(rowToClient)
  },

  get(id: number): Client | null {
    const row = getDb().prepare(`SELECT ${COLS} FROM clients WHERE id = ?`).get(id) as Record<string, unknown> | undefined
    return row ? rowToClient(row) : null
  },

  create(input: ClientInput): Client {
    const res = getDb()
      .prepare(`INSERT INTO clients (name, email, phone, address, tax_id, notes) VALUES (@name, @email, @phone, @address, @tax_id, @notes)`)
      .run({ ...input, email: input.email ?? '', phone: input.phone ?? '', address: input.address ?? '', tax_id: input.tax_id ?? '', notes: input.notes ?? '' })
    return this.get(Number(res.lastInsertRowid))!
  },

  update(id: number, input: Partial<ClientInput>): Client {
    const cur = this.get(id)
    if (!cur) throw new Error(`Client ${id} not found`)
    const next = { ...cur, ...input }
    getDb()
      .prepare(`UPDATE clients SET name=@name, email=@email, phone=@phone, address=@address, tax_id=@tax_id, notes=@notes WHERE id=@id`)
      .run(next)
    return this.get(id)!
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM clients WHERE id = ?').run(id)
  }
}