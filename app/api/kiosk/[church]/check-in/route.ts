import { checkInState, kioskFor, serviceTimeFor } from '@/app/lib/kiosk'

type Params = { params: Promise<{ church: string }> }

// Returning member check-in.
export async function POST(request: Request, { params }: Params) {
  const k = await kioskFor(params)
  if (k instanceof Response) return k

  const { memberId, serviceTimeId, notes } = (await request.json().catch(() => ({}))) as {
    memberId?: string
    serviceTimeId?: string
    notes?: string
  }
  const state = await checkInState(k)
  if (!state.sessionId) {
    return Response.json({ success: false, error: state.closed ?? 'Check-in is not open yet. Please ask a volunteer.' }, { status: 409 })
  }
  const serviceTime = serviceTimeFor(state, serviceTimeId)
  if (!memberId || !serviceTime) {
    return Response.json({ success: false, error: 'Choose a service time and a name.' }, { status: 400 })
  }

  const { error } = await k.db.from('attendance').insert({
    church_id: k.church.id,
    session_id: state.sessionId,
    member_id: memberId,
    service_time_id: serviceTime,
    checked_in: true,
    checked_in_at: new Date().toISOString(),
    notes: notes?.slice(0, 1000) || null,
  })

  if (error) {
    if (error.code === '23505') {
      return Response.json({ success: false, error: 'Already checked in today.' }, { status: 409 })
    }
    // check_violation: the member or service time belongs to another church.
    return Response.json({ success: false, error: 'Check-in did not go through. Please ask a volunteer.' }, { status: 400 })
  }

  return Response.json({ success: true })
}
