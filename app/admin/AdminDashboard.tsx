'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AdminData } from '@/app/lib/types'
import { isBirthdayToday, isBirthdayThisWeek } from '@/app/lib/birthday'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

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
    body: 'Tap Logout to secure the page. You don\'t need to "close" the session — a new one is started next service day.',
  },
]

const TIME_SLOTS = ['9am', '11am', 'Special']

type Props = {
  initialData: (AdminData & { success: boolean }) | null
  initialError: string | null
}

export default function AdminDashboard({ initialData, initialError }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(initialError)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showManualCheckIn, setShowManualCheckIn] = useState(false)
  const [manualMemberId, setManualMemberId] = useState('')
  const [manualTimeSlot, setManualTimeSlot] = useState('9am')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null)
  const [bulkCheckingOut, setBulkCheckingOut] = useState(false)
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
    const interval = setInterval(refreshData, 20000)
    return () => clearInterval(interval)
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

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.push('/admin/login')
    }
  }

  const handleManualCheckIn = async () => {
    if (!manualMemberId || !data?.session) return
    setManualSubmitting(true)
    const res = await fetch('/api/admin/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: manualMemberId,
        sessionId: data.session.id,
        timeSlot: manualTimeSlot,
      }),
    })
    const result = await res.json()
    setManualSubmitting(false)
    if (result.success) {
      setManualMemberId('')
      setShowManualCheckIn(false)
      await refreshData()
    } else {
      alert(result.error)
    }
  }

  const handleCheckout = async (attendanceId: string) => {
    setCheckingOutId(attendanceId)
    const res = await fetch('/api/admin/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId, checkedOut: true }),
    })
    const result = await res.json()
    setCheckingOutId(null)
    if (result.success) {
      await refreshData()
    } else {
      alert(result.error)
    }
  }

  const handleBulkCheckout = async () => {
    if (!data?.session) return
    if (!confirm('Check out all remaining kids? This cannot be undone.')) return
    setBulkCheckingOut(true)
    const res = await fetch('/api/admin/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkCheckoutAll: true, sessionId: data.session.id }),
    })
    const result = await res.json()
    setBulkCheckingOut(false)
    if (result.success) {
      await refreshData()
    } else {
      alert(result.error)
    }
  }

  const formatTime = (ts: string | null) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  }

  const uncheckedMembers = data?.attendanceRows.filter(r => !r.checkedIn) ?? []

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#227EEE]">Admin</p>
            <h1 className="text-2xl font-black text-slate-900">Attendance Dashboard</h1>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-500 transition hover:border-slate-300 disabled:opacity-60"
          >
            {isLoggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </div>

        {/* Quick nav */}
        <div className="flex gap-2">
          <a href="/admin/members" className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
            Members
          </a>
          <a href="/admin/age-groups" className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
            Age Groups
          </a>
          <a href="/admin/sessions" className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
            Past Sessions
          </a>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {/* Generate session card */}
        <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/50">
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
                className="w-full rounded-2xl bg-[#227EEE] px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:brightness-95 disabled:opacity-60"
              >
                {isGenerating ? 'Generating…' : 'Generate Session'}
              </button>
              {generateMsg && (
                <p className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-bold text-slate-700">
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
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">By Time Slot</p>
                {Object.entries(data.summary.byTimeSlot).length === 0 ? (
                  <p className="text-sm text-slate-300">—</p>
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
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">By Age Group</p>
                {Object.entries(data.summary.byAgeGroup).length === 0 ? (
                  <p className="text-sm text-slate-300">—</p>
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
                  <p className="text-xs font-bold uppercase tracking-wide text-yellow-600">🎂 Birthdays</p>
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
              <div className="rounded-2xl border-2 border-purple-100 bg-purple-50 p-4 text-center">
                <p className="text-2xl font-black text-purple-700">{data.summary.firstTimersToday}</p>
                <p className="text-xs font-bold text-slate-600 mt-1">First Timer{data.summary.firstTimersToday !== 1 ? 's' : ''} Today</p>
              </div>
            )}
          </>
        )}

        {/* Manual check-in */}
        {data?.session && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-800">Manual Check-In</h2>
              <button
                onClick={() => setShowManualCheckIn(!showManualCheckIn)}
                className="rounded-xl border-2 border-blue-100 px-3 py-1.5 text-xs font-black text-[#227EEE] hover:bg-blue-50"
              >
                {showManualCheckIn ? 'Close' : 'Open'}
              </button>
            </div>
            {showManualCheckIn && (
              <div className="space-y-3">
                <select
                  value={manualMemberId}
                  onChange={e => setManualMemberId(e.target.value)}
                  className="w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#227EEE]"
                >
                  <option value="">Select member…</option>
                  {uncheckedMembers.map(m => (
                    <option key={m.attendanceId} value={m.attendanceId}>
                      {m.memberName} ({m.ageGroup})
                    </option>
                  ))}
                </select>
                <select
                  value={manualTimeSlot}
                  onChange={e => setManualTimeSlot(e.target.value)}
                  className="w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#227EEE]"
                >
                  {TIME_SLOTS.map(ts => (
                    <option key={ts} value={ts}>{ts}</option>
                  ))}
                </select>
                <button
                  onClick={handleManualCheckIn}
                  disabled={!manualMemberId || manualSubmitting}
                  className="w-full rounded-2xl bg-[#227EEE] px-4 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:brightness-95 disabled:opacity-60"
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
            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-800">Attendance</h2>
                {data.summary.stillHere > 0 && (
                  <button
                    onClick={handleBulkCheckout}
                    disabled={bulkCheckingOut}
                    className="rounded-xl border-2 border-red-200 px-3 py-1.5 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    {bulkCheckingOut ? 'Checking out…' : 'Check Out All'}
                  </button>
                )}
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 mb-4 rounded-2xl bg-slate-100 p-1">
                {([
                  { key: 'all' as const, label: `All (${checkedInRows.length})` },
                  { key: 'here' as const, label: `Still Here (${data.summary.stillHere})` },
                  { key: 'out' as const, label: `Out (${data.summary.checkedOut})` },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setAttendanceFilter(tab.key)}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition ${
                      attendanceFilter === tab.key
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-4">No members in this view.</p>
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
                      <p className={`font-black text-sm truncate ${row.checkedOutAt ? 'text-slate-400' : 'text-slate-800'}`}>
                        {(bdayToday || bdayWeek) && <span className="mr-1">🎂</span>}
                        {row.memberName}
                        {row.role === 'volunteer' && (
                          <span className="ml-1 text-xs text-purple-500 font-bold">V</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {row.ageGroup && <span>{row.ageGroup} · </span>}
                        <span className="font-bold">{row.timeSlot}</span>
                        {' · In '}{formatTime(row.checkedInAt)}
                        {row.checkedOutAt && <span> · Out {formatTime(row.checkedOutAt)}</span>}
                      </p>
                    </div>
                    {row.checkedOutAt ? (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-500">
                        Out
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCheckout(row.attendanceId)}
                        disabled={checkingOutId === row.attendanceId}
                        className="shrink-0 rounded-xl bg-orange-50 border-2 border-orange-200 px-3 py-1.5 text-xs font-black text-orange-700 hover:bg-orange-100 disabled:opacity-60 transition"
                      >
                        {checkingOutId === row.attendanceId ? '…' : 'Check Out'}
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
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/50">
            <h2 className="mb-4 text-lg font-black text-slate-800">
              First Timers
              <span className="ml-2 rounded-full bg-[#227EEE] px-2.5 py-0.5 text-sm text-white">
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
                  <p className="text-xs text-slate-400 mt-1">{formatTime(ft.submittedAt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No session, no data */}
        {!data?.session && !error && (
          <p className="text-center text-sm text-slate-400 py-4">
            Generate a session above to start tracking attendance.
          </p>
        )}

        <div className="text-center">
          <a href="/" className="text-sm font-bold text-slate-400 hover:text-slate-600">
            ← Back to Check-In
          </a>
        </div>
      </div>

      <HelpWizard title="Admin guide" steps={HELP_STEPS} />
    </main>
  )
}
