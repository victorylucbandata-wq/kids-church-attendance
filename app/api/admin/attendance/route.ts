import { isAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { memberId, sessionId, timeSlot, notes } = await request.json()

  if (!memberId || !sessionId || !timeSlot) {
    return Response.json({ success: false, error: 'memberId, sessionId, and timeSlot are required.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase.from('attendance').insert({
    session_id: sessionId,
    member_id: memberId,
    time_slot: timeSlot,
    checked_in: true,
    checked_in_at: new Date().toISOString(),
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

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { attendanceId, sessionId, timeSlot, checkedOut, bulkCheckoutAll } = await request.json()

  if (bulkCheckoutAll && sessionId) {
    const supabase = await createClient()
    const { error } = await supabase
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('checked_in', true)
      .is('checked_out_at', null)

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }
    return Response.json({ success: true })
  }

  if (!attendanceId) {
    return Response.json({ success: false, error: 'attendanceId is required.' }, { status: 400 })
  }

  const supabase = await createClient()
  const updates: Record<string, unknown> = {}

  if (timeSlot) updates.time_slot = timeSlot
  if (checkedOut) updates.checked_out_at = new Date().toISOString()

  const { error } = await supabase
    .from('attendance')
    .update(updates)
    .eq('id', attendanceId)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
