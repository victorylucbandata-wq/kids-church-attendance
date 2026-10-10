import { adminApi } from '@/app/lib/church'
import { checkImport, type ExistingMember } from '@/app/lib/member-import'

const PAGE = 1000

// POST { csv, confirm }: always re-checks the file on the server. Without `confirm` it is
// only a preview; with it, new members are added and existing members' blanks filled in,
// in one statement (all or nothing). Nothing already saved is overwritten.
export async function POST(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { csv, confirm } = (await request.json()) as { csv?: unknown; confirm?: unknown }
  if (typeof csv !== 'string' || csv.length > 2_000_000) {
    return Response.json({ success: false, error: 'Upload a CSV file under 2 MB.' }, { status: 400 })
  }

  const { data: ageGroups, error: groupError } = await ctx.db
    .from('age_groups')
    .select('id, name')
    .eq('church_id', ctx.church.id)
  if (groupError) return Response.json({ success: false, error: groupError.message }, { status: 500 })

  // Every member, active or not, counts for the duplicate check.
  const existing: (ExistingMember & { id: string; role: string })[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await ctx.db
      .from('members')
      .select('id, first_name, last_name, birthday, role, nickname, age_group_id, parent_name, contact_number, notes')
      .eq('church_id', ctx.church.id)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
    existing.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  const result = checkImport(csv, ageGroups ?? [], existing)
  if ('error' in result) return Response.json({ success: false, error: result.error }, { status: 400 })

  // Every row carries the same full set of columns, so the upsert never blanks a field:
  // new members get a fresh id; existing ones keep their saved values plus the filled blanks.
  const now = new Date().toISOString()
  const byId = new Map(existing.map((m) => [m.id, m]))
  const added = result.rows.flatMap((r) => (r.member ? [{ ...r.member, id: crypto.randomUUID(), church_id: ctx.church.id, updated_at: now }] : []))
  const updated = result.rows.flatMap((r) => {
    const m = r.update && byId.get(r.update.id)
    if (!r.update || !m) return []
    const { id, first_name, last_name, birthday, role, nickname, age_group_id, parent_name, contact_number, notes } = m
    return [{ id, first_name, last_name, birthday, role, nickname, age_group_id, parent_name, contact_number, notes, ...r.update.fills, church_id: ctx.church.id, updated_at: now }]
  })
  if (confirm === true && added.length + updated.length) {
    const { error } = await ctx.db.from('members').upsert([...added, ...updated], { onConflict: 'id' })
    if (error) return Response.json({ success: false, error: `Nothing was imported. ${error.message}` }, { status: 500 })
  }

  const done = confirm === true
  return Response.json({ success: true, imported: done ? added.length : 0, updated: done ? updated.length : 0, rows: result.rows })
}
