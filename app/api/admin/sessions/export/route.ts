import { adminApi, listAccess } from '@/app/lib/church'
import { createClient } from '@/app/lib/supabase/server'
import { asText, toCsv } from '@/app/lib/csv'
import { todayInManila } from '@/app/lib/dates'

// Supabase caps each response at 1,000 rows, so read in pages (same as the Past Sessions page).
const PAGE = 1000

type Row = {
  id: string
  session_id: string
  member_id: string
  service_times: { label: string; sort_order: number } | null
  churches: { name: string } | null
  checked_in_at: string | null
  checked_out_at: string | null
  notes: string | null
  sessions: { session_date: string } | null
  members: {
    first_name: string
    last_name: string
    nickname: string | null
    role: string
    birthday: string | null
    parent_name: string | null
    contact_number: string | null
    age_groups: { name: string } | null
  } | null
}

const time = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : ''

const weekday = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long' })

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const sessionId = params.get('session')

  // ?scope=network: every church, for network admins. Otherwise: the current church only.
  let supabase: Awaited<ReturnType<typeof createClient>>
  let churchId: string | null = null
  if (params.get('scope') === 'network') {
    supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await listAccess(user.id)).isNetworkAdmin) {
      return new Response('Network admins only.', { status: 403 })
    }
  } else {
    const ctx = await adminApi()
    if (ctx instanceof Response) return new Response('Please sign in to export.', { status: ctx.status })
    supabase = ctx.db
    churchId = ctx.church.id
  }

  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('attendance')
      .select(
        'id, session_id, member_id, checked_in_at, checked_out_at, notes, sessions(session_date), service_times(label, sort_order), churches(name), members(first_name, last_name, nickname, role, birthday, parent_name, contact_number, age_groups(name))'
      )
      .order('id')
      .range(from, from + PAGE - 1)
    if (churchId) query = query.eq('church_id', churchId)
    if (sessionId) query = query.eq('session_id', sessionId)
    const { data, error } = await query
    if (error) return new Response(`Export failed: ${error.message}`, { status: 500 })
    rows.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < PAGE) break
  }

  // First timers are recorded per session, so mark the row for that session only.
  let ftQuery = supabase.from('first_timers').select('session_id, member_id')
  if (churchId) ftQuery = ftQuery.eq('church_id', churchId)
  if (sessionId) ftQuery = ftQuery.eq('session_id', sessionId)
  const { data: firstTimers } = await ftQuery
  const firstTimerKeys = new Set((firstTimers ?? []).map((f) => `${f.session_id}:${f.member_id}`))

  rows.sort(
    (a, b) =>
      (a.churches?.name ?? '').localeCompare(b.churches?.name ?? '') ||
      (a.sessions?.session_date ?? '').localeCompare(b.sessions?.session_date ?? '') ||
      (a.service_times?.sort_order ?? 99) - (b.service_times?.sort_order ?? 99) ||
      (a.members?.last_name ?? '').localeCompare(b.members?.last_name ?? '') ||
      (a.members?.first_name ?? '').localeCompare(b.members?.first_name ?? '')
  )

  const header = [
    'Church', 'Date', 'Day', 'Time Slot', 'Last Name', 'First Name', 'Nickname', 'Role', 'Age Group',
    'First Timer', 'Checked In', 'Checked Out', 'Birthday', 'Parent / Guardian', 'Contact Number', 'Notes',
  ]
  const CONTACT_COLUMN = 14

  const body = toCsv(
    header,
    rows.map((r) => {
      const m = r.members
      const date = r.sessions?.session_date ?? ''
      return [
        r.churches?.name,
        date,
        date ? weekday(date) : '',
        r.service_times?.label,
        m?.last_name,
        m?.first_name,
        m?.nickname,
        m?.role === 'volunteer' ? 'Serve Team' : 'Child',
        m?.age_groups?.name ?? (m?.role === 'volunteer' ? 'Serve Team' : ''),
        firstTimerKeys.has(`${r.session_id}:${r.member_id}`) ? 'Yes' : '',
        time(r.checked_in_at),
        time(r.checked_out_at),
        m?.birthday,
        m?.parent_name,
        asText(m?.contact_number),
        r.notes,
      ]
    }),
    [CONTACT_COLUMN]
  )

  const prefix = churchId ? 'kids-church-attendance' : 'kids-church-network'
  const stamp = sessionId ? rows[0]?.sessions?.session_date ?? 'session' : `all-${todayInManila()}`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${prefix}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
