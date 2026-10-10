import { adminApi } from '@/app/lib/church'

// Manual check-in from the dashboard.
export async function POST(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { memberId, sessionId, serviceTimeId, notes } = await request.json()

  if (!memberId || !sessionId || !serviceTimeId) {
    return Response.json({ success: false, error: 'Choose a member and a service time.' }, { status: 400 })
  }

  // The database rejects rows that mix churches; this gives a friendlier message first.
  const { data: session } = await ctx.db
    .from('sessions').select('id').eq('id', sessionId).eq('church_id', ctx.church.id).maybeSingle()
  if (!session) return Response.json({ success: false, error: 'That session is not part of this church.' }, { status: 404 })

  const { error } = await ctx.db.from('attendance').insert({
    church_id: ctx.church.id,
    session_id: sessionId,
    member_id: memberId,
    service_time_id: serviceTimeId,
    checked_in: true,
    checked_in_at: new Date().toISOString(),
    checked_in_by: ctx.userId,
    notes: notes || null,
  })

  if (error) {
    if (error.code === '23505') {
      return Response.json({ success: false, error: 'This member is already checked in.' }, { status: 409 })
    }
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}

// Check-out (one child, or everyone still here, optionally only from one service), and service-time corrections.
export async function PATCH(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { attendanceId, sessionId, serviceTimeId, checkedOut, bulkCheckoutAll } = await request.json()
  const now = new Date().toISOString()

  if (bulkCheckoutAll && sessionId) {
    let query = ctx.db
      .from('attendance')
      .update({ checked_out_at: now, checked_out_by: ctx.userId })
      .eq('church_id', ctx.church.id)
      .eq('session_id', sessionId)
      .eq('checked_in', true)
      .is('checked_out_at', null)
    if (serviceTimeId) query = query.eq('service_time_id', serviceTimeId)
    const { error } = await query

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }
    return Response.json({ success: true })
  }

  if (!attendanceId) {
    return Response.json({ success: false, error: 'attendanceId is required.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (serviceTimeId) updates.service_time_id = serviceTimeId
  if (checkedOut) {
    updates.checked_out_at = now
    updates.checked_out_by = ctx.userId
  }

  const { error } = await ctx.db
    .from('attendance')
    .update(updates)
    .eq('id', attendanceId)
    .eq('church_id', ctx.church.id)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
