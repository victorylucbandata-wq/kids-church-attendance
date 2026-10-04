import { adminApi } from '@/app/lib/church'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { id } = await params
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  const { error } = await ctx.db
    .from('age_groups')
    .update(updates)
    .eq('id', id)
    .eq('church_id', ctx.church.id)

  if (error) {
    if (error.code === '23505') {
      return Response.json({ success: false, error: 'An age group with that name already exists.' }, { status: 409 })
    }
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { id } = await params

  const { count } = await ctx.db
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('church_id', ctx.church.id)
    .eq('age_group_id', id)

  if (count && count > 0) {
    return Response.json(
      { success: false, error: `Cannot delete: ${count} member${count > 1 ? 's' : ''} still in this age group.` },
      { status: 409 }
    )
  }

  const { error } = await ctx.db
    .from('age_groups')
    .delete()
    .eq('id', id)
    .eq('church_id', ctx.church.id)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
