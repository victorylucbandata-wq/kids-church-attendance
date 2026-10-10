'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import Decor from '@/app/components/Decor'
import Notice from '@/app/components/Notice'
import { inputClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import { nextSundayInManila } from '@/app/lib/dates'
import { SERVE_ROLES } from '@/app/lib/serve-roles'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '🙌',
    title: 'Plan who serves',
    body: 'Pick the Sunday with the arrows, or tap the date. Choose the service, then pick someone for each role. Leave a role on "Pick someone" if nobody is doing it.',
  },
  {
    emoji: '➕',
    title: 'More than one person',
    body: 'Tap "+ another" under a role, like Music Team, to add a second person. Choose "Nobody" in a list to take someone off.',
  },
  {
    emoji: '✅',
    title: 'On the day',
    body: 'The team lead checks each person in from the Serve Team card on the Today tab. A tick and the time show here too.',
  },
]

type Entry = { id: string; serviceTimeId: string; memberId: string; serveRole: string; checkedInAt: string | null }
type RosterData = {
  serviceTimes: { id: string; label: string }[]
  volunteers: { id: string; name: string }[]
  roster: Entry[]
}

const fetchRoster = (date: string) => requestJson<RosterData>(`/api/admin/roster?date=${date}`)

// Phones show a date field in their own format; leaders read dates as mm/dd/yyyy.
const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`
const weekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' })
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}
const time = (ts: string) => new Date(ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

// "Team Leader (& Tithes and Offering)" → the name in bold, the extra duty quieter.
const roleParts = (role: string) => {
  const i = role.indexOf(' (')
  return i < 0 ? [role, ''] : [role.slice(0, i), role.slice(i + 1)]
}

const arrowButton = 'min-h-11 min-w-11 shrink-0 rounded-2xl border-2 border-blue-100 bg-white text-lg font-black text-brand hover:bg-blue-50'

export default function RosterPage() {
  const [date, setDate] = useState(nextSundayInManila)
  const [data, setData] = useState<RosterData | null>(null)
  const [serviceId, setServiceId] = useState('')
  const [extra, setExtra] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const show = (res: Awaited<ReturnType<typeof fetchRoster>>) => {
    if (res.ok) setData(res.data)
    else setNotice({ kind: 'error', text: `Couldn't load the roster. ${res.error}` })
  }
  const load = async () => show(await fetchRoster(date))

  useEffect(() => {
    fetchRoster(date).then(show)
  }, [date])

  const send = async (method: 'POST' | 'DELETE', body: object) => {
    const res = await requestJson('/api/admin/roster', { method, body })
    if (!res.ok) setNotice({ kind: 'error', text: res.error })
    return res.ok
  }

  const service = data?.serviceTimes.find((s) => s.id === serviceId) ?? data?.serviceTimes[0]
  const here = (data?.roster ?? []).filter((e) => e.serviceTimeId === service?.id)
  const onService = new Set(here.map((e) => e.memberId))
  const nameOf = (memberId: string) => data?.volunteers.find((v) => v.id === memberId)?.name ?? 'Former Serve Team member'

  // Someone picked for a role. Replacing a person adds the new one first, so a refusal leaves the old one in place.
  const pick = async (role: string, memberId: string, current?: Entry) => {
    if (!service || memberId === (current?.memberId ?? '')) return
    setBusy(true)
    setNotice(null)
    let ok = true
    if (memberId) ok = await send('POST', { date, serviceTimeId: service.id, memberId, serveRole: role })
    if (ok && current) ok = await send('DELETE', { id: current.id })
    if (ok && !current) setExtra((x) => ({ ...x, [role]: 0 }))
    await load()
    setBusy(false)
  }

  // Everyone on the Serve Team who isn't already serving at this service, plus whoever holds this slot.
  const options = (current?: Entry) => (data?.volunteers ?? []).filter((v) => v.id === current?.memberId || !onService.has(v.id))

  const slot = (role: string, current: Entry | undefined, key: string) => (
    <div key={key} className="flex items-center gap-2">
      <select
        aria-label={`${role} at ${service?.label}`}
        value={current?.memberId ?? ''}
        onChange={(e) => pick(role, e.target.value, current)}
        disabled={busy}
        className={current ? inputClass : inputClass.replace('text-slate-800', 'text-slate-600')}
      >
        <option value="">{current ? 'Nobody' : 'Pick someone…'}</option>
        {options(current).map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
      {current?.checkedInAt && <span className="shrink-0 text-xs font-bold text-green-700">✓ In {time(current.checkedInAt)}</span>}
    </div>
  )

  const others = here.filter((e) => !SERVE_ROLES.includes(e.serveRole))

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">🙌</span>Roster</h1>
          <p className="text-sm text-slate-600">Who&apos;s serving in each role.</p>
        </div>

        <div className="card space-y-3 p-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDate((d) => addDays(d, -7))} aria-label="Previous Sunday" className={arrowButton}>◀</button>
            {/* The native picker opens on tap; its own text is hidden under the mm/dd/yyyy label. */}
            <label className="relative block flex-1">
              <span className="sr-only">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`${inputClass.replace('text-slate-800', 'text-transparent')} cursor-pointer`}
              />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base font-bold text-slate-900">
                {mdy(date)} · {weekday(date)}
              </span>
            </label>
            <button type="button" onClick={() => setDate((d) => addDays(d, 7))} aria-label="Next Sunday" className={arrowButton}>▶</button>
          </div>

          {data && data.serviceTimes.length > 1 && (
            <div role="group" aria-label="Service" className="grid auto-cols-fr grid-flow-col gap-2">
              {data.serviceTimes.map((st) => {
                const active = st.id === service?.id
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setServiceId(st.id)}
                    aria-pressed={active}
                    className={`min-h-11 rounded-2xl px-2 py-1.5 text-sm font-black transition ${active ? 'bg-brand text-white shadow-md shadow-blue-200' : 'border-2 border-blue-100 bg-white text-slate-700 hover:bg-blue-50'}`}
                  >
                    {st.label}
                    <span className="block text-xs font-bold opacity-80">
                      {data.roster.filter((e) => e.serviceTimeId === st.id).length} serving
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

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

        {data && service && data.volunteers.length > 0 && (
          <section className="card divide-y-2 divide-blue-50 px-4" aria-label={`Roles at ${service.label}`}>
            {SERVE_ROLES.map((role) => {
              const [name, duty] = roleParts(role)
              const people = here.filter((e) => e.serveRole === role)
              const empties = (people.length ? 0 : 1) + (extra[role] ?? 0)
              return (
                <div key={role} className="space-y-2 py-3">
                  <p className="text-sm font-black text-slate-800">
                    {name}
                    {duty && <span className="ml-1 font-bold text-slate-600">{duty}</span>}
                  </p>
                  {people.map((e) => slot(role, e, e.id))}
                  {Array.from({ length: empties }, (_, i) => slot(role, undefined, `${role}-empty-${i}`))}
                  {people.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExtra((x) => ({ ...x, [role]: (x[role] ?? 0) + 1 }))}
                      className="min-h-11 text-sm font-bold text-brand hover:underline"
                    >
                      + another
                    </button>
                  )}
                </div>
              )
            })}

            {others.length > 0 && (
              <div className="space-y-2 py-3">
                <p className="text-sm font-black text-slate-800">Other roles</p>
                {others.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-sm text-slate-800">
                      <span className="font-bold">{nameOf(e.memberId)}</span> · {e.serveRole || 'No role'}
                    </span>
                    <button
                      type="button"
                      onClick={() => pick(e.serveRole, '', e)}
                      disabled={busy}
                      aria-label={`Remove ${nameOf(e.memberId)}`}
                      className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <HelpWizard title="Roster guide" steps={HELP_STEPS} />
    </main>
  )
}
