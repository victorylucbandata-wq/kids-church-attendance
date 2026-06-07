'use client'

import { useEffect, useRef, useState } from 'react'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '📝',
    title: 'Fill in the details',
    body: 'Enter the parent/guardian name, contact number, and your child\'s name. Fields marked with * are required.',
  },
  {
    emoji: '🎨',
    title: 'Pick the age group & time slot',
    body: 'Choose your child\'s age group and the time slot you\'re attending so we can place them in the right class.',
  },
  {
    emoji: '🍎',
    title: 'Add allergies or notes',
    body: 'Let us know about any allergies or special needs in the notes box. This is optional but helpful.',
  },
  {
    emoji: '✅',
    title: 'Check in',
    body: 'Tap "Check In". Your child is registered and marked present at the same time — no need to do it again next week!',
  },
]

const TIME_SLOTS = [
  { value: '9am', label: '9:00 AM' },
  { value: '11am', label: '11:00 AM' },
  { value: 'Special', label: 'Special Event' },
]

type FirstTimerForm = {
  parentName: string
  contactNumber: string
  childFirstName: string
  childLastName: string
  childNickname: string
  age: string
  ageGroup: string
  timeSlot: string
  birthday: string
  notes: string
}

const initialForm: FirstTimerForm = {
  parentName: '',
  contactNumber: '',
  childFirstName: '',
  childLastName: '',
  childNickname: '',
  age: '',
  ageGroup: '',
  timeSlot: '',
  birthday: '',
  notes: '',
}

