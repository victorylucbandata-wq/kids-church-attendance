'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AdminData } from '@/app/lib/types'
import { isBirthdayToday, isBirthdayThisWeek } from '@/app/lib/birthday'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import { requestJson } from '@/app/lib/api'
import SignOutButton from './SignOutButton'
import { inputClass } from '@/app/lib/ui'
import Decor from '@/app/components/Decor'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '👋',
    title: 'What this page is for',
    body: 'This is the leader page. Use it to open check-in for the day, watch who has arrived, and check kids out when parents pick them up.',
  },
  {
    emoji: '▶️',
    title: 'Start the session',
    body: 'Tap Generate to create today\'s session. Do this once at the start of the day. Parents can\'t check in until a session is active.',
  },
  {
    emoji: '📊',
    title: 'Watch the numbers',
    body: 'The summary cards show Checked In, Still Here, and Checked Out. Use the filter tabs (All / Still Here / Out) to quickly see who\'s still in the building.',
  },
  {
    emoji: '👋',
    title: 'Checking kids out',
    body: 'Tap "Check Out" next to a child\'s name when their parent picks them up. Use "Check Out All" at the end of service to mark everyone as picked up.',
  },
  {
    emoji: '🎂',
    title: 'Birthday highlights',
    body: 'Kids with birthdays today or this week are highlighted with a cake icon — both here and on the check-in screen so volunteers can greet them!',
  },
  {
    emoji: '🔒',
    title: 'When you\'re done',
    body: 'Tap Sign out on a shared device. You don\'t need to "close" the session — a new one is started next service day.',
  },
]


type Props = {
  initialData: (AdminData & { success: boolean }) | null
  initialError: string | null
}

