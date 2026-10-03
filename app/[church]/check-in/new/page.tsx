'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

type FirstTimerForm = {
  parentName: string
  contactNumber: string
  childFirstName: string
  childLastName: string
  childNickname: string
  age: string
  /** Age group id. */
  ageGroup: string
  /** Service time id. */
  timeSlot: string
  birthday: string
  notes: string
}

type Option = { id: string; name: string }
type Setup = { church: { name: string }; ageGroups: Option[]; serviceTimes: { id: string; label: string }[] }

const fetchSetup = (slug: string) => requestJson<Setup>(`/api/kiosk/${slug}/setup`)

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
  const { church: slug } = useParams<{ church: string }>()
  const [form, setForm] = useState<FirstTimerForm>(initialForm)
  const [ageGroups, setAgeGroups] = useState<Option[]>([])
  const [serviceTimes, setServiceTimes] = useState<Setup['serviceTimes']>([])
  const [ageGroupsFailed, setAgeGroupsFailed] = useState(false)
  const [churchName, setChurchName] = useState('')
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [countdown, setCountdown] = useState(4)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // A failed load would leave the required Age Group empty, so offer a retry instead.
  const applySetup = (res: Awaited<ReturnType<typeof fetchSetup>>) => {
    if (res.ok) {
      setChurchName(res.data.church.name)
      setAgeGroups(res.data.ageGroups)
      setServiceTimes(res.data.serviceTimes)
    }
    setAgeGroupsFailed(!res.ok)
  }
  const loadAgeGroups = () => fetchSetup(slug).then(applySetup)

  useEffect(() => {
    fetchSetup(slug).then((res) => {
      if (res.ok) {
        setChurchName(res.data.church.name)
        setAgeGroups(res.data.ageGroups)
        setServiceTimes(res.data.serviceTimes)
      }
      setAgeGroupsFailed(!res.ok)
    })
  }, [slug])

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
      setConsent(false)
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
    if (!consent) {
      setConsentError(true)
      setMessage('Please read the privacy notice and tick the box to continue.')
      document.getElementById('consent')?.focus()
      return
    }

    try {
      setIsSubmitting(true)

      const { ageGroup, timeSlot, ...rest } = form
      const res = await fetch(`/api/kiosk/${slug}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, ageGroupId: ageGroup, serviceTimeId: timeSlot, consent }),
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
    ['Group', ageGroups.find((g) => g.id === form.ageGroup)?.name ?? ''],
    ['Time slot', serviceTimes.find((t) => t.id === form.timeSlot)?.label ?? ''],
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
                    <option key={ag.id} value={ag.id}>{ag.name}</option>
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
                  {serviceTimes.map((ts) => (
                    <option key={ts.id} value={ts.id}>{ts.label}</option>
                  ))}
                </select>
                {fieldError('timeSlot')}
              </label>

              <label className="block">
                <span className={labelClass}>Allergies / Special Notes</span>
                <textarea {...field('notes')} rows={3} placeholder="e.g. Allergic to peanuts" />
              </label>

              {/* Data Privacy Act (RA 10173): tell parents what we collect and why, and get their consent. */}
              <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/60 p-4 text-sm leading-relaxed text-slate-700">
                <p className="font-black text-slate-900">Privacy notice</p>
                <p className="mt-1">
                  {churchName || 'Our church'} keeps your child&apos;s details, your name and contact number, and any notes
                  (including allergies) only to check your child in and keep them safe during service. Only our Kids Church
                  leaders can see them, and they are not shared outside the church. To see, correct or delete your
                  details, talk to any Kids Church leader.
                </p>
                <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 font-bold text-slate-900">
                  <input
                    id="consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => { setConsent(e.target.checked); setConsentError(false) }}
                    aria-invalid={consentError || undefined}
                    className="mt-0.5 h-6 w-6 shrink-0 accent-brand"
                  />
                  <span>I am the parent or guardian, and I agree to this use of my child&apos;s information.{required}</span>
                </label>
              </div>

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
          <Link href={`/${slug}`} className="inline-block px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900">
            ← Back
          </Link>
        </div>
      </section>

      <HelpWizard title="How to register" steps={HELP_STEPS} />
    </main>
  )
}
