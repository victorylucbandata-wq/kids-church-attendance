import type { AdminContext } from '@/app/lib/church'
import { formatDisplayName } from '@/app/lib/display-name'
import { listServiceTimes } from '@/app/lib/service-times'
import { todayInManila } from '@/app/lib/dates'

// Today's dashboard for the signed-in person's church. Shared by /admin (first render)
// and /api/admin/data (20-second refresh).
export async function loadDashboardData(ctx: AdminContext) {
  const supabase = ctx.db
  const churchId = ctx.church.id
  const today = todayInManila()
  const serviceTimes = await listServiceTimes(churchId)

  const { data: session } = await supabase
    .from('sessions')
    .select('id, session_date, generated_at')
    .eq('church_id', churchId)
    .eq('session_date', today)
    .maybeSingle()

  if (!session) {
    return {
      success: true,
      church: ctx.church,
      role: ctx.role,
      email: ctx.email,
      serviceTimes,
      session: null,
      attendanceRows: [],
      firstTimers: [],
      summary: {
        totalMembers: 0, checkedIn: 0, notCheckedIn: 0, firstTimersToday: 0,
        byTimeSlot: {}, byRole: {}, byAgeGroup: {}, checkedOut: 0, stillHere: 0,
      },
    }
  }

  const { data: activeMembers } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname, role, birthday, age_group_id, age_groups(name)')
    .eq('church_id', churchId)
    .eq('is_active', true)

  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('id, member_id, service_time_id, checked_in, checked_in_at, checked_out_at, notes')
    .eq('church_id', churchId)
    .eq('session_id', session.id)

  const slotLabel = new Map(serviceTimes.map((st) => [st.id, st.label]))
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
      timeSlot: a?.service_time_id ? slotLabel.get(a.service_time_id) ?? null : null,
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
    .eq('church_id', churchId)
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

  return {
    success: true,
    church: ctx.church,
    role: ctx.role,
    email: ctx.email,
    serviceTimes,
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
  }
}
