import { isAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

function formatDisplayName(firstName: string, lastName: string, nickname: string | null): string {
  if (nickname) return `${nickname} (${lastName}, ${firstName})`
  return `${firstName} ${lastName}`
}

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('en-CA')

    const { data: session } = await supabase
      .from('sessions')
      .select('id, session_date, generated_at')
      .eq('session_date', today)
      .maybeSingle()

    if (!session) {
      return Response.json({
        success: true,
        session: null,
        attendanceRows: [],
        firstTimers: [],
        summary: {
          totalMembers: 0, checkedIn: 0, notCheckedIn: 0, firstTimersToday: 0,
          byTimeSlot: {}, byRole: {}, byAgeGroup: {}, checkedOut: 0, stillHere: 0,
        },
      })
    }

    const { data: activeMembers } = await supabase
      .from('members')
      .select('id, first_name, last_name, nickname, role, birthday, age_group_id, age_groups(name)')
      .eq('is_active', true)

    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('id, member_id, time_slot, checked_in, checked_in_at, checked_out_at, notes')
      .eq('session_id', session.id)

    const attendanceByMember = new Map(
      (attendanceRecords ?? []).map((a) => [a.member_id, a])
    )

    const attendanceRows = (activeMembers ?? []).map((m) => {
      const a = attendanceByMember.get(m.id)
      const ageGroupObj = m.age_groups as unknown as { name: string } | null
      return {
        attendanceId: a?.id ?? m.id,
        memberName: formatDisplayName(m.first_name, m.last_name, m.nickname),
        firstName: m.first_name,
        lastName: m.last_name,
        nickname: m.nickname,
        ageGroup: ageGroupObj?.name ?? (m.role === 'volunteer' ? 'Serve Team' : ''),
        role: m.role as 'child' | 'volunteer',
        timeSlot: a?.time_slot ?? null,
        checkedIn: a?.checked_in ?? false,
        checkedInAt: a?.checked_in_at ?? null,
        checkedOutAt: a?.checked_out_at ?? null,
        birthday: m.birthday,
        notes: a?.notes ?? null,
      }
    })

    const checkedIn = attendanceRows.filter((r) => r.checkedIn)
    const byTimeSlot: Record<string, number> = {}
    const byRole: Record<string, number> = {}
    const byAgeGroup: Record<string, number> = {}

    for (const r of checkedIn) {
      if (r.timeSlot) byTimeSlot[r.timeSlot] = (byTimeSlot[r.timeSlot] ?? 0) + 1
      byRole[r.role] = (byRole[r.role] ?? 0) + 1
      if (r.ageGroup) byAgeGroup[r.ageGroup] = (byAgeGroup[r.ageGroup] ?? 0) + 1
    }

    const checkedOut = checkedIn.filter((r) => r.checkedOutAt).length

    const { data: ftRecords } = await supabase
      .from('first_timers')
      .select('child_first_name, child_last_name, child_nickname, parent_name, contact_number, age, birthday, notes, submitted_at, age_group_id, age_groups(name)')
      .eq('session_id', session.id)

    const firstTimers = (ftRecords ?? []).map((ft) => {
      const ageGroupObj = ft.age_groups as unknown as { name: string } | null
      return {
        submittedAt: ft.submitted_at,
        parentName: ft.parent_name ?? '',
        contactNumber: ft.contact_number ?? '',
        childFirstName: ft.child_first_name,
        childLastName: ft.child_last_name,
        childNickname: ft.child_nickname,
        age: ft.age ?? '',
        ageGroup: ageGroupObj?.name ?? '',
        birthday: ft.birthday,
        notes: ft.notes,
      }
    })

    return Response.json({
      success: true,
      session,
      attendanceRows,
      firstTimers,
      summary: {
        totalMembers: attendanceRows.length,
        checkedIn: checkedIn.length,
        notCheckedIn: attendanceRows.length - checkedIn.length,
        firstTimersToday: firstTimers.length,
        byTimeSlot,
        byRole,
        byAgeGroup,
        checkedOut,
        stillHere: checkedIn.length - checkedOut,
      },
    })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load data.' },
      { status: 500 }
    )
  }
}
