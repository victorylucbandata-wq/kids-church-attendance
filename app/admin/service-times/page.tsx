'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import Decor from '@/app/components/Decor'
import Notice from '@/app/components/Notice'
import { inputClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import { CLOSES_AFTER, OPENS_BEFORE, formatMinutes, startMinutes } from '@/app/lib/service-clock'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '🕘',
    title: 'Service times',
    body: 'These are the times parents choose from when they check in, like 9:00 AM or Special Event. Each church sets its own.',
  },
  {
    emoji: '⏰',
    title: 'Sundays open by themselves',
    body: 'On Sundays, a time named like 9:00 AM opens check-in 30 minutes before and closes it 90 minutes after, with no need to tap Start. A time without a clock time, like Special Event, opens when a lead taps Start Session, as do all times on other days.',
  },
  {
    emoji: '↕️',
    title: 'Order and names',
    body: 'Use the arrows to set the order parents see. Tap Edit to rename a time. Past check-ins keep showing the new name.',
  },
  {
    emoji: '🙈',
    title: 'Removing a time',
    body: 'A time nobody has used yet is deleted. A time with past check-ins is hidden instead, so old attendance still shows it. You can bring it back later.',
  },
]

type ServiceTime = { id: string; label: string; sort_order: number; is_active: boolean }

const fetchTimes = () => requestJson<{ serviceTimes: ServiceTime[] }>('/api/admin/service-times')

// What the Sunday clock does with this time, so a lead can see it understood the name.
function clockNote(label: string): string {
  const start = startMinutes(label)
  return start === null
    ? 'Opens when a lead taps Start Session'
    : `Sundays: opens ${formatMinutes(start - OPENS_BEFORE)}, closes ${formatMinutes(start + CLOSES_AFTER)}`
}

const smallButton = 'min-h-11 min-w-11 rounded-lg px-2 text-base text-slate-600 hover:bg-blue-50 disabled:opacity-20'

export default function ServiceTimesPage() {
  const [times, setTimes] = useState<ServiceTime[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const flash = (kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text })
    if (kind === 'success') setTimeout(() => setNotice(null), 3000)
  }

  const load = async () => {
    const res = await fetchTimes()
    if (res.ok) setTimes(res.data.serviceTimes)
    else flash('error', `Couldn't load service times. ${res.error}`)
    setLoading(false)
  }

  useEffect(() => {
    fetchTimes().then((res) => {
      if (res.ok) setTimes(res.data.serviceTimes)
      else setNotice({ kind: 'error', text: `Couldn't load service times. ${res.error}` })
      setLoading(false)
    })
  }, [])

  const mutate = async (url: string, method: string, body: unknown, success: string) => {
    setBusy(true)
    setNotice(null)
    const res = await requestJson<{ hidden?: boolean }>(url, { method, body })
    setBusy(false)
    if (!res.ok) {
      flash('error', res.error)
      return false
    }
    await load()
    flash('success', method === 'DELETE' && res.data.hidden ? `${success} It was used before, so it's hidden rather than deleted.` : success)
    return true
  }

  const active = times.filter((t) => t.is_active)
  const hidden = times.filter((t) => !t.is_active)

  const move = async (index: number, delta: number) => {
    const a = active[index]
    const b = active[index + delta]
    if (!a || !b) return
    setBusy(true)
    const results = await Promise.all([
      requestJson(`/api/admin/service-times/${a.id}`, { method: 'PUT', body: { sort_order: b.sort_order } }),
      requestJson(`/api/admin/service-times/${b.id}`, { method: 'PUT', body: { sort_order: a.sort_order } }),
    ])
    setBusy(false)
    const failed = results.find((r) => !r.ok)
    if (failed && !failed.ok) flash('error', `Couldn't reorder. ${failed.error}`)
    await load()
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">
        <div className="flex gap-2">
          <Link href="/admin" className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">
            ← Dashboard
          </Link>
          <Link href="/admin/age-groups" className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">
            Age Groups
          </Link>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">🕘</span>Service Times</h1>
        </div>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <div className="card space-y-3 p-4">
          <label htmlFor="new-service-time" className="block text-sm font-bold text-slate-700">Add a service time</label>
          <div className="flex gap-2">
            <input
              id="new-service-time"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newLabel.trim() && (await mutate('/api/admin/service-times', 'POST', { label: newLabel }, `Added “${newLabel.trim()}”.`))) setNewLabel('')
              }}
              placeholder="e.g. 4:00 PM"
              maxLength={40}
              className={inputClass}
            />
            <button
              onClick={async () => {
                if (await mutate('/api/admin/service-times', 'POST', { label: newLabel }, `Added “${newLabel.trim()}”.`)) setNewLabel('')
              }}
              disabled={!newLabel.trim() || busy}
              className="whitespace-nowrap rounded-2xl bg-brand px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        <div className="card space-y-2 p-4">
          {loading && <p role="status" className="py-4 text-center text-sm text-slate-600">Loading…</p>}
          {!loading && active.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-600">No service times yet. Parents can&apos;t check in until you add one.</p>
          )}
          {active.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2 rounded-2xl border-2 border-blue-50 bg-white px-4 py-3">
              {editingId === t.id ? (
                <>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && (await mutate(`/api/admin/service-times/${t.id}`, 'PUT', { label: editLabel }, `Renamed to “${editLabel.trim()}”.`))) setEditingId(null)
                    }}
                    aria-label="Service time name"
                    maxLength={40}
                    className="min-w-0 flex-1 rounded-xl border-2 border-blue-200 px-3 py-2 text-base outline-none focus:border-brand"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (await mutate(`/api/admin/service-times/${t.id}`, 'PUT', { label: editLabel }, `Renamed to “${editLabel.trim()}”.`)) setEditingId(null)
                    }}
                    className="min-h-11 px-2 text-sm font-bold text-brand"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="min-h-11 px-2 text-sm font-bold text-slate-600">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1">
                    <span className="block text-sm font-black text-slate-800">{t.label}</span>
                    <span className="block text-xs text-slate-600">{clockNote(t.label)}</span>
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label={`Move ${t.label} up`} className={smallButton}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === active.length - 1 || busy} aria-label={`Move ${t.label} down`} className={smallButton}>↓</button>
                    <button
                      onClick={() => { setEditingId(t.id); setEditLabel(t.label) }}
                      className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove “${t.label}” from the check-in choices?`)) mutate(`/api/admin/service-times/${t.id}`, 'DELETE', undefined, `Removed “${t.label}”.`)
                      }}
                      disabled={busy}
                      className="min-h-11 rounded-lg px-3 text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {hidden.length > 0 && (
          <div className="card space-y-2 p-4">
            <p className="text-sm font-bold text-slate-700">Hidden (kept for past attendance)</p>
            {hidden.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-2">
                <span className="text-sm text-slate-600">{t.label}</span>
                <button
                  onClick={() => mutate(`/api/admin/service-times/${t.id}`, 'PUT', { is_active: true }, `“${t.label}” is back.`)}
                  disabled={busy}
                  className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand hover:bg-blue-50"
                >
                  Show again
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <HelpWizard title="Service times guide" steps={HELP_STEPS} />
    </main>
  )
}
