import { adminApi } from '@/app/lib/church'

export async function GET() {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx

  const { data, error } = await ctx.db
    .from('age_groups')
    .select('id, name, sort_order')
    .eq('church_id', ctx.church.id)
    .order('sort_order')

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, ageGroups: data })
}

export async function POST(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { name } = await request.json()
  if (!name?.trim()) {
    return Response.json({ success: false, error: 'Name is required.' }, { status: 400 })
  }

  const { data: maxRow } = await ctx.db
    .from('age_groups')
    .select('sort_order')
    .eq('church_id', ctx.church.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await ctx.db
    .from('age_groups')
    .insert({ church_id: ctx.church.id, name: name.trim(), sort_order: nextOrder })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ success: false, error: 'An age group with that name already exists.' }, { status: 409 })
    }
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, id: data.id })
}
