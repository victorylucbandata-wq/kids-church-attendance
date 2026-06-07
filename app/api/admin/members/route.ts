import { isAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const role = searchParams.get('role') ?? ''
  const ageGroup = searchParams.get('ageGroup') ?? ''
  const active = searchParams.get('active') ?? 'true'

  const supabase = await createClient()

  let query = supabase
    .from('members')
    .select('id, first_name, last_name, nickname, birthday, role, age_group_id, age_groups(name), parent_name, contact_number, notes, is_active, created_at')
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
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .insert({
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
