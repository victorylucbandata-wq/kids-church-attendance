'use client'

import { useEffect, useState } from 'react'
import { UncheckedMember } from '@/app/lib/types'
import { isBirthdayToday, isBirthdayThisWeek } from '@/app/lib/birthday'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '🎨',
    title: 'Step 1 — Pick the age group',
    body: 'Tap your child\'s age group. Only groups with kids still to check in are shown.',
  },
  {
    emoji: '🙋',
    title: 'Step 2 — Tap the name',
    body: 'Find your child in the list and tap their name. You can add allergies or notes before confirming.',
  },
  {
    emoji: '✅',
    title: 'Step 3 — Confirm',
    body: 'Tap the "Check In" button. A green message confirms it, and the name disappears from the list.',
  },
  {
    emoji: '🆕',
    title: 'First time here?',
    body: 'If your child isn\'t in the list, use the "Register instead" link at the bottom to add them.',
  },
]

const TIME_SLOTS = [
  { value: '9am', label: '9:00 AM', emoji: '🌅' },
  { value: '11am', label: '11:00 AM', emoji: '☀️' },
  { value: 'Special', label: 'Special Event', emoji: '🌟' },
]

type Step = 'time-slot' | 'group-select' | 'member-select'

type LoadState =
  | { status: 'loading' }
  | { status: 'no-session' }
  | { status: 'ready'; members: UncheckedMember[]; sessionId: string }
  | { status: 'all-done' }
  | { status: 'error'; message: string }

function displayName(m: UncheckedMember): string {
  if (m.nickname) return `${m.nickname} (${m.lastName}, ${m.firstName})`
  return `${m.firstName} ${m.lastName}`
}

