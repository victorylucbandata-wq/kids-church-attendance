import { isAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname, birthday, role, age_group_id, age_groups(name), parent_name, contact_number, notes, is_active')
    .eq('id', id)
    .single()

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 404 })
  }

  const ageGroupObj = data.age_groups as unknown as { name: string } | null
  return Response.json({ success: true, member: { ...data, age_group_name: ageGroupObj?.name ?? '', age_groups: undefined } })
}

export async function PUT(request: Request, { params }: Params) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  const { error } = await supabase
    .from('members')
    .update({
      first_name: body.first_name,
      last_name: body.last_name,
      nickname: body.nickname || null,
      birthday: body.birthday || null,
      role: body.role || 'child',
      age_group_id: body.age_group_id || null,
      parent_name: body.parent_name || null,
      contact_number: body.contact_number || null,
      notes: body.notes || null,
      is_active: body.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}

export async function PATCH(request: Request, { params }: Params) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  const { error } = await supabase
    .from('members')
    .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
