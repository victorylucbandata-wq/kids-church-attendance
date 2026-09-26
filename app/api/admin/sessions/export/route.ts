import { isAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'
import { asText, toCsv } from '@/app/lib/csv'

// Supabase caps each response at 1,000 rows, so read in pages (same as the Past Sessions page).
const PAGE = 1000
const SLOT_ORDER = ['9am', '11am', 'Special']
const SLOT_LABEL: Record<string, string> = { '9am': '9:00 AM', '11am': '11:00 AM', Special: 'Special Event' }

type Row = {
  id: string
  session_id: string
  member_id: string
  time_slot: string | null
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
  if (!(await isAdmin())) {
    return new Response('Please sign in as admin to export.', { status: 401 })
  }

  const sessionId = new URL(request.url).searchParams.get('session')
  const supabase = await createClient()

  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('attendance')
      .select(
        'id, session_id, member_id, time_slot, checked_in_at, checked_out_at, notes, sessions(session_date), members(first_name, last_name, nickname, role, birthday, parent_name, contact_number, age_groups(name))'
      )
      .order('id')
      .range(from, from + PAGE - 1)
    if (sessionId) query = query.eq('session_id', sessionId)
    const { data, error } = await query
    if (error) return new Response(`Export failed: ${error.message}`, { status: 500 })
    rows.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < PAGE) break
  }

  // First timers are recorded per session, so mark the row for that session only.
  let ftQuery = supabase.from('first_timers').select('session_id, member_id')
  if (sessionId) ftQuery = ftQuery.eq('session_id', sessionId)
  const { data: firstTimers } = await ftQuery
  const firstTimerKeys = new Set((firstTimers ?? []).map((f) => `${f.session_id}:${f.member_id}`))

  const slotRank = (s: string | null) => (SLOT_ORDER.indexOf(s ?? '') + 1) || 99
  rows.sort(
    (a, b) =>
      (a.sessions?.session_date ?? '').localeCompare(b.sessions?.session_date ?? '') ||
      slotRank(a.time_slot) - slotRank(b.time_slot) ||
      (a.members?.last_name ?? '').localeCompare(b.members?.last_name ?? '') ||
      (a.members?.first_name ?? '').localeCompare(b.members?.first_name ?? '')
  )

  const header = [
    'Date', 'Day', 'Time Slot', 'Last Name', 'First Name', 'Nickname', 'Role', 'Age Group',
    'First Timer', 'Checked In', 'Checked Out', 'Birthday', 'Parent / Guardian', 'Contact Number', 'Notes',
  ]
  const CONTACT_COLUMN = 13

  const body = toCsv(
    header,
    rows.map((r) => {
      const m = r.members
      const date = r.sessions?.session_date ?? ''
      return [
        date,
        date ? weekday(date) : '',
        SLOT_LABEL[r.time_slot ?? ''] ?? r.time_slot,
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

  const stamp = sessionId ? rows[0]?.sessions?.session_date ?? 'session' : `all-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kids-church-attendance-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
