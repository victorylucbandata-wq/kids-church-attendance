'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import { inputClass, labelClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'

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

type AgeGroup = { id: string; name: string }

const fetchAgeGroups = () => requestJson<{ ageGroups: AgeGroup[] }>('/api/age-groups')

type FieldErrors = Partial<Record<keyof FirstTimerForm, string>>

const REQUIRED_FIELDS: [keyof FirstTimerForm, string][] = [
  ['parentName', 'Parent / guardian name'],
  ['contactNumber', 'Contact number'],
  ['childFirstName', "Child's first name"],
  ['childLastName', "Child's last name"],
  ['ageGroup', 'Age group'],
  ['timeSlot', 'Time slot'],
]

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
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [ageGroupsFailed, setAgeGroupsFailed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [countdown, setCountdown] = useState(4)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // A failed load would leave the required Age Group empty, so offer a retry instead.
  const loadAgeGroups = () =>
    fetchAgeGroups().then((res) => {
      if (res.ok) setAgeGroups(res.data.ageGroups)
      setAgeGroupsFailed(!res.ok)
    })

  useEffect(() => {
    fetchAgeGroups().then((res) => {
      if (res.ok) setAgeGroups(res.data.ageGroups)
      setAgeGroupsFailed(!res.ok)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  useEffect(() => {
    if (!justSubmitted) return

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
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    const missing = REQUIRED_FIELDS.filter(([key]) => !form[key].trim())
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map(([key, label]) => [key, `${label} is required.`])))
      setMessage(`Please fill in: ${missing.map(([, label]) => label).join(', ')}.`)
      document.getElementById(missing[0][0])?.focus()
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
        throw new Error(result.error || 'Check-in did not go through. Please try again or ask a volunteer.')
      }

      setCountdown(4)
      setJustSubmitted(true)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not reach the server. Check your connection and tap Check In again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Wires a field to form state, its error message, and screen readers.
  const field = (key: keyof FirstTimerForm) => ({
    id: key,
    name: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      updateField(key, e.target.value),
    className: inputClass,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  })

  const fieldError = (key: keyof FirstTimerForm) =>
    errors[key] && (
      <span id={`${key}-error`} className="mt-1.5 block text-sm font-bold text-red-700">
        {errors[key]}
      </span>
    )

  const required = <span aria-hidden="true" className="text-red-700"> *</span>

  const displayName = form.childNickname
    ? `${form.childNickname} (${form.childLastName}, ${form.childFirstName})`
    : `${form.childFirstName} ${form.childLastName}`

  const details: [string, string][] = [
    ['Parent', form.parentName],
    ['Contact', form.contactNumber],
    ['Child', displayName],
    ['Birthday', form.birthday],
    ['Age', form.age],
    ['Group', form.ageGroup],
    ['Time slot', TIME_SLOTS.find((t) => t.value === form.timeSlot)?.label ?? form.timeSlot],
    ['Notes', form.notes],
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24 text-slate-900">
      <section className="relative mx-auto max-w-md overflow-hidden card p-6">
        <div aria-hidden="true" className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-yellow-200/70" />
        <div aria-hidden="true" className="absolute -right-10 top-20 h-28 w-28 rounded-full bg-blue-200/60" />

        <div className="relative mb-6 text-center">
          <div aria-hidden="true" className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-3xl shadow-lg shadow-blue-200">
            🧒
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">First Timer!</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            Welcome! Fill in a few details and your child is registered and checked in.
          </p>
        </div>

        {/* Announces the outcome to screen readers; the visible panel below shows it. */}
        <p role="status" className="sr-only">
          {justSubmitted ? `Check-in successful. ${displayName} is checked in.` : ''}
        </p>

        <div className="relative">
          {justSubmitted ? (
            <div className="rounded-[1.5rem] border-2 border-green-100 bg-green-50 p-5">
              <div className="text-center">
                <div aria-hidden="true" className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-3xl">
                  ✅
                </div>
                <p className="text-xl font-black text-green-800">Check-in successful!</p>
                <p className="mt-1 text-base leading-relaxed text-green-800">
                  {displayName} is checked in. See you next week!
                </p>
              </div>

              <dl className="mt-4 divide-y divide-green-100 border-t border-green-100 text-sm">
                {details
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="flex gap-3 py-2">
                      <dt className="w-20 shrink-0 font-bold text-green-800">{label}</dt>
                      <dd className="min-w-0 break-words text-slate-800">{value}</dd>
                    </div>
                  ))}
              </dl>

              <p className="mt-3 text-center text-sm text-green-800" aria-hidden="true">
                Clearing for the next family in {countdown}s…
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <p className="text-sm text-slate-600">
                Fields marked <span className="font-bold text-red-700">*</span> are required.
              </p>

              <label className="block">
                <span className={labelClass}>Parent / Guardian Name{required}</span>
                <input {...field('parentName')} required autoComplete="name" placeholder="e.g. Maria Santos" />
                {fieldError('parentName')}
              </label>

              <label className="block">
                <span className={labelClass}>Contact Number{required}</span>
                <input
                  {...field('contactNumber')}
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="09XXXXXXXXX"
                />
                {fieldError('contactNumber')}
              </label>

              <label className="block">
                <span className={labelClass}>Child&apos;s First Name{required}</span>
                <input {...field('childFirstName')} required autoComplete="off" />
                {fieldError('childFirstName')}
              </label>

              <label className="block">
                <span className={labelClass}>Child&apos;s Last Name{required}</span>
                <input {...field('childLastName')} required autoComplete="off" />
                {fieldError('childLastName')}
              </label>

              <label className="block">
                <span className={labelClass}>Nickname</span>
                <input {...field('childNickname')} autoComplete="off" placeholder="What does your child go by?" />
              </label>

              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <label className="block">
                  <span className={labelClass}>Birthday</span>
                  <input {...field('birthday')} type="date" />
                </label>

                <label className="block">
                  <span className={labelClass}>Age</span>
                  <input {...field('age')} inputMode="numeric" maxLength={2} placeholder="e.g. 5" />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Age Group / Class{required}</span>
                <select {...field('ageGroup')} required>
                  <option value="">Select age group</option>
                  {ageGroups.map((ag) => (
                    <option key={ag.id} value={ag.name}>{ag.name}</option>
                  ))}
                </select>
                {fieldError('ageGroup')}
                {ageGroupsFailed && (
                  <span role="alert" className="mt-1.5 flex items-center justify-between gap-3 text-sm font-bold text-red-700">
                    Couldn&apos;t load age groups.
                    <button type="button" onClick={loadAgeGroups} className="min-h-11 shrink-0 rounded-xl border-2 border-red-200 px-3 text-sm font-black text-red-700 hover:bg-red-50">
                      Try again
                    </button>
                  </span>
                )}
              </label>

              <label className="block">
                <span className={labelClass}>Time Slot{required}</span>
                <select {...field('timeSlot')} required>
                  <option value="">Select time slot</option>
                  {TIME_SLOTS.map((ts) => (
                    <option key={ts.value} value={ts.value}>{ts.label}</option>
                  ))}
                </select>
                {fieldError('timeSlot')}
              </label>

              <label className="block">
                <span className={labelClass}>Allergies / Special Notes</span>
                <textarea {...field('notes')} rows={3} placeholder="e.g. Allergic to peanuts" />
              </label>

              {message && (
                <p role="alert" className="rounded-2xl border-2 border-red-100 bg-red-50 p-3 text-sm font-bold text-red-800">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-brand px-4 py-4 text-lg font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
              >
                {isSubmitting ? 'Checking in…' : 'Check In'}
              </button>
            </form>
          )}
        </div>

        <div className="relative mt-4 text-center">
          <Link href="/" className="inline-block px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900">
            ← Back
          </Link>
        </div>
      </section>

      <HelpWizard title="How to register" steps={HELP_STEPS} />
    </main>
  )
}
