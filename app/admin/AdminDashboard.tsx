'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminData } from '@/app/lib/types'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

const SCHEDULES = ['Sunday Morning', 'Sunday Afternoon', 'Special Event']

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '👋',
    title: 'What this page is for',
    body: 'This is the leader page. Use it to open check-in for the day and watch who has arrived. Parents can\'t check anyone in until you start a session here.',
  },
  {
    emoji: '▶️',
    title: 'Step 1 — Start the session',
    body: 'Under "Today\'s Session", pick the service (e.g. Sunday Morning) and tap Generate. This builds today\'s list from all active members. Do this once at the start of the day.',
  },
  {
    emoji: '📊',
    title: 'Step 2 — Watch the numbers',
    body: 'The three cards show Total Members, Checked In, and Not Yet In. They update each time you reload the page.',
  },
  {
    emoji: '🧒',
    title: 'Step 3 — Check the lists',
    body: 'The Member Attendance table shows who\'s in and at what time. First Timers shows new kids registered today, with parent contact and any allergy notes.',
  },
  {
    emoji: '🔒',
    title: 'When you\'re done',
    body: 'Tap Logout to secure the page. You don\'t need to "close" the session — a new one is started next service day.',
  },
]

type Props = {
  initialData: (AdminData & { success: boolean }) | null
  initialError: string | null
}

export default function AdminDashboard({ initialData, initialError }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(initialError)
  const [schedule, setSchedule] = useState('Sunday Morning')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const sessionExists = !!data?.session

  const handleGenerate = async () => {
    setGenerateMsg('')
    setIsGenerating(true)
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      })
      const result = await res.json()
      if (!result.success) {
        setGenerateMsg(result.error ?? 'Failed to generate session.')
        return
      }
      setGenerateMsg(`Session generated! ${result.memberCount} members added.`)
      router.refresh()

      // Re-fetch dashboard data
      const dataRes = await fetch('/api/admin/data')
      const newData = await dataRes.json()
      if (newData.success) setData(newData)
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

  const formatTime = (ts: string | null) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  }

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
              <p className="font-black text-green-800">Session active: {data!.session!.schedule}</p>
              <p className="text-sm text-green-700 mt-1">
                Generated at {formatTime(data!.session!.generatedAt)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">No session generated yet for today.</p>
              <div className="flex gap-3">
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#227EEE]"
                >
                  {SCHEDULES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="rounded-2xl bg-[#227EEE] px-5 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:brightness-95 disabled:opacity-60"
                >
                  {isGenerating ? 'Generating…' : 'Generate'}
                </button>
              </div>
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
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Members', value: data.summary.totalMembers, color: 'blue' },
              { label: 'Checked In', value: data.summary.checkedIn, color: 'green' },
              { label: 'Not Yet In', value: data.summary.notCheckedIn, color: 'yellow' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-2xl border-2 ${
                color === 'blue' ? 'border-blue-100 bg-blue-50' :
                color === 'green' ? 'border-green-100 bg-green-50' :
                'border-yellow-100 bg-yellow-50'
              } p-4 text-center`}>
                <p className={`text-3xl font-black ${
                  color === 'blue' ? 'text-blue-700' :
                  color === 'green' ? 'text-green-700' :
                  'text-yellow-700'
                }`}>{value}</p>
                <p className="text-xs font-bold text-slate-600 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Attendance table */}
        {data?.session && data.attendanceRows.length > 0 && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/50">
            <h2 className="mb-4 text-lg font-black text-slate-800">Member Attendance</h2>
            <div className="overflow-hidden rounded-2xl border-2 border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-black text-slate-600">Name</th>
                    <th className="px-4 py-3 text-left font-black text-slate-600 hidden sm:table-cell">Group</th>
                    <th className="px-4 py-3 text-center font-black text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-black text-slate-600 hidden sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendanceRows.map((row, i) => (
                    <tr key={row.attendanceId} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-3 font-bold text-slate-800">{row.memberName}</td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{row.ageGroup}</td>
                      <td className="px-4 py-3 text-center">
                        {row.checkedIn ? (
                          <span className="inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-black text-green-700">✓ In</span>
                        ) : (
                          <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Absent</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">
                        {formatTime(row.checkedInAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                  <p className="font-black text-slate-800">{ft.childName}</p>
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
