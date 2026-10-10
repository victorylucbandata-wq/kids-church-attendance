'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import { inputClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import Notice from '@/app/components/Notice'
import Link from 'next/link'
import Decor from '@/app/components/Decor'

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
  const [error, setError] = useState('')

  const PAGE_SIZE = 20

  useEffect(() => {
    requestJson<{ ageGroups: AgeGroup[] }>('/api/admin/age-groups').then((res) => {
      if (res.ok) setAgeGroups(res.data.ageGroups)
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterRole) params.set('role', filterRole)
    if (filterAgeGroup) params.set('ageGroup', filterAgeGroup)
    params.set('active', filterActive)

    // Wait for a pause in typing, and drop replies for searches that are no longer current.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await requestJson<{ members: Member[] }>(`/api/admin/members?${params}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          setMembers(res.data.members)
          setError('')
        } else {
          setError(`Couldn't load members. ${res.error}`)
        }
        setLoading(false)
      } catch {
        // Aborted: a newer search is already on its way.
      }
    }, search ? 250 : 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, filterRole, filterAgeGroup, filterActive])

  const totalPages = Math.ceil(members.length / PAGE_SIZE)
  const paged = members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleToggleActive = async (member: Member) => {
    setError('')
    const res = await requestJson(`/api/admin/members/${member.id}`, {
      method: 'PATCH',
      body: { is_active: !member.is_active },
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m))
    } else {
      setError(res.error)
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">👥</span>Members</h1>
            <p className="text-sm text-slate-600">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            {/* Plain <a>: a file download, not a page navigation. */}
            <a href="/api/admin/members/export" download className="flex min-h-11 items-center whitespace-nowrap rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-brand transition hover:bg-blue-50">
              Export
            </a>
            <Link href="/admin/members/import" className="flex min-h-11 items-center whitespace-nowrap rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-brand transition hover:bg-blue-50">
              Import
            </Link>
            <button
              onClick={() => router.push('/admin/members/new')}
              className="min-h-11 whitespace-nowrap rounded-2xl bg-brand px-5 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong"
            >
              + Add Member
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 space-y-3">
          <input
            type="search"
            aria-label="Search members by name"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by name…"
            className={inputClass}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select aria-label="Filter by role" value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(0) }} className={inputClass}>
              <option value="">All roles</option>
              <option value="child">Child</option>
              <option value="volunteer">Volunteer</option>
            </select>
            <select aria-label="Filter by age group" value={filterAgeGroup} onChange={e => { setFilterAgeGroup(e.target.value); setPage(0) }} className={inputClass}>
              <option value="">All groups</option>
              {ageGroups.map(ag => (
                <option key={ag.id} value={ag.id}>{ag.name}</option>
              ))}
            </select>
            <select aria-label="Filter by status" value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(0) }} className={inputClass}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        {/* Loading */}
        {loading && (
          <p role="status" className="text-center text-sm text-slate-600 py-4">Loading members…</p>
        )}

        {/* Member list */}
        {!loading && (
          <div className="card p-4 space-y-2">
            {paged.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-6">No members found.</p>
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
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">Inactive</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{m.last_name}, {m.first_name}</p>
                  <p className="text-xs text-slate-500">
                    {m.age_group_name || '—'}
                    {m.role === 'volunteer' && ' · Volunteer'}
                  </p>
                </button>
                <button
                  onClick={() => handleToggleActive(m)}
                  aria-label={`${m.is_active ? 'Deactivate' : 'Activate'} ${m.first_name} ${m.last_name}`}
                  className={`ml-3 min-h-11 shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition ${
                    m.is_active
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-green-50 text-green-800 hover:bg-green-100'
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
                  className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-blue-50 disabled:opacity-30"
                >
                  ← Prev
                </button>
                <span className="text-xs font-bold text-slate-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-blue-50 disabled:opacity-30"
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
