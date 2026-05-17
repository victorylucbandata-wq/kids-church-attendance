'use client'

import { useEffect, useState } from 'react'

type AttendanceForm = {
    parentName: string
    contactNumber: string
    childName: string
    age: string
    ageGroup: string
    serviceSchedule: string
    firstTime: string
    notes: string
}

const initialForm: AttendanceForm = {
    parentName: '',
    contactNumber: '',
    childName: '',
    age: '',
    ageGroup: '',
    serviceSchedule: '',
    firstTime: '',
    notes: '',
}

const STORAGE_KEY = 'kids_church_attendance_details'

export default function KidsAttendancePage() {
    const [form, setForm] = useState<AttendanceForm>(initialForm)
    const [hasSavedDetails, setHasSavedDetails] = useState(false)
    const [isEditing, setIsEditing] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [justSubmitted, setJustSubmitted] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        const savedDetails = localStorage.getItem(STORAGE_KEY)

        if (!savedDetails) return

        try {
            const parsedDetails = JSON.parse(savedDetails)

            setForm((prev) => ({
                ...prev,
                ...parsedDetails,
                notes: '',
            }))

            setHasSavedDetails(true)
            setIsEditing(false)
        } catch {
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    const updateField = (field: keyof AttendanceForm, value: string) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const saveDetailsLocally = () => {
        const detailsToSave = {
            parentName: form.parentName,
            contactNumber: form.contactNumber,
            childName: form.childName,
            age: form.age,
            ageGroup: form.ageGroup,
            serviceSchedule: form.serviceSchedule,
            firstTime: form.firstTime,
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(detailsToSave))
    }

    const clearSavedDetails = () => {
        localStorage.removeItem(STORAGE_KEY)
        setForm(initialForm)
        setHasSavedDetails(false)
        setIsEditing(true)
        setJustSubmitted(false)
        setMessage('Saved details cleared.')
    }

    const submitAnotherChild = () => {
        setForm((prev) => ({
            ...prev,
            childName: '',
            age: '',
            ageGroup: '',
            firstTime: '',
            notes: '',
        }))

        setJustSubmitted(false)
        setIsEditing(true)
        setMessage('')
    }

    const handleSubmit = async () => {
        setMessage('')

        if (
            !form.parentName ||
            !form.contactNumber ||
            !form.childName ||
            !form.ageGroup ||
            !form.serviceSchedule ||
            !form.firstTime
        ) {
            setMessage('Please complete the required fields before checking in.')
            setIsEditing(true)
            setJustSubmitted(false)
            return
        }

        try {
            setIsSubmitting(true)

            const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...form,
                    source: 'QR Attendance Form',
                }),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Something went wrong.')
            }

            saveDetailsLocally()
            setHasSavedDetails(true)
            setIsEditing(false)
            setJustSubmitted(true)
            setMessage('')
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : 'Unable to submit attendance.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }

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

                    <p className="text-sm font-bold uppercase tracking-wide text-[#227EEE]">
                        Kids Church
                    </p>

                    <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                        Check-In Time!
                    </h1>

                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        Hi parents! Please confirm your child&apos;s attendance for today.
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

                                <p className="text-xl font-black text-green-800">
                                    Check-in successful!
                                </p>

                                <p className="mt-2 text-sm leading-relaxed text-green-700">
                                    Thank you. Your child&apos;s attendance has been recorded.
                                </p>
                            </div>

                            <div className="rounded-[1.5rem] border-2 border-blue-100 bg-blue-50/70 p-4 text-left">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="text-2xl">📋</span>
                                    <p className="text-sm font-black text-slate-700">
                                        Submitted Details
                                    </p>
                                </div>

                                <div className="space-y-2 rounded-2xl bg-white p-4 text-sm shadow-sm">
                                    <p>
                                        <span className="font-bold text-[#227EEE]">Parent:</span>{' '}
                                        {form.parentName}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Contact:</span>{' '}
                                        {form.contactNumber}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Child:</span>{' '}
                                        {form.childName}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Age:</span>{' '}
                                        {form.age || 'Not provided'}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">
                                            Age Group:
                                        </span>{' '}
                                        {form.ageGroup}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Service:</span>{' '}
                                        {form.serviceSchedule}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">
                                            First Time:
                                        </span>{' '}
                                        {form.firstTime}
                                    </p>

                                    {form.notes && (
                                        <p>
                                            <span className="font-bold text-[#227EEE]">Notes:</span>{' '}
                                            {form.notes}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={submitAnotherChild}
                                className="w-full rounded-2xl bg-[#227EEE] px-4 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-95"
                            >
                                Submit Another Child
                            </button>
                        </div>
                    ) : hasSavedDetails && !isEditing ? (
                        <div className="space-y-4">
                            <div className="rounded-[1.5rem] border-2 border-blue-100 bg-blue-50/70 p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="text-2xl">👋</span>
                                    <p className="text-sm font-black text-slate-700">
                                        Welcome back! Please check if these details are still
                                        correct.
                                    </p>
                                </div>

                                <div className="space-y-2 rounded-2xl bg-white p-4 text-sm shadow-sm">
                                    <p>
                                        <span className="font-bold text-[#227EEE]">Parent:</span>{' '}
                                        {form.parentName}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Contact:</span>{' '}
                                        {form.contactNumber}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Child:</span>{' '}
                                        {form.childName}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Age:</span>{' '}
                                        {form.age || 'Not provided'}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">
                                            Age Group:
                                        </span>{' '}
                                        {form.ageGroup}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">Service:</span>{' '}
                                        {form.serviceSchedule}
                                    </p>

                                    <p>
                                        <span className="font-bold text-[#227EEE]">
                                            First Time:
                                        </span>{' '}
                                        {form.firstTime}
                                    </p>
                                </div>
                            </div>

                            <label className="block">
                                <span className={labelClass}>Allergies / Special Notes</span>
                                <textarea
                                    value={form.notes}
                                    onChange={(event) => updateField('notes', event.target.value)}
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
                                {isSubmitting ? 'Submitting...' : 'Check In Now'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 font-bold text-[#227EEE]"
                            >
                                Edit Details
                            </button>

                            <button
                                type="button"
                                onClick={clearSavedDetails}
                                className="w-full text-sm font-bold text-slate-400"
                            >
                                Clear saved details
                            </button>
                        </div>
                    ) : (
                        <form
                            className="space-y-4"
                            onSubmit={(event) => event.preventDefault()}
                        >
                            <label className="block">
                                <span className={labelClass}>Parent / Guardian Name *</span>
                                <input
                                    value={form.parentName}
                                    onChange={(event) =>
                                        updateField('parentName', event.target.value)
                                    }
                                    className={inputClass}
                                    placeholder="Enter parent or guardian name"
                                />
                            </label>

                            <label className="block">
                                <span className={labelClass}>Contact Number *</span>
                                <input
                                    value={form.contactNumber}
                                    onChange={(event) =>
                                        updateField('contactNumber', event.target.value)
                                    }
                                    className={inputClass}
                                    placeholder="09XXXXXXXXX"
                                />
                            </label>

                            <label className="block">
                                <span className={labelClass}>Child Name *</span>
                                <input
                                    value={form.childName}
                                    onChange={(event) =>
                                        updateField('childName', event.target.value)
                                    }
                                    className={inputClass}
                                    placeholder="Enter child name"
                                />
                            </label>

                            <label className="block">
                                <span className={labelClass}>Child Age</span>
                                <input
                                    value={form.age}
                                    onChange={(event) => updateField('age', event.target.value)}
                                    className={inputClass}
                                    placeholder="Example: 5"
                                />
                            </label>

                            <label className="block">
                                <span className={labelClass}>Age Group / Class *</span>
                                <select
                                    value={form.ageGroup}
                                    onChange={(event) =>
                                        updateField('ageGroup', event.target.value)
                                    }
                                    className={inputClass}
                                >
                                    <option value="">Select age group</option>
                                    <option value="Toddlers">Toddlers</option>
                                    <option value="Preschool">Preschool</option>
                                    <option value="Kinder">Kinder</option>
                                    <option value="Grades 1–3">Grades 1–3</option>
                                    <option value="Grades 4–6">Grades 4–6</option>
                                    <option value="Not sure">Not sure</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className={labelClass}>Service Schedule *</span>
                                <select
                                    value={form.serviceSchedule}
                                    onChange={(event) =>
                                        updateField('serviceSchedule', event.target.value)
                                    }
                                    className={inputClass}
                                >
                                    <option value="">Select service schedule</option>
                                    <option value="Sunday Morning Service">
                                        Sunday Morning Service
                                    </option>
                                    <option value="Sunday Afternoon Service">
                                        Sunday Afternoon Service
                                    </option>
                                    <option value="Special Event">Special Event</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className={labelClass}>
                                    First time attending Kids Church? *
                                </span>
                                <select
                                    value={form.firstTime}
                                    onChange={(event) =>
                                        updateField('firstTime', event.target.value)
                                    }
                                    className={inputClass}
                                >
                                    <option value="">Select answer</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className={labelClass}>Allergies / Special Notes</span>
                                <textarea
                                    value={form.notes}
                                    onChange={(event) => updateField('notes', event.target.value)}
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
                                {isSubmitting ? 'Submitting...' : 'Check In'}
                            </button>

                            {hasSavedDetails && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 font-bold text-[#227EEE]"
                                >
                                    Cancel Editing
                                </button>
                            )}
                        </form>
                    )}

                    {message && (
                        <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-center text-sm font-bold text-slate-700">
                            {message}
                        </p>
                    )}
                </div>
            </section>
        </main>
    )
}