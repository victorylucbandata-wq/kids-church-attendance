import { adminApi } from '@/app/lib/church'
import { createAdminClient } from '@/app/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// Rename, reorder, or bring back a hidden service time.
export async function PUT(request: Request, { params }: Params) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { label?: string; sort_order?: number; is_active?: boolean }

  const updates: Record<string, unknown> = {}
  if (body.label !== undefined) {
    const clean = body.label.trim().slice(0, 40)
    if (!clean) return Response.json({ success: false, error: 'Service time cannot be empty.' }, { status: 400 })
    updates.label = clean
  }
  if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  const { error } = await createAdminClient()
    .from('service_times').update(updates).eq('id', id).eq('church_id', ctx.church.id)
  if (error) {
    if (error.code === '23505') return Response.json({ success: false, error: 'That service time already exists.' }, { status: 409 })
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
  return Response.json({ success: true })
}

// Deletes an unused time; hides one that past check-ins used, so history keeps its label.
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx
  const { id } = await params
  const db = createAdminClient()

  const { count } = await db
    .from('attendance').select('id', { count: 'exact', head: true }).eq('church_id', ctx.church.id).eq('service_time_id', id)

  const { error } = (count ?? 0) > 0
    ? await db.from('service_times').update({ is_active: false }).eq('id', id).eq('church_id', ctx.church.id)
    : await db.from('service_times').delete().eq('id', id).eq('church_id', ctx.church.id)

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true, hidden: (count ?? 0) > 0 })
}
