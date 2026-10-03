import { adminApi } from '@/app/lib/church'

export async function GET(request: Request) {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx

  const { searchParams } = new URL(request.url)
  // Strip characters that have meaning in PostgREST filter syntax.
  const search = (searchParams.get('search') ?? '').replace(/[,()*%\\]/g, ' ').trim()
  const role = searchParams.get('role') ?? ''
  const ageGroup = searchParams.get('ageGroup') ?? ''
  const active = searchParams.get('active') ?? 'true'

  let query = ctx.db
    .from('members')
    .select('id, first_name, last_name, nickname, birthday, role, age_group_id, age_groups(name), parent_name, contact_number, notes, is_active, created_at')
    .eq('church_id', ctx.church.id)
    .order('last_name')
    .order('first_name')

  if (active === 'true') query = query.eq('is_active', true)
  else if (active === 'false') query = query.eq('is_active', false)

  if (role) query = query.eq('role', role)
  if (ageGroup) query = query.eq('age_group_id', ageGroup)

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,nickname.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  const members = (data ?? []).map((m) => {
    const ageGroupObj = m.age_groups as unknown as { name: string } | null
    return { ...m, age_group_name: ageGroupObj?.name ?? '', age_groups: undefined }
  })

  return Response.json({ success: true, members })
}

export async function POST(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const body = await request.json()

  const { data, error } = await ctx.db
    .from('members')
    .insert({
      church_id: ctx.church.id,
      first_name: body.first_name,
      last_name: body.last_name,
      nickname: body.nickname || null,
      birthday: body.birthday || null,
      role: body.role || 'child',
      age_group_id: body.age_group_id || null,
      parent_name: body.parent_name || null,
      contact_number: body.contact_number || null,
      notes: body.notes || null,
    })
    .select('id')
    .single()

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, id: data.id })
}