export default function FirstTimerPage() {
  const [form, setForm] = useState<FirstTimerForm>(initialForm)
  const [ageGroups, setAgeGroups] = useState<{ id: string; name: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(4)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/age-groups')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.ageGroups) setAgeGroups(data.ageGroups)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  useEffect(() => {
    if (!justSubmitted) return

    setCountdown(4)

    countdownRef.current = setInterval(() => {
      setCountdown((c) => c - 1)
    }, 1000)

    resetTimerRef.current = setTimeout(() => {
      clearInterval(countdownRef.current!)
      setForm(initialForm)
      setJustSubmitted(false)
      setMessage('')
    }, 4000)

    return () => {
      clearInterval(countdownRef.current!)
      clearTimeout(resetTimerRef.current!)
    }
  }, [justSubmitted])

  const updateField = (field: keyof FirstTimerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setMessage('')

    if (
      !form.parentName ||
      !form.contactNumber ||
      !form.childFirstName ||
      !form.childLastName ||
      !form.ageGroup ||
      !form.timeSlot
    ) {
      setMessage('Please complete the required fields before checking in.')
      return
    }

    try {
      setIsSubmitting(true)

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Something went wrong.')
      }

      setJustSubmitted(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayName = form.childNickname
    ? `${form.childNickname} (${form.childLastName}, ${form.childFirstName})`
    : `${form.childFirstName} ${form.childLastName}`

  const inputClass =
    'w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#227EEE] focus:ring-4 focus:ring-blue-100'

  const labelClass = 'mb-1.5 block text-sm font-bold text-slate-700'

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6 text-slate-900">
      <section className="relative mx-auto max-w-md overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-100/70">
        <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-yellow-200/70" />
        <div className="absolute -right-10 top-20 h-28 w-28 rounded-full bg-blue-200/60" />
        <div className="absolute bottom-10 -left-10 h-24 w-24 rounded-full bg-pink-200/60" />

        <div className="relative mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#227EEE] text-3xl shadow-lg shadow-blue-200">
            🧒
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#227EEE]">Kids Church</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">First Timer!</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Welcome! Please fill in your details to check in.
          </p>
          <div className="mt-4 flex justify-center gap-2 text-2xl">
            <span>🌈</span>
            <span>⭐</span>
            <span>🎨</span>
            <span>📖</span>
          </div>
        </div>

        <div className="relative">
          {justSubmitted ? (
            <div className="space-y-4 text-center">
              <div className="rounded-[1.5rem] border-2 border-green-100 bg-green-50 p-5">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-3xl">
                  ✅
                </div>
                <p className="text-xl font-black text-green-800">Check-in successful!</p>
                <p className="mt-2 text-sm leading-relaxed text-green-700">
                  Thank you! {displayName}&apos;s attendance has been recorded.
                </p>
              </div>

              <div className="rounded-[1.5rem] border-2 border-blue-100 bg-blue-50/70 p-4 text-left">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">📋</span>
                  <p className="text-sm font-black text-slate-700">Submitted Details</p>
                </div>
                <div className="space-y-2 rounded-2xl bg-white p-4 text-sm shadow-sm">
                  <p><span className="font-bold text-[#227EEE]">Parent:</span> {form.parentName}</p>
                  <p><span className="font-bold text-[#227EEE]">Contact:</span> {form.contactNumber}</p>
                  <p><span className="font-bold text-[#227EEE]">Child:</span> {displayName}</p>
                  {form.birthday && <p><span className="font-bold text-[#227EEE]">Birthday:</span> {form.birthday}</p>}
                  {form.age && <p><span className="font-bold text-[#227EEE]">Age:</span> {form.age}</p>}
                  <p><span className="font-bold text-[#227EEE]">Group:</span> {form.ageGroup}</p>
                  <p><span className="font-bold text-[#227EEE]">Time Slot:</span> {form.timeSlot}</p>
                  {form.notes && <p><span className="font-bold text-[#227EEE]">Notes:</span> {form.notes}</p>}
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Resetting form in {countdown}s…
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <label className="block">
                <span className={labelClass}>Parent / Guardian Name *</span>
                <input
                  value={form.parentName}
                  onChange={(e) => updateField('parentName', e.target.value)}
                  className={inputClass}
                  placeholder="Enter parent or guardian name"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Contact Number *</span>
                <input
                  value={form.contactNumber}
                  onChange={(e) => updateField('contactNumber', e.target.value)}
                  className={inputClass}
                  placeholder="09XXXXXXXXX"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Child First Name *</span>
                <input
                  value={form.childFirstName}
                  onChange={(e) => updateField('childFirstName', e.target.value)}
                  className={inputClass}
                  placeholder="Enter first name"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Child Last Name *</span>
                <input
                  value={form.childLastName}
                  onChange={(e) => updateField('childLastName', e.target.value)}
                  className={inputClass}
                  placeholder="Enter last name"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Nickname</span>
                <input
                  value={form.childNickname}
                  onChange={(e) => updateField('childNickname', e.target.value)}
                  className={inputClass}
                  placeholder="What does your child go by?"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Birthday</span>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => updateField('birthday', e.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Child Age</span>
                <input
                  value={form.age}
                  onChange={(e) => updateField('age', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 5"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Age Group / Class *</span>
                <select
                  value={form.ageGroup}
                  onChange={(e) => updateField('ageGroup', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select age group</option>
                  {ageGroups.map((ag) => (
                    <option key={ag.id} value={ag.name}>{ag.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelClass}>Time Slot *</span>
                <select
                  value={form.timeSlot}
                  onChange={(e) => updateField('timeSlot', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select time slot</option>
                  {TIME_SLOTS.map((ts) => (
                    <option key={ts.value} value={ts.value}>{ts.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelClass}>Allergies / Special Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Optional"
                />
              </label>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-[#227EEE] px-4 py-4 text-lg font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-95 disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting…' : 'Check In'}
              </button>

              {message && (
                <p className="rounded-2xl bg-blue-50 p-3 text-center text-sm font-bold text-slate-700">
                  {message}
                </p>
              )}
            </form>
          )}
        </div>

        <div className="relative mt-6 text-center">
          <a href="/" className="text-sm font-bold text-slate-400 hover:text-slate-600">
            ← Back
          </a>
        </div>
      </section>

      <HelpWizard title="How to register" steps={HELP_STEPS} />
    </main>
  )
}
