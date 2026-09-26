import { kioskFor, todaysSessionId } from '@/app/lib/kiosk'

type Params = { params: Promise<{ church: string }> }

// Active members of this church not yet checked in today.
export async function GET(_request: Request, { params }: Params) {
  const k = await kioskFor(params)
  if (k instanceof Response) return k

  try {
    const sessionId = await todaysSessionId(k)
    if (!sessionId) return Response.json({ success: true, sessionId: null, members: [] })

    const [{ data: checkedIn }, { data: activeMembers }] = await Promise.all([
      k.db.from('attendance').select('member_id').eq('church_id', k.church.id).eq('session_id', sessionId),
      k.db
        .from('members')
        .select('id, first_name, last_name, nickname, role, birthday, age_groups(name)')
        .eq('church_id', k.church.id)
        .eq('is_active', true),
    ])

    const checkedSet = new Set((checkedIn ?? []).map((r) => r.member_id))
    const members = (activeMembers ?? [])
      .filter((m) => !checkedSet.has(m.id))
      .map((m) => ({
        memberId: m.id,
        firstName: m.first_name,
        lastName: m.last_name,
        nickname: m.nickname,
        ageGroup: (m.age_groups as unknown as { name: string } | null)?.name ?? '',
        role: m.role,
        birthday: m.birthday,
      }))

    return Response.json({ success: true, sessionId, members })
  } catch {
    return Response.json({ success: false, error: 'Could not load today\'s list.' }, { status: 500 })
  }
}