export default function ReturningPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [step, setStep] = useState<Step>('time-slot')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selected, setSelected] = useState<UncheckedMember | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

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

  const PAGE_SIZE = 10

  const membersInGroup =
    loadState.status === 'ready'
      ? loadState.members.filter((m) => m.ageGroup === selectedGroup)
      : []

  const sortedMembers = [...membersInGroup].sort((a, b) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  )

  const filteredMembers = search
    ? sortedMembers.filter((m) =>
        displayName(m).toLowerCase().includes(search.toLowerCase())
      )
    : sortedMembers

  const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE)
  const pagedMembers = filteredMembers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const activeGroups =
    loadState.status === 'ready'
      ? [...new Set(loadState.members.map((m) => m.ageGroup))].filter(Boolean).sort()
      : []

  const GROUP_EMOJIS: Record<string, string> = {
    'Preschool': '🎨',
    'Preteens': '🧒',
  }

  const handleTimeSlotSelect = (slot: string) => {
    setSelectedTimeSlot(slot)
    setStep('group-select')
  }

  const handleGroupSelect = (group: string) => {
    setSelectedGroup(group)
    setSelected(null)
    setNotes('')
    setSearch('')
    setPage(0)
    setStep('member-select')
  }

  const handleBack = () => {
    if (step === 'member-select') {
      setStep('group-select')
      setSelected(null)
      setNotes('')
    } else if (step === 'group-select') {
      setStep('time-slot')
    }
  }

  const handleSelect = (member: UncheckedMember) => {
    setSelected((prev) => (prev?.memberId === member.memberId ? null : member))
    setNotes('')
  }

  const handleCheckIn = async () => {
    if (!selected || loadState.status !== 'ready') return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/check-in/returning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selected.memberId,
          sessionId: loadState.sessionId,
          timeSlot: selectedTimeSlot,
          notes,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        setToast(data.error ?? 'Check-in failed.')
        setTimeout(() => setToast(''), 3000)
        return
      }

      const remaining = loadState.members.filter((m) => m.memberId !== selected.memberId)
      const checkedName = displayName(selected)
      setSelected(null)
      setNotes('')
      setToast(`${checkedName} checked in!`)
      setTimeout(() => setToast(''), 2000)

      if (remaining.length === 0) {
        setLoadState({ status: 'all-done' })
        return
      }

      setLoadState({ status: 'ready', members: remaining, sessionId: loadState.sessionId })

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
    'w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-center text-sm text-slate-800 outline-none transition focus:border-[#227EEE] focus:ring-4 focus:ring-blue-100'

  const stepLabel =
    step === 'time-slot'
      ? 'Select the service time.'
      : step === 'group-select'
        ? 'Select your child\'s age group.'
        : `${selectedGroup} — tap your child's name.`

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
            <p className="mt-2 text-sm text-slate-500">{stepLabel}</p>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mb-4 rounded-2xl bg-green-500 px-4 py-3 text-center text-sm font-black text-white shadow-lg">
            {toast}
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

        {/* Step 1: Time slot selection */}
        {loadState.status === 'ready' && step === 'time-slot' && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-100/70">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-slate-400">
              Service Time
            </p>
            <div className="space-y-3">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.value}
                  onClick={() => handleTimeSlotSelect(slot.value)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-blue-100 bg-white px-4 py-4 transition hover:border-[#227EEE] hover:bg-blue-50 active:scale-[0.97]"
                >
                  <span className="text-2xl">{slot.emoji}</span>
                  <span className="font-black text-slate-800">{slot.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Age group selection */}
        {loadState.status === 'ready' && step === 'group-select' && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-100/70">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-slate-400">
              Age Group
            </p>
            <div className="grid grid-cols-2 gap-3">
              {activeGroups.map((group) => {
                const count = loadState.members.filter((m) => m.ageGroup === group).length
                return (
                  <button
                    key={group}
                    onClick={() => handleGroupSelect(group)}
                    className="flex min-h-[90px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-4 transition hover:border-[#227EEE] hover:bg-blue-50 active:scale-[0.97]"
                  >
                    <span className="text-3xl">{GROUP_EMOJIS[group] ?? '👦'}</span>
                    <span className="font-black text-slate-800 text-sm">{group}</span>
                    <span className="text-xs text-slate-400">{count} kid{count !== 1 ? 's' : ''}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3: Member list filtered by group */}
        {loadState.status === 'ready' && step === 'member-select' && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-100/70 space-y-3">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); setSelected(null) }}
              placeholder="Search by name…"
              className={inputClass}
            />

            {/* Count */}
            <p className="text-center text-xs font-bold text-slate-400">
              {filteredMembers.length} kid{filteredMembers.length !== 1 ? 's' : ''}
              {search ? ' found' : ''}
              {totalPages > 1 ? ` · Page ${page + 1} of ${totalPages}` : ''}
            </p>

            {/* Member list */}
            <div className="space-y-2">
              {pagedMembers.map((member) => {
                const isSelected = selected?.memberId === member.memberId
                const bdayToday = isBirthdayToday(member.birthday)
                const bdayWeek = !bdayToday && isBirthdayThisWeek(member.birthday)
                const bday = member.birthday
                  ? new Date(member.birthday + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                  : null
                return (
                  <button
                    key={member.memberId}
                    onClick={() => handleSelect(member)}
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-center transition ${
                      isSelected
                        ? 'border-[#227EEE] bg-blue-50'
                        : bdayToday
                        ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                        : bdayWeek
                        ? 'border-yellow-200 bg-yellow-50/50 hover:border-yellow-300'
                        : 'border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50/50'
                    }`}
                  >
                    <p className={`font-black text-base leading-tight ${isSelected ? 'text-[#227EEE]' : 'text-slate-800'}`}>
                      {(bdayToday || bdayWeek) && <span className="mr-1">🎂</span>}
                      {member.nickname || member.firstName}
                    </p>
                    <p className={`text-sm leading-tight ${isSelected ? 'text-blue-400' : 'text-slate-500'}`}>
                      {member.lastName}, {member.firstName}
                    </p>
                    {bday && (
                      <p className={`text-xs mt-0.5 ${bdayToday ? 'font-bold text-yellow-600' : bdayWeek ? 'text-yellow-500' : 'text-slate-400'}`}>
                        {bdayToday ? 'Birthday today!' : bdayWeek ? 'Birthday this week!' : bday}
                      </p>
                    )}
                  </button>
                )
              })}

              {filteredMembers.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">No matching names.</p>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-blue-50 disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-blue-50 disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            )}

          </div>
        )}

        <div className="mt-6 text-center space-y-2">
          {(step === 'member-select' || step === 'group-select') && (
            <button
              onClick={handleBack}
              className="block w-full text-sm font-bold text-[#227EEE] hover:underline"
            >
              {step === 'member-select' ? '← Change age group' : '← Change time slot'}
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

      {/* Check-in confirmation popup */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => { setSelected(null); setNotes('') }}>
          <div
            className="w-full max-w-sm rounded-[2rem] border border-blue-100 bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-sm font-black text-slate-700">
                Checking in: <span className="text-[#227EEE]">{displayName(selected)}</span>
              </p>
            </div>
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
              {isSubmitting ? 'Checking in…' : `Check In ${displayName(selected)}`}
            </button>
            <button
              onClick={() => { setSelected(null); setNotes('') }}
              className="w-full text-sm font-bold text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <HelpWizard title="How to check in" steps={HELP_STEPS} />
    </main>
  )
}
