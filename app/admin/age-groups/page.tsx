'use client'

import { useEffect, useState } from 'react'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import { inputClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import Notice from '@/app/components/Notice'
import Link from 'next/link'
import Decor from '@/app/components/Decor'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '🏷️',
    title: 'Age groups',
    body: 'Age groups organize kids by age during check-in. Parents pick their child\'s age group before selecting a name.',
  },
  {
    emoji: '➕',
    title: 'Adding a group',
    body: 'Type the name (e.g. "Primary", "Toddlers") and tap Add. New groups appear at the bottom of the list.',
  },
  {
    emoji: '↕️',
    title: 'Reorder and manage',
    body: 'Use the ↑ ↓ arrows to change the display order. Tap Edit to rename, or Delete to remove (only if no members are assigned).',
  },
]

type AgeGroup = { id: string; name: string; sort_order: number }

const fetchAgeGroups = () => requestJson<{ ageGroups: AgeGroup[] }>('/api/admin/age-groups')

export default function AgeGroupsPage() {
  const [groups, setGroups] = useState<AgeGroup[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const flash = (kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text })
    if (kind === 'success') setTimeout(() => setNotice(null), 3000)
  }

  const showLoaded = (res: Awaited<ReturnType<typeof fetchAgeGroups>>) => {
    if (res.ok) setGroups(res.data.ageGroups)
    else flash('error', `Couldn't load age groups. ${res.error}`)
    setLoading(false)
  }

  const load = async () => showLoaded(await fetchAgeGroups())

  useEffect(() => {
    fetchAgeGroups().then((res) => {
      if (res.ok) setGroups(res.data.ageGroups)
      else setNotice({ kind: 'error', text: `Couldn't load age groups. ${res.error}` })
      setLoading(false)
    })
  }, [])

  // Runs one change, reloads the list, and reports the outcome.
  const mutate = async (url: string, method: string, body: unknown, success: string) => {
    setBusy(true)
    setNotice(null)
    const res = await requestJson(url, { method, body })
    setBusy(false)
    if (!res.ok) {
      flash('error', res.error)
      return false
    }
    await load()
    flash('success', success)
    return true
  }

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (await mutate('/api/admin/age-groups', 'POST', { name }, `Added “${name}”.`)) setNewName('')
  }

  const handleRename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    if (await mutate(`/api/admin/age-groups/${id}`, 'PUT', { name }, `Renamed to “${name}”.`)) setEditingId(null)
  }

  const handleDelete = async (group: AgeGroup) => {
    if (!confirm(`Delete the “${group.name}” age group? This can't be undone.`)) return
    await mutate(`/api/admin/age-groups/${group.id}`, 'DELETE', undefined, `Deleted “${group.name}”.`)
  }

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = groups.findIndex(g => g.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= groups.length) return

    const a = groups[idx]
    const b = groups[swapIdx]

    setBusy(true)
    setNotice(null)
    const results = await Promise.all([
      requestJson(`/api/admin/age-groups/${a.id}`, { method: 'PUT', body: { sort_order: b.sort_order } }),
      requestJson(`/api/admin/age-groups/${b.id}`, { method: 'PUT', body: { sort_order: a.sort_order } }),
    ])
    setBusy(false)
    const failed = results.find(r => !r.ok)
    if (failed && !failed.ok) flash('error', `Couldn't reorder. ${failed.error}`)
    await load()
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">

        <div className="flex gap-2">
          <Link href="/admin" className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">
            ← Dashboard
          </Link>
          <Link href="/admin/members" className="flex min-h-11 flex-1 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-brand transition hover:bg-blue-50">
            Members
          </Link>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">🏷️</span>Age Groups</h1>
        </div>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        {/* Add new */}
        <div className="card p-4 space-y-3">
          <label htmlFor="new-age-group" className="block text-sm font-bold text-slate-700">Add a new age group</label>
          <div className="flex gap-2">
            <input
              id="new-age-group"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Primary"
              className={inputClass}
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || busy}
              className="rounded-2xl bg-brand px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-40 whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="card p-4 space-y-2">
          {loading && <p className="text-center text-sm text-slate-500 py-4">Loading…</p>}

          {!loading && groups.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-4">No age groups yet.</p>
          )}

          {groups.map((g, i) => (
            <div key={g.id} className="flex items-center gap-2 rounded-2xl border-2 border-blue-50 bg-white px-4 py-3">
              {editingId === g.id ? (
                <>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(g.id)}
                    aria-label="Age group name"
                    className="min-w-0 flex-1 rounded-xl border-2 border-blue-200 px-3 py-2 text-base outline-none focus:border-brand"
                    autoFocus
                  />
                  <button onClick={() => handleRename(g.id)} className="min-h-11 px-2 text-sm font-bold text-brand">Save</button>
                  <button onClick={() => setEditingId(null)} className="min-h-11 px-2 text-sm font-bold text-slate-600">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-black text-slate-800 text-sm">{g.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMove(g.id, 'up')}
                      aria-label={`Move ${g.name} up`}
                      disabled={i === 0 || busy}
                      className="min-h-11 min-w-11 rounded-lg px-2 text-base text-slate-600 hover:bg-blue-50 disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(g.id, 'down')}
                      aria-label={`Move ${g.name} down`}
                      disabled={i === groups.length - 1 || busy}
                      className="min-h-11 min-w-11 rounded-lg px-2 text-base text-slate-600 hover:bg-blue-50 disabled:opacity-20"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => { setEditingId(g.id); setEditName(g.name) }}
                      className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g)}
                      disabled={busy}
                      className="min-h-11 rounded-lg px-3 text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

      </div>

      <HelpWizard title="Age groups guide" steps={HELP_STEPS} />
    </main>
  )
}
