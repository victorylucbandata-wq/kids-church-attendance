'use client'

import { useEffect, useState } from 'react'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'

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

export default function AgeGroupsPage() {
  const [groups, setGroups] = useState<AgeGroup[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    fetch('/api/admin/age-groups').then(r => r.json()).then(d => {
      if (d.success) setGroups(d.ageGroups)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const flash = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    const res = await fetch('/api/admin/age-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      setNewName('')
      load()
      flash('Age group added.')
    } else {
      flash(data.error)
    }
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    const res = await fetch(`/api/admin/age-groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      setEditingId(null)
      load()
      flash('Renamed.')
    } else {
      flash(data.error)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/age-groups/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      load()
      flash('Deleted.')
    } else {
      flash(data.error)
    }
  }

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = groups.findIndex(g => g.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= groups.length) return

    const a = groups[idx]
    const b = groups[swapIdx]

    await Promise.all([
      fetch(`/api/admin/age-groups/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
      fetch(`/api/admin/age-groups/${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
    ])
    load()
  }

  const inputClass = 'w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#227EEE] focus:ring-4 focus:ring-blue-100'

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">

        <div className="flex gap-2">
          <a href="/admin" className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
            ← Dashboard
          </a>
          <a href="/admin/members" className="flex-1 rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-center text-sm font-black text-[#227EEE] transition hover:bg-blue-50">
            Members
          </a>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900">Age Groups</h1>
        </div>

        {message && (
          <div className="rounded-2xl bg-green-500 px-4 py-2 text-center text-sm font-black text-white">
            {message}
          </div>
        )}

        {/* Add new */}
        <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-lg shadow-blue-100/50 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Add New</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Primary"
              className={inputClass}
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="rounded-2xl bg-[#227EEE] px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:brightness-95 disabled:opacity-40 whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-lg shadow-blue-100/50 space-y-2">
          {loading && <p className="text-center text-sm text-slate-400 py-4">Loading…</p>}

          {!loading && groups.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-4">No age groups yet.</p>
          )}

          {groups.map((g, i) => (
            <div key={g.id} className="flex items-center gap-2 rounded-2xl border-2 border-blue-50 bg-white px-4 py-3">
              {editingId === g.id ? (
                <>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(g.id)}
                    className="flex-1 rounded-xl border-2 border-blue-200 px-3 py-1.5 text-sm outline-none"
                    autoFocus
                  />
                  <button onClick={() => handleRename(g.id)} className="text-xs font-bold text-[#227EEE]">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs font-bold text-slate-400">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-black text-slate-800 text-sm">{g.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMove(g.id, 'up')}
                      disabled={i === 0}
                      className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-blue-50 disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(g.id, 'down')}
                      disabled={i === groups.length - 1}
                      className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-blue-50 disabled:opacity-20"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => { setEditingId(g.id); setEditName(g.name) }}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-[#227EEE] hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50"
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
