import { requireAdminPage, type AdminContext } from '@/app/lib/church'
import { listServiceTimes } from '@/app/lib/service-times'
import Link from 'next/link'
import Decor from '@/app/components/Decor'

type SessionRow = {
  id: string
  session_date: string
  generated_at: string
  attendance: { count: number }[]
  first_timers: { count: number }[]
}

type AttendanceRow = {
  session_id: string
  service_time_id: string | null
  members: { role: string; age_groups: { name: string } | null } | null
}

// Supabase caps each response at 1,000 rows, so read attendance in pages
// until a short page comes back; otherwise older sessions silently lose rows.
const PAGE = 1000

async function fetchAllAttendance(ctx: AdminContext) {
  const rows: AttendanceRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await ctx.db
      .from('attendance')
      .select('id, session_id, service_time_id, members(role, age_groups(name))')
      .eq('church_id', ctx.church.id)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return { rows, error }
    rows.push(...((data ?? []) as unknown as AttendanceRow[]))
    if (!data || data.length < PAGE) return { rows, error: null }
  }
}

const ageGroupOf = (r: AttendanceRow) =>
  r.members?.age_groups?.name ?? (r.members?.role === 'volunteer' ? 'Serve Team' : 'Unassigned')

function tally(rows: AttendanceRow[]) {
  const counts: Record<string, number> = {}
  for (const r of rows) counts[ageGroupOf(r)] = (counts[ageGroupOf(r)] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

function CountCard({ label, rows }: { label: string; rows: AttendanceRow[] }) {
  return (
    <div className="rounded-2xl border-2 border-blue-50 bg-blue-50/40 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-bold text-slate-700">{label}</p>
        <p className="text-sm font-bold text-slate-600">{rows.length} total</p>
      </div>
      {tally(rows).map(([group, count]) => (
        <div key={group} className="flex justify-between text-sm">
          <span className="text-slate-600">{group}</span>
          <span className="font-black text-slate-800">{count}</span>
        </div>
      ))}
    </div>
  )
}

export default async function SessionsPage() {
  const ctx = await requireAdminPage()
  const [{ data: sessionData, error: sessionError }, { rows: attendance, error: attendanceError }] = await Promise.all([
    ctx.db
      .from('sessions')
      .select('id, session_date, generated_at, attendance(count), first_timers(count)')
      .eq('church_id', ctx.church.id)
      .order('session_date', { ascending: false }),
    fetchAllAttendance(ctx),
  ])
  const serviceTimes = new Map((await listServiceTimes(ctx.church.id, { activeOnly: false })).map((st) => [st.id, st]))

  const sessions = (sessionData ?? []) as SessionRow[]
  const error = sessionError ?? attendanceError

  const bySession = new Map<string, AttendanceRow[]>()
  for (const a of attendance) {
    const list = bySession.get(a.session_id)
    if (list) list.push(a)
    else bySession.set(a.session_id, [a])
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">📅</span>Past Sessions</h1>
          <p className="text-sm text-slate-600">{sessions.length} sessions recorded</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="inline-flex min-h-11 items-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-brand transition hover:bg-blue-50">
            ← Back to Dashboard
          </Link>
          {sessions.length > 0 && (
            // Plain <a>: this is a file download, not a page navigation.
            <a
              href="/api/admin/sessions/export"
              download
              className="inline-flex min-h-11 items-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong"
            >
              Download all sessions (CSV)
            </a>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            Some attendance data didn&apos;t load, so the numbers below may be incomplete. Refresh to try again. ({error.message})
          </div>
        )}

        <div className="divide-y divide-blue-50 card">
          {sessions.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No sessions yet.</p>
          )}
          {sessions.map((s) => {
            const rows = bySession.get(s.id) ?? []
            const slotOf = (r: AttendanceRow) => (r.service_time_id && serviceTimes.get(r.service_time_id)?.label) || '—'
            const slots = [...new Map(rows.map((r) => [slotOf(r), (r.service_time_id && serviceTimes.get(r.service_time_id)?.sort_order) || 99]))]
              .sort((a, b) => a[1] - b[1])
              .map(([label]) => label)

            return (
              <details key={s.id} className="group px-6 py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  >
                    <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-black text-slate-800">
                      {new Date(`${s.session_date}T00:00:00`).toLocaleDateString('en-PH', {
                        weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {slots.length > 0
                        ? slots.map((slot) => `${slot}: ${rows.filter((r) => slotOf(r) === slot).length}`).join(' · ')
                        : 'Nobody checked in'}
                    </p>
                    {s.first_timers[0]?.count > 0 && (
                      <p className="text-xs font-bold text-yellow-800">
                        {s.first_timers[0].count} first timer{s.first_timers[0].count === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-green-700">{s.attendance[0]?.count ?? 0}</p>
                    <p className="text-xs font-bold text-slate-500">checked in</p>
                  </div>
                </summary>

                {rows.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <CountCard label="Whole day by age group" rows={rows} />
                    {slots.map((slot) => (
                      <CountCard key={slot} label={slot} rows={rows.filter((r) => slotOf(r) === slot)} />
                    ))}
                    <a
                      href={`/api/admin/sessions/export?session=${s.id}`}
                      download
                      className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-brand transition hover:bg-blue-50"
                    >
                      Download this session (CSV)
                    </a>
                  </div>
                )}
              </details>
            )
          })}
        </div>
      </div>
    </main>
  )
}
