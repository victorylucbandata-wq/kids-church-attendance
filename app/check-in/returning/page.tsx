'use client'

import { useEffect, useState } from 'react'
import { UncheckedMember } from '@/app/lib/types'

const AGE_GROUPS = [
  { label: 'Preschool', emoji: '🎨' },
  { label: 'Preteens', emoji: '🧒' },
]

type Step = 'group-select' | 'member-select'

type LoadState =
  | { status: 'loading' }
  | { status: 'no-session' }
  | { status: 'ready'; members: UncheckedMember[]; sessionId: string }
  | { status: 'all-done' }
  | { status: 'error'; message: string }

export default function ReturningPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [step, setStep] = useState<Step>('group-select')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selected, setSelected] = useState<UncheckedMember | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/check-in/members')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setLoadState({ status: 'error', message: data.error ?? 'Could not load members.' })
          return
        }
        if (!data.sessionId) {
          setLoadState({ status: 'no-session' })
          return
        }
        if (data.members.length === 0) {
          setLoadState({ status: 'all-done' })
          return
        }
        setLoadState({ status: 'ready', members: data.members, sessionId: data.sessionId })
      })
      .catch(() => setLoadState({ status: 'error', message: 'Network error. Please try again.' }))
  }, [])

  const membersInGroup =
    loadState.status === 'ready'
      ? loadState.members.filter((m) => m.ageGroup === selectedGroup)
      : []

  // Groups that still have unchecked kids
  const activeGroups =
    loadState.status === 'ready'
      ? AGE_GROUPS.filter((g) =>
          loadState.members.some((m) => m.ageGroup === g.label)
        )
      : []

  const handleGroupSelect = (group: string) => {
    setSelectedGroup(group)
    setSelected(null)
    setNotes('')
    setStep('member-select')
  }

  const handleBack = () => {
    setStep('group-select')
    setSelected(null)
    setNotes('')
  }

  const handleSelect = (member: UncheckedMember) => {
    setSelected((prev) => (prev?.attendanceId === member.attendanceId ? null : member))
    setNotes('')
  }

  const handleCheckIn = async () => {
    if (!selected || loadState.status !== 'ready') return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/check-in/returning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId: selected.attendanceId, notes }),
      })
      const data = await res.json()

      if (!data.success) {
        setToast(data.error ?? 'Check-in failed.')
        setTimeout(() => setToast(''), 3000)
        return
      }

      const remaining = loadState.members.filter((m) => m.attendanceId !== selected.attendanceId)
      const checkedName = selected.memberName
      setSelected(null)
      setNotes('')
      setToast(`${checkedName} checked in!`)
      setTimeout(() => setToast(''), 2000)

      if (remaining.length === 0) {
        setLoadState({ status: 'all-done' })
        return
      }

      setLoadState({ status: 'ready', members: remaining, sessionId: loadState.sessionId })

      // If no more kids in this group, go back to group select
      const stillInGroup = remaining.some((m) => m.ageGroup === selectedGroup)
      if (!stillInGroup) {
        setStep('group-select')
      }
    } catch {
      setToast('Network error. Please try again.')
      setTimeout(() => setToast(''), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#227EEE] focus:ring-4 focus:ring-blue-100'

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-md">

        {/* Header */}
        <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-100/70 text-center">
          <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-yellow-200/70" />
          <div className="absolute -right-10 top-20 h-28 w-28 rounded-full bg-blue-200/60" />
          <div className="relative">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#227EEE] text-3xl shadow-lg shadow-blue-200">
              👋
            </div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#227EEE]">Kids Church</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Welcome Back!</h1>
            <p className="mt-2 text-sm text-slate-500">
              {step === 'group-select'
                ? 'Select your child\'s age group.'
                : `${selectedGroup} — tap your child's name.`}
            </p>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mb-4 rounded-2xl bg-green-500 px-4 py-3 text-center text-sm font-black text-white shadow-lg">
            ✓ {toast}
          </div>
        )}

        {/* Loading */}
        {loadState.status === 'loading' && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-8 shadow-xl shadow-blue-100/70 text-center">
            <p className="text-slate-500 text-sm">Loading today&apos;s list…</p>
          </div>
        )}

        {/* No session */}
        {loadState.status === 'no-session' && (
          <div className="rounded-[2rem] border border-yellow-100 bg-white p-8 shadow-xl shadow-yellow-100/70 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-3xl">⏳</div>
            <p className="font-black text-slate-800">Check-in not open yet</p>
            <p className="text-sm text-slate-500">Please ask a volunteer to start today&apos;s session.</p>
          </div>
        )}

        {/* All done */}
        {loadState.status === 'all-done' && (
          <div className="rounded-[2rem] border border-green-100 bg-white p-8 shadow-xl shadow-green-100/70 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">🎉</div>
            <p className="font-black text-slate-800">All kids are checked in!</p>
            <p className="text-sm text-slate-500">Everyone has been accounted for today.</p>
          </div>
        )}

        {/* Error */}
        {loadState.status === 'error' && (
          <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-xl shadow-red-100/70 text-center space-y-3">
            <p className="font-black text-red-700">Something went wrong</p>
            <p className="text-sm text-slate-500">{loadState.message}</p>
          </div>
        )}

        {/* Step 1: Age group selection */}
        {loadState.status === 'ready' && step === 'group-select' && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-100/70">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Age Group
            </p>
            <div className="grid grid-cols-2 gap-3">
              {activeGroups.map((group) => {
                const count = loadState.members.filter((m) => m.ageGroup === group.label).length
                return (
                  <button
                    key={group.label}
                    onClick={() => handleGroupSelect(group.label)}
                    className="flex min-h-[90px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-4 transition hover:border-[#227EEE] hover:bg-blue-50 active:scale-[0.97]"
                  >
                    <span className="text-3xl">{group.emoji}</span>
                    <span className="font-black text-slate-800 text-sm">{group.label}</span>
                    <span className="text-xs text-slate-400">{count} kid{count !== 1 ? 's' : ''}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Member list filtered by group */}
        {loadState.status === 'ready' && step === 'member-select' && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-100/70 space-y-2">
            {membersInGroup.map((member) => {
              const isSelected = selected?.attendanceId === member.attendanceId
              return (
                <button
                  key={member.attendanceId}
                  onClick={() => handleSelect(member)}
                  className={`w-full rounded-2xl border-2 px-4 py-4 text-left transition ${
                    isSelected
                      ? 'border-[#227EEE] bg-blue-50'
                      : 'border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50/50'
                  }`}
                >
                  <p className={`font-black text-base ${isSelected ? 'text-[#227EEE]' : 'text-slate-800'}`}>
                    {member.memberName}
                  </p>
                </button>
              )
            })}

            {/* Confirm panel */}
            {selected && (
              <div className="mt-2 rounded-2xl border-2 border-[#227EEE] bg-blue-50 p-4 space-y-3">
                <p className="text-sm font-black text-slate-700">
                  Checking in: <span className="text-[#227EEE]">{selected.memberName}</span>
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-slate-600">
                    Allergies / Notes <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className={inputClass}
                    placeholder="Any allergies or special notes today?"
                  />
                </label>
                <button
                  onClick={handleCheckIn}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-[#227EEE] px-4 py-3.5 font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-95 disabled:opacity-60"
                >
                  {isSubmitting ? 'Checking in…' : `Check In ${selected.memberName}`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center space-y-2">
          {step === 'member-select' && (
            <button
              onClick={handleBack}
              className="block w-full text-sm font-bold text-[#227EEE] hover:underline"
            >
              ← Change age group
            </button>
          )}
          <a href="/check-in/new" className="block text-sm font-bold text-slate-400 hover:text-slate-600">
            First time here? Register instead →
          </a>
          <a href="/" className="block text-sm font-bold text-slate-400 hover:text-slate-600">
            ← Back to home
          </a>
        </div>
      </div>
    </main>
  )
}
