import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'
import { listAccess } from '@/app/lib/church'
import { loadNetworkOverview } from '@/app/lib/network-overview'
import Decor from '@/app/components/Decor'
import SignOutButton from '@/app/admin/SignOutButton'
import NetworkActions, { NewChurchForm } from './NetworkActions'

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

export default async function NetworkPage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/admin/login')
  if (!(await listAccess(user.id)).isNetworkAdmin) redirect('/admin/choose')

  const churches = await loadNetworkOverview()
  const active = churches.filter((c) => c.isActive)
  const totalLatest = active.reduce((n, c) => n + (c.latest?.checkIns ?? 0), 0)

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">🌏</span>Network overview</h1>
            <p className="text-sm text-slate-600">
              {active.length} active church{active.length === 1 ? '' : 'es'} · {totalLatest} kids and serve team at their latest session
            </p>
          </div>
          <SignOutButton className="min-h-11 shrink-0 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 disabled:opacity-60" />
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/admin/sessions/export?scope=network"
            download
            className="inline-flex min-h-11 items-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong"
          >
            Download all churches (CSV)
          </a>
          <Link href="/admin/choose" className="inline-flex min-h-11 items-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-brand transition hover:bg-blue-50">
            My churches
          </Link>
        </div>

        <div className="card divide-y divide-blue-50 overflow-hidden">
          {churches.length === 0 && <p className="px-6 py-8 text-center text-sm text-slate-600">No churches yet. Add the first one below.</p>}
          {churches.map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${c.isActive ? '' : 'bg-slate-50'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-800">
                  {c.name}
                  {!c.isActive && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">Off</span>}
                </p>
                <p className="text-sm text-slate-600">
                  /{c.slug} ·{' '}
                  {c.todayStarted ? (
                    <span className="font-bold text-green-700">Session open today</span>
                  ) : (
                    <span>No session today</span>
                  )}
                </p>
              </div>
              <dl className="grid grid-cols-4 gap-3 text-center tabular-nums">
                <div>
                  <dt className="text-xs font-bold text-slate-600">{c.latest ? shortDate(c.latest.date) : 'Latest'}</dt>
                  <dd className="text-lg font-black text-slate-800">{c.latest?.checkIns ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-600">First timers</dt>
                  <dd className="text-lg font-black text-slate-800">{c.latest?.firstTimers ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-600">Serve team</dt>
                  <dd className="text-lg font-black text-slate-800">{c.latest?.serveTeam ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-600">{c.previous ? shortDate(c.previous.date) : 'Before'}</dt>
                  <dd className="text-lg font-black text-slate-600">{c.previous?.checkIns ?? '—'}</dd>
                </div>
              </dl>
              <NetworkActions churchId={c.id} name={c.name} isActive={c.isActive} />
            </div>
          ))}
        </div>

        <NewChurchForm />
      </div>
    </main>
  )
}
