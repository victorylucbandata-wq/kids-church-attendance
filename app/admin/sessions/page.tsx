import { requireAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

const SLOT_ORDER = ['9am', '11am', 'Special']

type SessionRow = {
  id: string
  session_date: string
  generated_at: string
  attendance: { count: number }[]
  first_timers: { count: number }[]
}

type AttendanceRow = {
  session_id: string
  time_slot: string | null
  members: { role: string; age_groups: { name: string } | null } | null
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xs font-bold text-slate-500">{rows.length} total</p>
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
  await requireAdmin()

  const supabase = await createClient()
  const [{ data: sessionData, error }, { data: attendanceData }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_date, generated_at, attendance(count), first_timers(count)')
      .order('session_date', { ascending: false }),
    supabase.from('attendance').select('session_id, time_slot, members(role, age_groups(name))'),
  ])

  const sessions = (sessionData ?? []) as SessionRow[]
  const attendance = (attendanceData ?? []) as unknown as AttendanceRow[]

  const bySession = new Map<string, AttendanceRow[]>()
  for (const a of attendance) {
    const list = bySession.get(a.session_id)
    if (list) list.push(a)
    else bySession.set(a.session_id, [a])
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#227EEE]">Admin</p>
          <h1 className="text-2xl font-black text-slate-900">Past Sessions</h1>
          <p className="text-sm text-slate-500">{sessions.length} sessions recorded</p>
        </div>

        <a href="/admin" className="inline-block rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
          ← Back to Dashboard
        </a>

        {error && (
          <div className="rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error.message}
          </div>
        )}

        <div className="divide-y divide-blue-50 rounded-[2rem] border border-blue-100 bg-white shadow-lg shadow-blue-100/50">
          {sessions.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No sessions yet.</p>
          )}
          {sessions.map((s) => {
            const rows = bySession.get(s.id) ?? []
            const slots = [...new Set(rows.map((r) => r.time_slot ?? '—'))].sort(
              (a, b) => (SLOT_ORDER.indexOf(a) + 1 || 99) - (SLOT_ORDER.indexOf(b) + 1 || 99)
            )

            return (
              <details key={s.id} className="group px-6 py-4">
                <summary className="flex cursor-pointer items-center justify-between list-none">
                  <div>
                    <p className="font-black text-slate-800">
                      {new Date(`${s.session_date}T00:00:00`).toLocaleDateString('en-PH', {
                        weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs font-bold text-slate-400">
                      {slots.length > 0
                        ? slots.map((slot) => `${slot}: ${rows.filter((r) => (r.time_slot ?? '—') === slot).length}`).join(' · ')
                        : 'Nobody checked in'}
                    </p>
                    {s.first_timers[0]?.count > 0 && (
                      <p className="text-xs font-bold text-amber-600">
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
                      <CountCard key={slot} label={slot} rows={rows.filter((r) => (r.time_slot ?? '—') === slot)} />
                    ))}
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
