import { checkInState, kioskFor } from '@/app/lib/kiosk'
import { isBirthdayThisWeek, isBirthdayToday } from '@/app/lib/birthday'
import { todayInManila } from '@/app/lib/dates'

type Params = { params: Promise<{ church: string }> }

// Active members of this church not yet checked in today, plus whether check-in is open.
export async function GET(_request: Request, { params }: Params) {
  const k = await kioskFor(params)
  if (k instanceof Response) return k

  try {
    const { sessionId, serviceTimes, closed } = await checkInState(k)
    if (!sessionId) return Response.json({ success: true, sessionId: null, members: [], serviceTimes, closed })

    const [{ data: checkedIn }, { data: activeMembers }, { data: rosterRows }] = await Promise.all([
      k.db.from('attendance').select('member_id').eq('church_id', k.church.id).eq('session_id', sessionId),
      k.db
        .from('members')
        .select('id, first_name, last_name, nickname, role, birthday, age_groups(name)')
        .eq('church_id', k.church.id)
        .eq('is_active', true),
      k.db.from('roster').select('service_time_id, member_id, serve_role').eq('church_id', k.church.id).eq('service_date', todayInManila()),
    ])

    // Per service: who is rostered to serve, and as what. The kiosk lists only them under Serve Team.
    const roster: Record<string, Record<string, string>> = {}
    for (const r of rosterRows ?? []) (roster[r.service_time_id] ??= {})[r.member_id] = r.serve_role

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

    return Response.json({ success: true, sessionId, members, serviceTimes, closed, roster })
  } catch {
    return Response.json({ success: false, error: 'Could not load today\'s list.' }, { status: 500 })
  }
}
