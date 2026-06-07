'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '✏️',
    title: 'Editing a member',
    body: 'Update any of the member\'s details and tap "Save Changes". First name and last name are required.',
  },
  {
    emoji: '🔄',
    title: 'Active status',
    body: 'Uncheck "Active Member" to hide them from the check-in list without deleting their record. You can reactivate them anytime.',
  },
  {
    emoji: '🏷️',
    title: 'Age group and role',
    body: 'Change their age group as they grow up, or switch their role between child and volunteer.',
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
  is_active: boolean
}

export default function EditMemberPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [form, setForm] = useState<MemberForm | null>(null)
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/members/${id}`).then(r => r.json()),
      fetch('/api/admin/age-groups').then(r => r.json()),
    ]).then(([memberRes, agRes]) => {
      if (!memberRes.success) {
        setLoadError(memberRes.error || 'Member not found.')
        return
      }
      if (agRes.success) setAgeGroups(agRes.ageGroups)
      const m = memberRes.member
      setForm({
        first_name: m.first_name,
        last_name: m.last_name,
        nickname: m.nickname ?? '',
        birthday: m.birthday ?? '',
        role: m.role,
        age_group_id: m.age_group_id ?? '',
        parent_name: m.parent_name ?? '',
        contact_number: m.contact_number ?? '',
        notes: m.notes ?? '',
        is_active: m.is_active,
      })
    })
  }, [id])

  const update = (field: keyof MemberForm, value: string | boolean) => {
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const handleSubmit = async () => {
    if (!form || !form.first_name || !form.last_name) {
      setMessage('First name and last name are required.')
      return
    }
    setSaving(true)
    setMessage('')

    const res = await fetch(`/api/admin/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (data.success) {
      router.push('/admin/members')
    } else {
      setMessage(data.error || 'Failed to update member.')
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#227EEE] focus:ring-4 focus:ring-blue-100'
  const labelClass = 'mb-1.5 block text-sm font-bold text-slate-700'

  if (loadError) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="font-black text-red-700">{loadError}</p>
          <a href="/admin/members" className="text-sm font-bold text-[#227EEE]">← Back to Members</a>
        </div>
      </main>
    )
  }

  if (!form) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-100/70 space-y-4">
          <div className="mb-2">
            <a href="/admin/members" className="text-sm font-bold text-[#227EEE] hover:underline">← Back to Members</a>
          </div>
          <div className="text-center mb-2">
            <h1 className="text-2xl font-black text-slate-900">Edit Member</h1>
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

          <label className="flex items-center gap-3 rounded-2xl border-2 border-blue-100 px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => update('is_active', e.target.checked)}
              className="h-5 w-5 rounded accent-[#227EEE]"
            />
            <span className="text-sm font-bold text-slate-700">Active Member</span>
          </label>

          {message && (
            <p className="rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">{message}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-[#227EEE] px-4 py-3.5 font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-95 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </div>

      <HelpWizard title="Edit member guide" steps={HELP_STEPS} />
    </main>
  )
}
