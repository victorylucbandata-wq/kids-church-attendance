import { checkInState, kioskFor } from '@/app/lib/kiosk'
import { isBirthdayThisWeek, isBirthdayToday } from '@/app/lib/birthday'
import { todayInManila } from '@/app/lib/dates'

type Params = { params: Promise<{ church: string }> }

// Active kids of this church not yet checked in today, plus whether check-in is open.
// The Serve Team is checked in by the team lead on the Today tab, not at the kiosk.
export async function GET(_request: Request, { params }: Params) {
  const k = await kioskFor(params)
  if (k instanceof Response) return k

  try {
    const { sessionId, serviceTimes, closed } = await checkInState(k)
    if (!sessionId) return Response.json({ success: true, sessionId: null, members: [], serviceTimes, closed })

    const [{ data: checkedIn }, { data: activeMembers }] = await Promise.all([
      k.db.from('attendance').select('member_id').eq('church_id', k.church.id).eq('session_id', sessionId),
      k.db
        .from('members')
        .select('id, first_name, last_name, nickname, role, birthday, age_groups(name)')
        .eq('church_id', k.church.id)
        .eq('role', 'child')
        .eq('is_active', true),
    ])

    // This list is public, so it says whose birthday is near but never the date itself.
    const today = new Date(todayInManila() + 'T00:00:00')
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
        birthday: isBirthdayToday(m.birthday, today) ? 'today' : isBirthdayThisWeek(m.birthday, today) ? 'week' : null,
      }))

    return Response.json({ success: true, sessionId, members, serviceTimes, closed })
  } catch {
    return Response.json({ success: false, error: 'Could not load today\'s list.' }, { status: 500 })
  }
}
