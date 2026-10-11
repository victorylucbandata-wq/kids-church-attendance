import { adminApi } from '@/app/lib/church'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx

  const { id } = await params

  const { data, error } = await ctx.db
    .from('members')
    .select('id, first_name, last_name, nickname, birthday, role, age_group_id, age_groups(name), parent_name, contact_number, notes, is_active')
    .eq('id', id)
    .eq('church_id', ctx.church.id)
    .single()

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 404 })
  }

  const ageGroupObj = data.age_groups as unknown as { name: string } | null
  return Response.json({ success: true, member: { ...data, age_group_name: ageGroupObj?.name ?? '', age_groups: undefined } })
}

export async function PUT(request: Request, { params }: Params) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { id } = await params
  const body = await request.json()

  const { error } = await ctx.db
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
    .eq('church_id', ctx.church.id)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { id } = await params
  const body = await request.json()

  const { error } = await ctx.db
    .from('members')
    .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('church_id', ctx.church.id)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}

// A parent's request to delete their child's details. Leads only. With check-in history the
// personal details are erased and an anonymous record keeps past headcounts right; without
// history the record is deleted. The database function enforces the Lead rule too.
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await adminApi({ lead: true })
  if (ctx instanceof Response) return ctx

  const { id } = await params
  const { data: member } = await ctx.db.from('members').select('id').eq('id', id).eq('church_id', ctx.church.id).maybeSingle()
  if (!member) return Response.json({ success: false, error: 'That member is not part of this church.' }, { status: 404 })

  const { data, error } = await ctx.db.rpc('erase_member', { target: id })
  if (error) return Response.json({ success: false, error: 'Could not delete this member. Nothing was changed.' }, { status: 500 })
  return Response.json({ success: true, result: data as 'erased' | 'deleted' })
}
