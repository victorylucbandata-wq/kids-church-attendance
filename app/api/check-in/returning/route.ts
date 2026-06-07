import { createClient } from '@/app/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { memberId, sessionId, timeSlot, notes } = (await request.json()) as {
      memberId?: string
      sessionId?: string
      timeSlot?: string
      notes?: string
    }

    if (!memberId || !sessionId || !timeSlot) {
      return Response.json(
        { success: false, error: 'memberId, sessionId, and timeSlot are required.' },
        { status: 400 }
      )
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
        return Response.json(
          { success: false, error: 'This member is already checked in.' },
          { status: 409 }
        )
      }
      throw error
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Check-in failed.' },
      { status: 500 }
    )
  }
}
