'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import Decor from '@/app/components/Decor'
import Notice from '@/app/components/Notice'
import { inputClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import { nextSundayInManila } from '@/app/lib/dates'
import { SERVE_ROLES, byServeRole } from '@/app/lib/serve-roles'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '🙌',
    title: 'Plan who serves',
    body: 'Pick the Sunday, then add Serve Team members to each service with their role, like Registration or Games. Each service has its own list.',
  },
  {
    emoji: '👆',
    title: 'Checking in',
    body: 'On the day, the team lead checks each person in from the Serve Team card on the Today tab. The kiosk is for kids only.',
  },
  {
    emoji: '✅',
    title: 'Who has arrived',
    body: 'On the day itself, a tick and the time show next to everyone who has been checked in. The Today tab shows the same.',
  },
]

type Entry = { id: string; serviceTimeId: string; memberId: string; serveRole: string; checkedInAt: string | null }
type RosterData = {
  serviceTimes: { id: string; label: string }[]
  volunteers: { id: string; name: string }[]
  roster: Entry[]
  roles: string[]
}

const fetchRoster = (date: string) => requestJson<RosterData>(`/api/admin/roster?date=${date}`)

// Phones show a date field in their own format; leaders read dates as mm/dd/yyyy.
const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`
const weekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long' })

const time = (ts: string) => new Date(ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

export default function RosterPage() {
  const [date, setDate] = useState(nextSundayInManila)
  const [data, setData] = useState<RosterData | null>(null)
  const [busy, setBusy] = useState(false)
  const [picks, setPicks] = useState<Record<string, { memberId: string; serveRole: string }>>({})
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const show = (res: Awaited<ReturnType<typeof fetchRoster>>) => {
    if (res.ok) setData(res.data)
    else setNotice({ kind: 'error', text: `Couldn't load the roster. ${res.error}` })
  }
  const load = async () => show(await fetchRoster(date))

  useEffect(() => {
    fetchRoster(date).then(show)
  }, [date])

  const change = async (method: 'POST' | 'DELETE', body: object) => {
    setBusy(true)
    setNotice(null)
    const res = await requestJson('/api/admin/roster', { method, body })
    setBusy(false)
    if (!res.ok) {
      setNotice({ kind: 'error', text: res.error })
      return false
    }
    await load()
    return true
  }

  const nameOf = (memberId: string) => data?.volunteers.find((v) => v.id === memberId)?.name ?? 'Former Serve Team member'

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">🙌</span>Roster</h1>
          <p className="text-sm text-slate-600">Who&apos;s serving at each service.</p>
        </div>

        <label className="card block p-4">
          <span className="mb-1.5 block text-sm font-bold text-slate-700">Sunday</span>
          {/* The native picker opens on tap; its own text is hidden under the mm/dd/yyyy label. */}
          <span className="relative block">
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className={`${inputClass.replace('text-slate-800', 'text-transparent')} cursor-pointer`}
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-slate-900">
              {mdy(date)} · {weekday(date)}
            </span>
          </span>
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        {!data && <p role="status" className="py-4 text-center text-sm text-slate-600">Loading…</p>}

        {data && data.volunteers.length === 0 && (
          <div className="card p-6 text-center">
            <p className="font-black text-slate-800">No Serve Team members yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Add them under <Link href="/admin/members" className="font-bold text-brand hover:underline">Members</Link> with the role Serve Team.
            </p>
          </div>
        )}

        <datalist id="serve-roles">
          {[...SERVE_ROLES, ...(data?.roles ?? []).filter((r) => !SERVE_ROLES.includes(r))].map((r) => <option key={r} value={r} />)}
        </datalist>

        {data && data.volunteers.length > 0 && data.serviceTimes.map((st) => {
          const entries = data.roster.filter((r) => r.serviceTimeId === st.id).sort(byServeRole)
          const onIt = new Set(entries.map((e) => e.memberId))
          const pick = picks[st.id] ?? { memberId: '', serveRole: '' }
          const setPick = (p: Partial<typeof pick>) => setPicks((all) => ({ ...all, [st.id]: { ...pick, ...p } }))
          return (
            <section key={st.id} className="card space-y-3 p-4" aria-labelledby={`st-${st.id}`}>
              <h2 id={`st-${st.id}`} className="text-lg font-black text-slate-800">
                {st.label}
                <span className="ml-2 text-sm font-bold text-slate-600">{entries.length} serving</span>
              </h2>

              {entries.length === 0 && <p className="text-sm text-slate-600">Nobody yet.</p>}
              {entries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-2xl border-2 border-blue-50 bg-white px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-800">{nameOf(e.memberId)}</span>
                    <span className="block text-xs text-slate-600">
                      {e.serveRole || 'No role set'}
                      {e.checkedInAt && <span className="font-bold text-green-700"> · ✓ In {time(e.checkedInAt)}</span>}
                    </span>
                  </span>
                  <button
                    onClick={() => change('DELETE', { id: e.id })}
                    disabled={busy}
                    aria-label={`Remove ${nameOf(e.memberId)} from ${st.label}`}
                    className="min-h-11 rounded-lg px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="space-y-2 border-t-2 border-blue-50 pt-3">
                <select
                  aria-label={`Person to add to ${st.label}`}
                  value={pick.memberId}
                  onChange={(e) => setPick({ memberId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Add someone…</option>
                  {data.volunteers.filter((v) => !onIt.has(v.id)).map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    aria-label={`Role at ${st.label}`}
                    list="serve-roles"
                    value={pick.serveRole}
                    onChange={(e) => setPick({ serveRole: e.target.value })}
                    placeholder="Role, e.g. Games"
                    maxLength={40}
                    className={inputClass}
                  />
                  <button
                    onClick={async () => {
                      if (await change('POST', { date, serviceTimeId: st.id, ...pick })) setPicks((all) => ({ ...all, [st.id]: { memberId: '', serveRole: '' } }))
                    }}
                    disabled={!pick.memberId || busy}
                    className="whitespace-nowrap rounded-2xl bg-brand px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <HelpWizard title="Roster guide" steps={HELP_STEPS} />
    </main>
  )
}
