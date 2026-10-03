import { kioskFor, todaysSessionId } from '@/app/lib/kiosk'

type Params = { params: Promise<{ church: string }> }

type FirstTimerPayload = {
  parentName?: string
  contactNumber?: string
  childFirstName?: string
  childLastName?: string
  childNickname?: string
  age?: string
  ageGroupId?: string
  serviceTimeId?: string
  birthday?: string
  notes?: string
}

const clip = (v: string | undefined, max = 200) => v?.trim().slice(0, max) || null

// First timer: registers the child as a member and checks them in, in one step.
export async function POST(request: Request, { params }: Params) {
  const k = await kioskFor(params)
  if (k instanceof Response) return k

  const body = (await request.json().catch(() => ({}))) as FirstTimerPayload
  if (!body.parentName || !body.contactNumber || !body.childFirstName || !body.childLastName || !body.ageGroupId || !body.serviceTimeId) {
    return Response.json({ success: false, error: 'Missing required fields.' }, { status: 400 })
  }

  const sessionId = await todaysSessionId(k)
  if (!sessionId) {
    return Response.json({ success: false, error: 'Check-in is not open yet. Ask a volunteer to start today\'s session.' }, { status: 409 })
  }

  // The age group must belong to this church.
  const { data: ageGroup } = await k.db
    .from('age_groups').select('id').eq('id', body.ageGroupId).eq('church_id', k.church.id).maybeSingle()
  if (!ageGroup) return Response.json({ success: false, error: 'Please choose an age group from the list.' }, { status: 400 })

  const { data: member, error: memberError } = await k.db
    .from('members')
    .insert({
      church_id: k.church.id,
      first_name: clip(body.childFirstName),
      last_name: clip(body.childLastName),
      nickname: clip(body.childNickname),
      birthday: body.birthday || null,
      role: 'child',
      age_group_id: ageGroup.id,
      parent_name: clip(body.parentName),
      contact_number: clip(body.contactNumber, 40),
    })
    .select('id')
    .single()

  if (memberError || !member) {
    return Response.json({ success: false, error: 'Registration did not go through. Please try again or ask a volunteer.' }, { status: 500 })
  }

  const { error: attendanceError } = await k.db.from('attendance').insert({
    church_id: k.church.id,
    session_id: sessionId,
    member_id: member.id,
    service_time_id: body.serviceTimeId,
    checked_in: true,
    checked_in_at: new Date().toISOString(),
    notes: clip(body.notes, 1000),
  })

  if (attendanceError) {
    // Don't leave a registered-but-not-checked-in child behind.
    await k.db.from('members').delete().eq('id', member.id).eq('church_id', k.church.id)
    return Response.json({ success: false, error: 'Check-in did not go through. Please try again or ask a volunteer.' }, { status: 400 })
  }

  await k.db.from('first_timers').insert({
    church_id: k.church.id,
    member_id: member.id,
    session_id: sessionId,
    parent_name: clip(body.parentName),
    contact_number: clip(body.contactNumber, 40),
    child_first_name: clip(body.childFirstName),
    child_last_name: clip(body.childLastName),
    child_nickname: clip(body.childNickname),
    birthday: body.birthday || null,
    age: clip(body.age, 3),
    age_group_id: ageGroup.id,
    notes: clip(body.notes, 1000),
  })

  return Response.json({ success: true })
}
