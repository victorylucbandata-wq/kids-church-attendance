'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import { inputClass, labelClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import Notice from '@/app/components/Notice'
import Link from 'next/link'
import Decor from '@/app/components/Decor'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '➕',
    title: 'Adding a new member',
    body: 'Fill in the child\'s or volunteer\'s details. First name and last name are required — everything else is optional but helpful.',
  },
  {
    emoji: '🎂',
    title: 'Birthday',
    body: 'Adding a birthday lets the system highlight their name on check-in day so volunteers can greet them!',
  },
  {
    emoji: '👨‍👩‍👧',
    title: 'Parent info',
    body: 'Parent name and contact number help leaders reach the family if needed during service.',
  },
]

type AgeGroup = { id: string; name: string }

type MemberForm = {
  first_name: string
  last_name: string
  nickname: string
  birthday: string
  role: string
  age_group_id: string
  parent_name: string
  contact_number: string
  notes: string
}

const initialForm: MemberForm = {
  first_name: '',
  last_name: '',
  nickname: '',
  birthday: '',
  role: 'child',
  age_group_id: '',
  parent_name: '',
  contact_number: '',
  notes: '',
}

const fetchAgeGroups = () => requestJson<{ ageGroups: AgeGroup[] }>('/api/admin/age-groups')

export default function NewMemberPage() {
  const router = useRouter()
  const [form, setForm] = useState<MemberForm>(initialForm)
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [ageGroupsFailed, setAgeGroupsFailed] = useState(false)

  const loadAgeGroups = () =>
    fetchAgeGroups().then(res => {
      if (res.ok) setAgeGroups(res.data.ageGroups)
      setAgeGroupsFailed(!res.ok)
    })

  useEffect(() => {
    fetchAgeGroups().then(res => {
      if (res.ok) setAgeGroups(res.data.ageGroups)
      setAgeGroupsFailed(!res.ok)
    })
  }, [])

  const update = (field: keyof MemberForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) {
      setMessage('Please fill in both first name and last name.')
      return
    }
    setSaving(true)
    setMessage('')

    const res = await requestJson('/api/admin/members', { method: 'POST', body: form })
    if (res.ok) {
      router.push('/admin/members')
    } else {
      setMessage(res.error)
      setSaving(false)
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md">
        <div className="card p-6 space-y-4">
          <div className="mb-2">
            <Link href="/admin/members" className="inline-block py-3 text-sm font-bold text-brand hover:underline">← Back to Members</Link>
          </div>
          <div className="text-center mb-2">
            <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">➕</span>New Member</h1>
          </div>

          <label className="block">
            <span className={labelClass}>First Name<span aria-hidden="true" className="text-red-700"> *</span></span>
            <input value={form.first_name} onChange={e => update('first_name', e.target.value)} className={inputClass} required autoComplete="off" />
          </label>

          <label className="block">
            <span className={labelClass}>Last Name<span aria-hidden="true" className="text-red-700"> *</span></span>
            <input value={form.last_name} onChange={e => update('last_name', e.target.value)} className={inputClass} required autoComplete="off" />
          </label>

          <label className="block">
            <span className={labelClass}>Nickname</span>
            <input value={form.nickname} onChange={e => update('nickname', e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Birthday</span>
            <input type="date" value={form.birthday} onChange={e => update('birthday', e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Role</span>
            <select value={form.role} onChange={e => update('role', e.target.value)} className={inputClass}>
              <option value="child">Child</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Age Group</span>
            <select value={form.age_group_id} onChange={e => update('age_group_id', e.target.value)} className={inputClass}>
              <option value="">None</option>
              {ageGroups.map(ag => (
                <option key={ag.id} value={ag.id}>{ag.name}</option>
              ))}
            </select>
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
            <span className={labelClass}>Parent / Guardian Name</span>
            <input value={form.parent_name} onChange={e => update('parent_name', e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Contact Number</span>
            <input value={form.contact_number} onChange={e => update('contact_number', e.target.value)} className={inputClass} type="tel" inputMode="tel" />
          </label>

          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} className={inputClass} />
          </label>

          {message && (
            <Notice kind="error">{message}</Notice>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-brand px-4 py-3.5 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create Member'}
          </button>
        </div>

      </div>

      <HelpWizard title="New member guide" steps={HELP_STEPS} />
    </main>
  )
}
