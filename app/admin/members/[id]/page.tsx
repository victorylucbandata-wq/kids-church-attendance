'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import { inputClass, labelClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import Notice from '@/app/components/Notice'
import Link from 'next/link'
import Decor from '@/app/components/Decor'

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
    emoji: '🗑️',
    title: 'Deleting for good',
    body: 'If a parent asks for their child\'s details to be deleted, a Lead taps "Delete permanently". Their name, birthday, contacts and notes are erased and can\'t be brought back. Past headcounts stay the same.',
  },
  {
    emoji: '🏷️',
    title: 'Age group and role',
    body: 'Change their age group as they grow up, or switch their role between child and volunteer.',
  },
]

type AgeGroup = { id: string; name: string }

// The API returns nulls for empty optional fields.
type MemberRecord = {
  [K in keyof MemberForm]: MemberForm[K] extends string ? string | null : MemberForm[K]
}

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
      requestJson<{ member: MemberRecord }>(`/api/admin/members/${id}`),
      requestJson<{ ageGroups: AgeGroup[] }>('/api/admin/age-groups'),
    ]).then(([memberRes, agRes]) => {
      if (!memberRes.ok) {
        setLoadError(memberRes.error)
        return
      }
      if (agRes.ok) setAgeGroups(agRes.data.ageGroups)
      const m = memberRes.data.member
      setForm({
        first_name: m.first_name ?? '',
        last_name: m.last_name ?? '',
        nickname: m.nickname ?? '',
        birthday: m.birthday ?? '',
        role: m.role ?? 'child',
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

  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    if (!form) return
    const who = `${form.first_name} ${form.last_name}`.trim()
    if (!confirm(`Delete ${who}'s details permanently?\n\nTheir name, birthday, parent, contact number and notes will be erased and can't be brought back. Past headcounts stay the same.`)) return
    setDeleting(true)
    setMessage('')
    const res = await requestJson(`/api/admin/members/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/admin/members')
    } else {
      setMessage(res.error)
      setDeleting(false)
    }
  }

  const handleSubmit = async () => {
    if (!form || !form.first_name || !form.last_name) {
      setMessage('Please fill in both first name and last name.')
      return
    }
    setSaving(true)
    setMessage('')

    const res = await requestJson(`/api/admin/members/${id}`, { method: 'PUT', body: form })
    if (res.ok) {
      router.push('/admin/members')
    } else {
      setMessage(res.error)
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p role="alert" className="font-black text-red-700">Couldn&apos;t load this member. {loadError}</p>
          <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-2xl bg-brand px-6 py-3 text-sm font-black text-white transition hover:bg-brand-strong">
            Try again
          </button>
          <Link href="/admin/members" className="inline-block py-3 text-sm font-bold text-brand">← Back to Members</Link>
        </div>
      </main>
    )
  }

  if (!form) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 flex items-center justify-center">
        <p role="status" className="text-sm text-slate-600">Loading member…</p>
      </main>
    )
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
            <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">✏️</span>Edit Member</h1>
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

          <label className="flex items-center gap-3 rounded-2xl border-2 border-blue-100 px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => update('is_active', e.target.checked)}
              className="h-5 w-5 rounded accent-brand"
            />
            <span className="text-sm font-bold text-slate-700">Active Member</span>
          </label>

          {message && (
            <Notice kind="error">{message}</Notice>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl bg-brand px-4 py-3.5 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        <div className="card mt-4 space-y-2 p-6">
          <p className="font-black text-slate-800">Delete permanently</p>
          <p className="text-sm text-slate-600">
            When a parent asks for their child&apos;s details to be deleted. Erases their name, birthday, parent, contact number and notes for good; past headcounts stay the same. Leads only. To just hide someone from check-in, untick Active Member instead.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            className="min-h-11 w-full rounded-2xl border-2 border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>

      </div>

      <HelpWizard title="Edit member guide" steps={HELP_STEPS} />
    </main>
  )
}
