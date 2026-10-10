import { requireAdminPage } from '@/app/lib/church'
import { loadHeadcount } from '@/app/lib/headcount'
import Decor from '@/app/components/Decor'

const day = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

// Numbers only: Staff accounts land here and can't open anything else.
export default async function HeadcountPage() {
  const ctx = await requireAdminPage({ staff: true })
  const { services, rows } = await loadHeadcount(ctx.church.id)
  const last = rows[0]
  const recent = rows.slice(0, 4)
  const average = recent.length ? Math.round(recent.reduce((n, r) => n + r.kids, 0) / recent.length) : 0

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">📊</span>Headcount</h1>
          <p className="text-sm text-slate-600">Kids per service, first timers and Serve Team, by date.</p>
        </div>

        {last && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-center">
              <p className="text-3xl font-black text-green-700 tabular-nums">{last.kids}</p>
              <p className="text-sm font-bold text-slate-600">kids on {day(last.date)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-black text-brand tabular-nums">{average}</p>
              <p className="text-sm font-bold text-slate-600">kids on average, last {recent.length} Sunday{recent.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          // Plain <a>: a file download, not a page navigation.
          <a
            href="/api/admin/headcount?format=csv"
            download
            className="inline-flex min-h-11 items-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong"
          >
            Download headcount (CSV)
          </a>
        )}

        <div className="card overflow-x-auto p-2">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-600">No sessions yet.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-slate-700">
                  <th scope="col" className="px-2 py-2 font-bold">Date</th>
                  {services.map((s) => <th key={s} scope="col" className="px-2 py-2 text-right font-bold whitespace-nowrap">{s}</th>)}
                  <th scope="col" className="px-2 py-2 text-right font-bold">Kids</th>
                  <th scope="col" className="px-2 py-2 text-right font-bold">First timers</th>
                  <th scope="col" className="px-2 py-2 text-right font-bold">Serve Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {rows.map((r) => (
                  <tr key={r.date}>
                    <th scope="row" className="px-2 py-2 text-left font-bold text-slate-800 whitespace-nowrap">{day(r.date)}</th>
                    {services.map((s) => <td key={s} className="px-2 py-2 text-right text-slate-700">{r.byService[s] ?? 0}</td>)}
                    <td className="px-2 py-2 text-right font-black text-slate-900">{r.kids}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{r.firstTimers}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{r.serveTeam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}
