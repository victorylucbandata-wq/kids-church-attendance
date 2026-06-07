'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

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

export default function NewMemberPage() {
  const router = useRouter()
  const [form, setForm] = useState<MemberForm>(initialForm)
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/age-groups').then(r => r.json()).then(d => {
      if (d.success) setAgeGroups(d.ageGroups)
    })
  }, [])

  const update = (field: keyof MemberForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) {
      setMessage('First name and last name are required.')
      return
    }
    setSaving(true)
    setMessage('')

    const res = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (data.success) {
      router.push('/admin/members')
    } else {
      setMessage(data.error || 'Failed to create member.')
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#227EEE] focus:ring-4 focus:ring-blue-100'
  const labelClass = 'mb-1.5 block text-sm font-bold text-slate-700'

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-100/70 space-y-4">
          <div className="mb-2">
            <a href="/admin/members" className="text-sm font-bold text-[#227EEE] hover:underline">← Back to Members</a>
          </div>
          <div className="text-center mb-2">
            <h1 className="text-2xl font-black text-slate-900">New Member</h1>
          </div>

          <label className="block">
            <span className={labelClass}>First Name *</span>
            <input value={form.first_name} onChange={e => update('first_name', e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Last Name *</span>
            <input value={form.last_name} onChange={e => update('last_name', e.target.value)} className={inputClass} />
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
          </label>

          <label className="block">
            <span className={labelClass}>Parent / Guardian Name</span>
            <input value={form.parent_name} onChange={e => update('parent_name', e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Contact Number</span>
            <input value={form.contact_number} onChange={e => update('contact_number', e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} className={inputClass} />
          </label>

          {message && (
            <p className="rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">{message}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-[#227EEE] px-4 py-3.5 font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-95 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create Member'}
          </button>
        </div>

      </div>

      <HelpWizard title="New member guide" steps={HELP_STEPS} />
    </main>
  )
}
