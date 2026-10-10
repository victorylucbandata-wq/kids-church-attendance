import { createAdminClient } from '@/app/lib/supabase/admin'
import { listServiceTimes } from '@/app/lib/service-times'

export type Headcount = {
  /** Service time labels that have check-ins, in the church's order. */
  services: string[]
  /** One row per session date, newest first. Kids are counted per service; the Serve Team separately. */
  rows: { date: string; byService: Record<string, number>; kids: number; firstTimers: number; serveTeam: number }[]
}

// Supabase caps each response at 1,000 rows, so read in pages until a short one comes back.
const PAGE = 1000

async function readAll<T>(table: string, columns: string, churchId: string): Promise<T[]> {
  const db = createAdminClient()
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).eq('church_id', churchId).order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}

/**
 * Numbers only, read with the secret key and filtered to one church: Staff accounts can
 * see headcounts but never kids' records (the database itself hides those from them).
 */
export async function loadHeadcount(churchId: string): Promise<Headcount> {
  const [times, sessions, attendance, firstTimers] = await Promise.all([
    listServiceTimes(churchId, { activeOnly: false }),
    readAll<{ id: string; session_date: string }>('sessions', 'id, session_date', churchId),
    readAll<{ session_id: string; service_time_id: string; members: { role: string } | null }>('attendance', 'session_id, service_time_id, members(role)', churchId),
    readAll<{ session_id: string | null }>('first_timers', 'session_id', churchId),
  ])

  const label = new Map(times.map((t) => [t.id, t.label]))
  const used = new Set<string>()
  const rows = new Map(sessions.map((s) => [s.id, { date: s.session_date, byService: {} as Record<string, number>, kids: 0, firstTimers: 0, serveTeam: 0 }]))
  for (const a of attendance) {
    const row = rows.get(a.session_id)
    if (!row) continue
    if (a.members?.role === 'volunteer') {
      row.serveTeam++
      continue
    }
    const service = label.get(a.service_time_id) ?? 'Other'
    used.add(service)
    row.byService[service] = (row.byService[service] ?? 0) + 1
    row.kids++
  }
  for (const f of firstTimers) {
    const row = f.session_id ? rows.get(f.session_id) : undefined
    if (row) row.firstTimers++
  }

  return {
    services: [...times.map((t) => t.label).filter((l) => used.has(l)), ...(used.has('Other') ? ['Other'] : [])],
    rows: [...rows.values()].sort((a, b) => b.date.localeCompare(a.date)),
  }
}
