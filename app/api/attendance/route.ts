import { createClient } from '@/app/lib/supabase/server'

type FirstTimerPayload = {
  parentName?: string
  contactNumber?: string
  childFirstName?: string
  childLastName?: string
  childNickname?: string
  age?: string
  ageGroup?: string
  timeSlot?: string
  birthday?: string
  notes?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FirstTimerPayload

    if (!body.parentName || !body.contactNumber || !body.childFirstName || !body.childLastName || !body.ageGroup || !body.timeSlot) {
      return Response.json(
        { success: false, error: 'Missing required fields.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const today = new Date().toLocaleDateString('en-CA')

    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_date', today)
      .maybeSingle()

    if (!session) {
      return Response.json(
        { success: false, error: 'No session exists for today. Ask a volunteer to start one.' },
        { status: 400 }
      )
    }

    const { data: ageGroup } = await supabase
      .from('age_groups')
      .select('id')
      .eq('name', body.ageGroup)
      .maybeSingle()

    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        first_name: body.childFirstName,
        last_name: body.childLastName,
        nickname: body.childNickname || null,
        birthday: body.birthday || null,
        role: 'child',
        age_group_id: ageGroup?.id ?? null,
        parent_name: body.parentName,
        contact_number: body.contactNumber,
      })
      .select('id')
      .single()

    if (memberError) throw memberError

    const { error: attendanceError } = await supabase.from('attendance').insert({
      session_id: session.id,
      member_id: member.id,
      time_slot: body.timeSlot,
      checked_in: true,
      checked_in_at: new Date().toISOString(),
      notes: body.notes || null,
    })

    if (attendanceError) throw attendanceError

    await supabase.from('first_timers').insert({
      member_id: member.id,
      session_id: session.id,
      parent_name: body.parentName,
      contact_number: body.contactNumber,
      child_first_name: body.childFirstName,
      child_last_name: body.childLastName,
      child_nickname: body.childNickname || null,
      birthday: body.birthday || null,
      age: body.age || null,
      age_group_id: ageGroup?.id ?? null,
      notes: body.notes || null,
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to submit attendance.' },
      { status: 500 }
    )
  }
}
