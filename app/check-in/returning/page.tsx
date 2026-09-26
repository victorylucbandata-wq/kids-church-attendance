'use client'

import { useEffect, useState } from 'react'
import { UncheckedMember } from '@/app/lib/types'
import { isBirthdayToday, isBirthdayThisWeek } from '@/app/lib/birthday'
import Link from 'next/link'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import Modal from '@/app/components/Modal'
import { inputClass } from '@/app/lib/ui'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '🎨',
    title: 'Step 1 — Pick the age group',
    body: 'Tap your child\'s age group — or Serve Team if you are volunteering. Only groups with people still to check in are shown.',
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
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)
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
  const SERVE_TEAM = 'Serve Team'
  const groupOf = (m: { ageGroup: string }) => m.ageGroup || SERVE_TEAM

  const membersInGroup =
    loadState.status === 'ready'
      ? loadState.members.filter((m) => groupOf(m) === selectedGroup)
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
      ? [...new Set(loadState.members.map(groupOf))].sort(
          (a, b) => Number(a === SERVE_TEAM) - Number(b === SERVE_TEAM) || a.localeCompare(b)
        )
      : []

  const GROUP_EMOJIS: Record<string, string> = {
    'Preschool': '🎨',
    'Preteens': '🧒',
    [SERVE_TEAM]: '🙌',
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

  const showToast = (text: string, ok: boolean) => {
    setToast({ text, ok })
    setTimeout(() => setToast(null), ok ? 2500 : 4000)
  }

  const closeConfirm = () => {
    setSelected(null)
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
        showToast(data.error ?? 'Check-in did not go through. Please try again.', false)
        return
      }

      const remaining = loadState.members.filter((m) => m.memberId !== selected.memberId)
      const checkedName = displayName(selected)
      setSelected(null)
      setNotes('')
      showToast(`${checkedName} checked in!`, true)

      if (remaining.length === 0) {
        setLoadState({ status: 'all-done' })
        return
      }

      setLoadState({ status: 'ready', members: remaining, sessionId: loadState.sessionId })

      const stillInGroup = remaining.some((m) => groupOf(m) === selectedGroup)
      if (!stillInGroup) {
        setStep('group-select')
      }
    } catch {
      showToast('Could not reach the server. Check your connection and try again.', false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepLabel =
    step === 'time-slot'
      ? 'Select the service time.'
      : step === 'group-select'
        ? 'Select your child\'s age group.'
        : selectedGroup === SERVE_TEAM
          ? `${SERVE_TEAM} — tap your name.`
          : `${selectedGroup} — tap your child's name.`

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24 text-slate-900">
      <div className="mx-auto max-w-md">

        {/* Header */}
        <div className="relative mb-6 overflow-hidden card p-6 text-center">
          <div aria-hidden="true" className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-yellow-200/70" />
          <div aria-hidden="true" className="absolute -right-10 top-20 h-28 w-28 rounded-full bg-blue-200/60" />
          <div className="relative">
            <div aria-hidden="true" className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-3xl shadow-lg shadow-blue-200">
              👋
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Welcome Back!</h1>
            <p className="mt-2 text-base text-slate-600" aria-live="polite">{stepLabel}</p>
          </div>
        </div>

        {/* Toast */}
        <div role="status" aria-live="polite">
          {toast && (
            <div
              className={`mb-4 rounded-2xl px-4 py-3 text-center text-base font-black shadow-lg ${
                toast.ok ? 'bg-green-700 text-white' : 'border-2 border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {toast.text}
            </div>
          )}
        </div>

        {/* Loading */}
        {loadState.status === 'loading' && (
          <div className="card p-8 text-center">
            <p className="text-slate-500 text-sm">Loading today&apos;s list…</p>
          </div>
        )}

        {/* No session */}
        {loadState.status === 'no-session' && (
          <div className="rounded-[2rem] border border-yellow-100 bg-white p-8 shadow-xl shadow-yellow-100/70 text-center space-y-3">
            <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-3xl">⏳</div>
            <p className="font-black text-slate-800">Check-in not open yet</p>
            <p className="text-sm text-slate-500">Please ask a volunteer to start today&apos;s session.</p>
          </div>
        )}

        {/* All done */}
        {loadState.status === 'all-done' && (
          <div className="rounded-[2rem] border border-green-100 bg-white p-8 shadow-xl shadow-green-100/70 text-center space-y-3">
            <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">🎉</div>
            <p className="font-black text-slate-800">All kids are checked in!</p>
            <p className="text-sm text-slate-500">Everyone has been accounted for today.</p>
          </div>
        )}

        {/* Error */}
        {loadState.status === 'error' && (
          <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-xl shadow-red-100/70 text-center space-y-3">
            <p className="font-black text-red-700">Couldn&apos;t load today&apos;s list</p>
            <p className="text-sm text-slate-600">{loadState.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-2xl bg-brand px-6 py-3 text-sm font-black text-white transition hover:bg-brand-strong"
            >
              Try again
            </button>
          </div>
        )}

        {/* Step 1: Time slot selection */}
        {loadState.status === 'ready' && step === 'time-slot' && (
          <div className="card p-4">
            <p className="mb-3 text-center text-sm font-bold text-slate-700">
              Service Time
            </p>
            <div className="space-y-3">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => handleTimeSlotSelect(slot.value)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-blue-100 bg-white px-4 py-4 transition hover:border-brand hover:bg-blue-50 active:scale-[0.97] motion-reduce:active:scale-100"
                >
                  <span aria-hidden="true" className="text-2xl">{slot.emoji}</span>
                  <span className="font-black text-slate-800">{slot.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Age group selection */}
        {loadState.status === 'ready' && step === 'group-select' && (
          <div className="card p-4">
            <p className="mb-3 text-center text-sm font-bold text-slate-700">
              Age Group
            </p>
            <div className="grid grid-cols-2 gap-3">
              {activeGroups.map((group) => {
                const count = loadState.members.filter((m) => groupOf(m) === group).length
                return (
                  <button
                    key={group}
                    onClick={() => handleGroupSelect(group)}
                    className="flex min-h-[90px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-4 transition hover:border-brand hover:bg-blue-50 active:scale-[0.97] motion-reduce:active:scale-100"
                  >
                    <span aria-hidden="true" className="text-3xl">{GROUP_EMOJIS[group] ?? '👦'}</span>
                    <span className="font-black text-slate-800 text-sm">{group}</span>
                    <span className="text-xs text-slate-500">
                      {count} {group === SERVE_TEAM ? 'serving' : `kid${count !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3: Member list filtered by group */}
        {loadState.status === 'ready' && step === 'member-select' && (
          <div className="card p-4 space-y-3">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); setSelected(null) }}
              placeholder="Search by name…"
              className={inputClass}
              aria-label="Search by name"
            />

            {/* Count */}
            <p className="text-center text-xs font-bold text-slate-500">
              {filteredMembers.length}{selectedGroup === SERVE_TEAM ? ' serving' : ` kid${filteredMembers.length !== 1 ? 's' : ''}`}
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
                        ? 'border-brand bg-blue-50'
                        : bdayToday
                        ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                        : bdayWeek
                        ? 'border-yellow-200 bg-yellow-50/50 hover:border-yellow-300'
                        : 'border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50/50'
                    }`}
                  >
                    <p className={`font-black text-base leading-tight ${isSelected ? 'text-brand' : 'text-slate-800'}`}>
                      {(bdayToday || bdayWeek) && <span aria-hidden="true" className="mr-1">🎂</span>}
                      {member.nickname || member.firstName}
                    </p>
                    <p className={`text-sm leading-tight ${isSelected ? 'text-brand' : 'text-slate-500'}`}>
                      {member.lastName}, {member.firstName}
                    </p>
                    {bday && (
                      <p className={`text-xs mt-0.5 ${bdayToday ? 'font-bold text-yellow-800' : bdayWeek ? 'text-yellow-800' : 'text-slate-500'}`}>
                        {bdayToday ? 'Birthday today!' : bdayWeek ? 'Birthday this week!' : bday}
                      </p>
                    )}
                  </button>
                )
              })}

              {filteredMembers.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500">No matching names.</p>
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

        <div className="mt-4 text-center">
          {(step === 'member-select' || step === 'group-select') && (
            <button
              onClick={handleBack}
              className="block w-full py-3 text-sm font-bold text-brand hover:underline"
            >
              {step === 'member-select' ? '← Change age group' : '← Change time slot'}
            </button>
          )}
          <Link href="/check-in/new" className="block py-3 text-sm font-bold text-slate-600 hover:text-slate-900">
            First time here? Register instead →
          </Link>
          <Link href="/" className="block py-3 text-sm font-bold text-slate-600 hover:text-slate-900">
            ← Back to home
          </Link>
        </div>
      </div>

      {/* Check-in confirmation */}
      <Modal open={!!selected} onClose={closeConfirm} label="Confirm check-in">
        {selected && (
          <div className="space-y-4">
            <p className="text-center text-lg font-black text-balance text-slate-800">
              Check in <span className="text-brand">{displayName(selected)}</span>?
            </p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Allergies / Notes <span className="font-normal text-slate-600">(optional)</span>
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
              type="button"
              onClick={handleCheckIn}
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-brand px-4 py-3.5 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
            >
              {isSubmitting ? 'Checking in…' : 'Check In'}
            </button>
            <button
              type="button"
              onClick={closeConfirm}
              className="min-h-11 w-full text-sm font-bold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        )}
      </Modal>

      <HelpWizard title="How to check in" steps={HELP_STEPS} />
    </main>
  )
}
