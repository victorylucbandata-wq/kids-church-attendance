import { adminApi } from '@/app/lib/church'
import { checkImport, type ExistingMember } from '@/app/lib/member-import'

const PAGE = 1000

// POST { csv, confirm }: always re-checks the file on the server. Without `confirm` it is
// only a preview; with it, every good row is inserted in one statement (all or nothing).
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
  const existing: ExistingMember[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await ctx.db
      .from('members')
      .select('first_name, last_name, birthday')
      .eq('church_id', ctx.church.id)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
    existing.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  const result = checkImport(csv, ageGroups ?? [], existing)
  if ('error' in result) return Response.json({ success: false, error: result.error }, { status: 400 })

  const toInsert = result.rows.flatMap((r) => (r.member ? [{ ...r.member, church_id: ctx.church.id }] : []))
  if (confirm === true && toInsert.length) {
    const { error } = await ctx.db.from('members').insert(toInsert)
    if (error) return Response.json({ success: false, error: `Nothing was imported. ${error.message}` }, { status: 500 })
  }

  return Response.json({ success: true, imported: confirm === true ? toInsert.length : 0, rows: result.rows })
}