export default function AdminDashboard({ initialData, initialError }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [error] = useState(initialError)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')
  const [showManualCheckIn, setShowManualCheckIn] = useState(false)
  const [manualMemberId, setManualMemberId] = useState('')
  const [manualServiceTimeId, setManualServiceTimeId] = useState(initialData?.serviceTimes[0]?.id ?? '')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null)
  const [bulkCheckingOut, setBulkCheckingOut] = useState(false)
  const [actionError, setActionError] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'here' | 'out'>('all')

  const sessionExists = !!data?.session

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data')
      const newData = await res.json()
      if (newData.success) setData(newData)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!sessionExists) return
    // Skip refreshes while the tab is hidden (e.g. a phone in a pocket), catch up on return.
    const tick = () => {
      if (document.visibilityState === 'visible') refreshData()
    }
    const interval = setInterval(tick, 20000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [sessionExists, refreshData])

  const handleGenerate = async () => {
    setGenerateMsg('')
    setIsGenerating(true)
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await res.json()
      if (!result.success) {
        setGenerateMsg(result.error ?? 'Failed to generate session.')
        return
      }
      setGenerateMsg(`Session generated! ${result.memberCount} members ready.`)
      await refreshData()
      router.refresh()
    } catch {
      setGenerateMsg('Something went wrong. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Sends an attendance change; returns true on success, otherwise shows the error inline.
  const sendAttendance = async (method: 'POST' | 'PATCH', body: object) => {
    setActionError('')
    const res = await requestJson('/api/admin/attendance', { method, body })
    if (!res.ok) {
      setActionError(res.error)
      return false
    }
    await refreshData()
    return true
  }

  const handleManualCheckIn = async () => {
    if (!manualMemberId || !data?.session) return
    setManualSubmitting(true)
    const ok = await sendAttendance('POST', {
      memberId: manualMemberId,
      sessionId: data.session.id,
      serviceTimeId: manualServiceTimeId,
    })
    setManualSubmitting(false)
    if (ok) {
      setManualMemberId('')
      setShowManualCheckIn(false)
    }
  }

  const handleCheckout = async (attendanceId: string) => {
    setCheckingOutId(attendanceId)
    await sendAttendance('PATCH', { attendanceId, checkedOut: true })
    setCheckingOutId(null)
  }

  const handleBulkCheckout = async () => {
    if (!data?.session) return
    if (!confirm(`Check out all ${data.summary.stillHere} kids still here? This can't be undone.`)) return
    setBulkCheckingOut(true)
    await sendAttendance('PATCH', { bulkCheckoutAll: true, sessionId: data.session.id })
    setBulkCheckingOut(false)
  }

  const formatTime = (ts: string | null) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  }

  const uncheckedMembers = data?.attendanceRows.filter(r => !r.checkedIn) ?? []

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">📋</span>{data?.church.name ?? 'Attendance Dashboard'}</h1>
            <p className="text-sm text-slate-600">
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              <Link href="/admin/choose" className="font-bold text-brand hover:underline">Switch church</Link>
            </p>
            {data?.email && (
              <p className="text-sm text-slate-600">
                Signed in as <span className="font-bold text-slate-800">{data.email}</span>
                {' · '}
                {data.role === 'lead' ? 'Lead' : data.role === 'volunteer' ? 'Volunteer' : 'Network admin (view only)'}
              </p>
            )}
          </div>
          <SignOutButton className="min-h-11 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 disabled:opacity-60" />
        </div>

        {data?.role === 'network' && (
          <div role="status" className="rounded-2xl border-2 border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-800">
            Network view: you can see this church&apos;s dashboard, but changes are made by its own leaders.
          </div>
        )}

        {/* Quick nav */}
        <nav aria-label="Admin sections" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Link href="/admin/members" className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-3 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">Members</Link>
          <Link href="/admin/age-groups" className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-3 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">Age Groups</Link>
          <Link href="/admin/service-times" className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-3 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">Service Times</Link>
          <Link href="/admin/sessions" className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-3 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">Past Sessions</Link>
          {data?.role === 'lead' && <Link href="/admin/team" className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-3 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">Team</Link>}
          {data?.church && <Link href={`/${data.church.slug}`} className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-3 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">Kiosk link</Link>}
        </nav>

        {/* Error state */}
        {actionError && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError('')} aria-label="Dismiss error" className="-m-2 min-h-11 min-w-11 text-red-800">
              ✕
            </button>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {/* Generate session card */}
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-black text-slate-800">Today&apos;s Session</h2>

          {sessionExists ? (
            <div className="rounded-2xl bg-green-50 border-2 border-green-100 px-4 py-3">
              <p className="font-black text-green-800">Session active</p>
              <p className="text-sm text-green-700 mt-1">
                Generated at {formatTime(data!.session!.generated_at)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">No session generated yet for today.</p>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full rounded-2xl bg-brand px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
              >
                {isGenerating ? 'Generating…' : 'Generate Session'}
              </button>
              {generateMsg && (
                <p role="status" className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-bold text-slate-700">
                  {generateMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary cards */}
        {data?.session && (
          <>
            {/* Main counts */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Checked In', value: data.summary.checkedIn, color: 'green' },
                { label: 'Still Here', value: data.summary.stillHere, color: 'blue' },
                { label: 'Checked Out', value: data.summary.checkedOut, color: 'slate' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-2xl border-2 ${
                  color === 'green' ? 'border-green-100 bg-green-50' :
                  color === 'blue' ? 'border-blue-100 bg-blue-50' :
                  'border-slate-200 bg-slate-50'
                } p-4 text-center`}>
                  <p className={`text-3xl font-black ${
                    color === 'green' ? 'text-green-700' :
                    color === 'blue' ? 'text-blue-700' :
                    'text-slate-600'
                  }`}>{value}</p>
                  <p className="text-xs font-bold text-slate-600 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-2 gap-3">
              {/* By Time Slot */}
              <div className="rounded-2xl border-2 border-blue-50 bg-white p-4">
                <p className="mb-2 text-sm font-bold text-slate-700">By Time Slot</p>
                {Object.entries(data.summary.byTimeSlot).length === 0 ? (
                  <p className="text-sm text-slate-500">—</p>
                ) : (
                  Object.entries(data.summary.byTimeSlot).map(([slot, count]) => (
                    <div key={slot} className="flex justify-between text-sm">
                      <span className="text-slate-600">{slot}</span>
                      <span className="font-black text-slate-800">{count}</span>
                    </div>
                  ))
                )}
              </div>

              {/* By Age Group */}
              <div className="rounded-2xl border-2 border-blue-50 bg-white p-4">
                <p className="mb-2 text-sm font-bold text-slate-700">By Age Group</p>
                {Object.entries(data.summary.byAgeGroup).length === 0 ? (
                  <p className="text-sm text-slate-500">—</p>
                ) : (
                  Object.entries(data.summary.byAgeGroup).map(([group, count]) => (
                    <div key={group} className="flex justify-between text-sm">
                      <span className="text-slate-600">{group}</span>
                      <span className="font-black text-slate-800">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Birthday celebrants */}
            {(() => {
              const birthdayToday = data.attendanceRows.filter(r => r.checkedIn && isBirthdayToday(r.birthday))
              const birthdayWeek = data.attendanceRows.filter(r => r.checkedIn && !isBirthdayToday(r.birthday) && isBirthdayThisWeek(r.birthday))
              if (birthdayToday.length === 0 && birthdayWeek.length === 0) return null
              return (
                <div className="rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-4 space-y-2">
                  <p className="text-sm font-bold text-yellow-800"><span aria-hidden="true">🎂 </span>Birthdays</p>
                  {birthdayToday.map(r => (
                    <p key={r.attendanceId} className="text-sm font-black text-yellow-800">
                      {r.memberName} — Birthday today!
                    </p>
                  ))}
                  {birthdayWeek.map(r => (
                    <p key={r.attendanceId} className="text-sm font-bold text-yellow-700">
                      {r.memberName} — Birthday this week
                    </p>
                  ))}
                </div>
              )
            })()}

            {/* First timers count */}
            {data.summary.firstTimersToday > 0 && (
              <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-4 text-center">
                <p className="text-2xl font-black text-brand">{data.summary.firstTimersToday}</p>
                <p className="text-xs font-bold text-slate-600 mt-1">First Timer{data.summary.firstTimersToday !== 1 ? 's' : ''} Today</p>
              </div>
            )}
          </>
        )}

        {/* Manual check-in */}
        {data?.session && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-800">Manual Check-In</h2>
              <button
                onClick={() => setShowManualCheckIn(!showManualCheckIn)}
                aria-expanded={showManualCheckIn}
                className="min-h-11 rounded-xl border-2 border-blue-100 px-4 py-2 text-sm font-black text-brand hover:bg-blue-50"
              >
                {showManualCheckIn ? 'Close' : 'Open'}
              </button>
            </div>
            {showManualCheckIn && (
              <div className="space-y-3">
                <label htmlFor="manual-member" className="block text-sm font-bold text-slate-700">Member</label>
                <select
                  id="manual-member"
                  value={manualMemberId}
                  onChange={e => setManualMemberId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select member…</option>
                  {uncheckedMembers.map(m => (
                    <option key={m.attendanceId} value={m.attendanceId}>
                      {m.memberName} ({m.ageGroup})
                    </option>
                  ))}
                </select>
                <label htmlFor="manual-slot" className="block text-sm font-bold text-slate-700">Time slot</label>
                <select
                  id="manual-slot"
                  value={manualServiceTimeId}
                  onChange={e => setManualServiceTimeId(e.target.value)}
                  className={inputClass}
                >
                  {(data?.serviceTimes ?? []).map(ts => (
                    <option key={ts.id} value={ts.id}>{ts.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleManualCheckIn}
                  disabled={!manualMemberId || manualSubmitting}
                  className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
                >
                  {manualSubmitting ? 'Checking in…' : 'Check In'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Attendance table */}
        {data?.session && data.attendanceRows.filter(r => r.checkedIn).length > 0 && (() => {
          const checkedInRows = data.attendanceRows.filter(r => r.checkedIn)
          const filtered = attendanceFilter === 'here'
            ? checkedInRows.filter(r => !r.checkedOutAt)
            : attendanceFilter === 'out'
            ? checkedInRows.filter(r => r.checkedOutAt)
            : checkedInRows

          return (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-800">Attendance</h2>
                {data.summary.stillHere > 0 && (
                  <button
                    onClick={handleBulkCheckout}
                    disabled={bulkCheckingOut}
                    className="min-h-11 rounded-xl border-2 border-red-200 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {bulkCheckingOut ? 'Checking out…' : 'Check Out All'}
                  </button>
                )}
              </div>

              {/* Filter tabs */}
              <div role="group" aria-label="Filter attendance" className="flex gap-1 mb-4 rounded-2xl bg-slate-100 p-1">
                {([
                  { key: 'all' as const, label: `All (${checkedInRows.length})` },
                  { key: 'here' as const, label: `Still Here (${data.summary.stillHere})` },
                  { key: 'out' as const, label: `Out (${data.summary.checkedOut})` },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setAttendanceFilter(tab.key)}
                    aria-pressed={attendanceFilter === tab.key}
                    className={`min-h-11 flex-1 rounded-xl px-2 py-2 text-xs font-black transition ${
                      attendanceFilter === tab.key
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-slate-500 py-4">No members in this view.</p>
                )}
                {filtered.map(row => {
                  const bdayToday = isBirthdayToday(row.birthday)
                  const bdayWeek = !bdayToday && isBirthdayThisWeek(row.birthday)
                  return (
                  <div
                    key={row.attendanceId}
                    className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                      row.checkedOutAt
                        ? 'border-slate-100 bg-slate-50/50'
                        : bdayToday
                        ? 'border-yellow-300 bg-yellow-50'
                        : bdayWeek
                        ? 'border-yellow-200 bg-yellow-50/50'
                        : 'border-blue-50 bg-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-black text-sm truncate ${row.checkedOutAt ? 'text-slate-500' : 'text-slate-800'}`}>
                        {(bdayToday || bdayWeek) && <span aria-hidden="true" className="mr-1">🎂</span>}
                        {row.memberName}
                        {row.role === 'volunteer' && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-brand">Serve</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                        {row.ageGroup && <span>{row.ageGroup} · </span>}
                        <span className="font-bold">{row.timeSlot ?? '—'}</span>
                        {' · In '}{formatTime(row.checkedInAt)}
                        {row.checkedOutAt && <span> · Out {formatTime(row.checkedOutAt)}</span>}
                      </p>
                    </div>
                    {row.checkedOutAt ? (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                        Out
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCheckout(row.attendanceId)}
                        disabled={checkingOutId === row.attendanceId}
                        className="min-h-11 shrink-0 rounded-xl bg-orange-50 border-2 border-orange-200 px-3 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 disabled:opacity-60 transition"
                      >
                        {checkingOutId === row.attendanceId ? 'Saving…' : 'Check Out'}
                      </button>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* First timers */}
        {data?.firstTimers && data.firstTimers.length > 0 && (
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-black text-slate-800">
              First Timers
              <span className="ml-2 rounded-full bg-brand px-2.5 py-0.5 text-sm text-white">
                {data.firstTimers.length}
              </span>
            </h2>
            <div className="space-y-3">
              {data.firstTimers.map((ft, i) => (
                <div key={i} className="rounded-2xl border-2 border-blue-50 bg-blue-50/50 p-4">
                  <p className="font-black text-slate-800">
                    {ft.childNickname
                      ? `${ft.childNickname} (${ft.childLastName}, ${ft.childFirstName})`
                      : `${ft.childFirstName} ${ft.childLastName}`}
                  </p>
                  <p className="text-sm text-slate-600">{ft.ageGroup}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Parent: {ft.parentName} · {ft.contactNumber}
                  </p>
                  {ft.notes && (
                    <p className="text-sm text-slate-500 mt-1">Notes: {ft.notes}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{formatTime(ft.submittedAt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No session, no data */}
        {!data?.session && !error && (
          <p className="text-center text-sm text-slate-500 py-4">
            Generate a session above to start tracking attendance.
          </p>
        )}

        <div className="text-center">
          <Link href="/" className="inline-block px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900">
            ← Back to Check-In
          </Link>
        </div>
      </div>

      <HelpWizard title="Admin guide" steps={HELP_STEPS} />
    </main>
  )
}
