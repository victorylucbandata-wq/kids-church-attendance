'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '👥',
    title: 'Member list',
    body: 'This page shows all registered kids and volunteers. Use the search bar and filters to find someone quickly.',
  },
  {
    emoji: '🔍',
    title: 'Search and filter',
    body: 'Type a name to search. Filter by role (child/volunteer), age group, or active status. Results update instantly.',
  },
  {
    emoji: '✏️',
    title: 'Edit a member',
    body: 'Tap a member\'s name to open their profile and update their details — name, birthday, age group, parent info, and more.',
  },
  {
    emoji: '➕',
    title: 'Add a member',
    body: 'Tap "+ Add Member" to register a new child or volunteer. Fill in their details and they\'ll appear in the check-in list.',
  },
]

type Member = {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  birthday: string | null
  role: string
  age_group_id: string | null
  age_group_name: string
  parent_name: string | null
  contact_number: string | null
  is_active: boolean
}

type AgeGroup = { id: string; name: string }

export default function MembersPage() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([])
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterAgeGroup, setFilterAgeGroup] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 20

  useEffect(() => {
    fetch('/api/admin/age-groups').then(r => r.json()).then(d => {
      if (d.success) setAgeGroups(d.ageGroups)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterRole) params.set('role', filterRole)
    if (filterAgeGroup) params.set('ageGroup', filterAgeGroup)
    params.set('active', filterActive)

    fetch(`/api/admin/members?${params}`).then(r => r.json()).then(d => {
      if (d.success) setMembers(d.members)
      setLoading(false)
    })
  }, [search, filterRole, filterAgeGroup, filterActive])

  const totalPages = Math.ceil(members.length / PAGE_SIZE)
  const paged = members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleToggleActive = async (member: Member) => {
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !member.is_active }),
    })
    const data = await res.json()
    if (data.success) {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m))
    }
  }

  const inputClass = 'w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#227EEE] focus:ring-4 focus:ring-blue-100'

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">

        <div className="flex gap-2">
          <a href="/admin" className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
            ← Dashboard
          </a>
          <a href="/admin/age-groups" className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
            Age Groups
          </a>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Members</h1>
            <p className="text-sm text-slate-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => router.push('/admin/members/new')}
            className="rounded-2xl bg-[#227EEE] px-5 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:brightness-95"
          >
            + Add Member
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-lg shadow-blue-100/50 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by name…"
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(0) }} className={inputClass}>
              <option value="">All roles</option>
              <option value="child">Child</option>
              <option value="volunteer">Volunteer</option>
            </select>
            <select value={filterAgeGroup} onChange={e => { setFilterAgeGroup(e.target.value); setPage(0) }} className={inputClass}>
              <option value="">All groups</option>
              {ageGroups.map(ag => (
                <option key={ag.id} value={ag.id}>{ag.name}</option>
              ))}
            </select>
            <select value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(0) }} className={inputClass}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <p className="text-center text-sm text-slate-400 py-4">Loading…</p>
        )}

        {/* Member list */}
        {!loading && (
          <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-lg shadow-blue-100/50 space-y-2">
            {paged.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">No members found.</p>
            )}
            {paged.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-2xl border-2 border-blue-50 bg-white px-4 py-3 hover:bg-blue-50/50 transition"
              >
                <button
                  onClick={() => router.push(`/admin/members/${m.id}`)}
                  className="flex-1 text-left"
                >
                  <p className="font-black text-slate-800 text-sm">
                    {m.nickname || m.first_name}
                    {!m.is_active && (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">Inactive</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{m.last_name}, {m.first_name}</p>
                  <p className="text-xs text-slate-400">
                    {m.age_group_name || '—'}
                    {m.role === 'volunteer' && ' · Volunteer'}
                  </p>
                </button>
                <button
                  onClick={() => handleToggleActive(m)}
                  className={`ml-3 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    m.is_active
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {m.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-blue-50 disabled:opacity-30"
                >
                  ← Prev
                </button>
                <span className="text-xs font-bold text-slate-400">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-blue-50 disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      <HelpWizard title="Members guide" steps={HELP_STEPS} />
    </main>
  )
}
