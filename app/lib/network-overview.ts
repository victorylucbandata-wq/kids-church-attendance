import { createAdminClient } from '@/app/lib/supabase/admin'
import { todayInManila } from '@/app/lib/dates'

export type ChurchOverview = {
  id: string
  name: string
  slug: string
  isActive: boolean
  todayStarted: boolean
  latest: { date: string; checkIns: number; firstTimers: number; serveTeam: number } | null
  previous: { date: string; checkIns: number } | null
}

// One row per church: its two most recent sessions. Only called after a network-admin check.
export async function loadNetworkOverview(): Promise<ChurchOverview[]> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 35 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const [{ data: churches }, { data: sessions }] = await Promise.all([
    admin.from('churches').select('id, name, slug, is_active').order('name'),
    admin
      .from('sessions')
      .select('id, church_id, session_date, first_timers(count), attendance(checked_in, members(role))')
      .gte('session_date', since)
      .order('session_date', { ascending: false }),
  ])

  type S = {
    id: string
    church_id: string
    session_date: string
    first_timers: { count: number }[]
    attendance: { checked_in: boolean; members: { role: string } | null }[]
  }
  const byChurch = new Map<string, S[]>()
  for (const s of (sessions ?? []) as unknown as S[]) {
    const list = byChurch.get(s.church_id) ?? []
    list.push(s)
    byChurch.set(s.church_id, list)
  }
  const today = todayInManila()

  return (churches ?? []).map((c) => {
    const [latest, previous] = byChurch.get(c.id) ?? []
    const checkedIn = (s: S) => s.attendance.filter((a) => a.checked_in)
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.is_active,
      todayStarted: latest?.session_date === today,
      latest: latest
        ? {
            date: latest.session_date,
            checkIns: checkedIn(latest).length,
            firstTimers: latest.first_timers[0]?.count ?? 0,
            serveTeam: checkedIn(latest).filter((a) => a.members?.role === 'volunteer').length,
          }
        : null,
      previous: previous ? { date: previous.session_date, checkIns: checkedIn(previous).length } : null,
    }
  })
}
