'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import Decor from '@/app/components/Decor'
import Notice from '@/app/components/Notice'
import { inputClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '👥',
    title: 'Your team',
    body: 'Everyone listed here can sign in and run check-in for this church. Only Leads see this page.',
  },
  {
    emoji: '✉️',
    title: 'Inviting someone',
    body: 'Enter their email and choose a role. New people get an email with a sign-in link. People who already have an account can sign in right away.',
  },
  {
    emoji: '🧭',
    title: 'Lead or Volunteer',
    body: 'Both can check kids in and out and manage members, age groups and service times. Only Leads can invite or remove people.',
  },
  {
    emoji: '🚪',
    title: 'Removing someone',
    body: 'They lose access the next time they open a page. A church always keeps at least one Lead.',
  },
]

type Member = { userId: string; email: string; role: 'lead' | 'volunteer'; isYou: boolean }

const fetchTeam = () => requestJson<{ team: Member[] }>('/api/admin/team')

export default function TeamPage() {
  const [team, setTeam] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'volunteer' | 'lead'>('volunteer')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    const res = await fetchTeam()
    if (res.ok) setTeam(res.data.team)
    else setNotice({ kind: 'error', text: res.error })
    setLoading(false)
  }

  useEffect(() => {
    fetchTeam().then((res) => {
      if (res.ok) setTeam(res.data.team)
      else setNotice({ kind: 'error', text: res.error })
      setLoading(false)
    })
  }, [])

  const run = async (method: string, body: unknown, success: (data: { invited?: boolean }) => string) => {
    setBusy(true)
    setNotice(null)
    const res = await requestJson<{ invited?: boolean }>('/api/admin/team', { method, body })
    setBusy(false)
    if (!res.ok) {
      setNotice({ kind: 'error', text: res.error })
      return false
    }
    await load()
    setNotice({ kind: 'success', text: success(res.data) })
    return true
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = email.trim()
    const ok = await run('POST', { email: address, role }, (d) =>
      d.invited ? `Invite sent to ${address}.` : `${address} already has an account and can sign in now.`
    )
    if (ok) setEmail('')
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">
        <Link href="/admin/settings" className="inline-block py-3 text-sm font-bold text-brand hover:underline">← Settings</Link>

        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">🔑</span>Team</h1>
        </div>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <form onSubmit={invite} className="card space-y-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Invite by email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="volunteer@example.com"
              className={inputClass}
            />
          </label>
          <fieldset className="flex gap-2">
            <legend className="sr-only">Role</legend>
            {(['volunteer', 'lead'] as const).map((r) => (
              <label
                key={r}
                className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-2xl border-2 px-3 text-sm font-black transition ${
                  role === r ? 'border-brand bg-blue-50 text-brand' : 'border-blue-100 bg-white text-slate-700'
                }`}
              >
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                {r === 'lead' ? 'Lead' : 'Volunteer'}
              </label>
            ))}
          </fieldset>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
          >
            {busy ? 'Working…' : 'Send invite'}
          </button>
        </form>

        <div className="card space-y-2 p-4">
          {loading && <p role="status" className="py-4 text-center text-sm text-slate-600">Loading…</p>}
          {team.map((m) => (
            <div key={m.userId} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-blue-50 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-800">
                  {m.email}
                  {m.isYou && <span className="ml-2 text-xs font-bold text-slate-600">(you)</span>}
                </p>
                <p className="text-xs font-bold text-slate-600">{m.role === 'lead' ? 'Lead' : 'Volunteer'}</p>
              </div>
              <button
                onClick={() =>
                  run('PATCH', { userId: m.userId, role: m.role === 'lead' ? 'volunteer' : 'lead' }, () =>
                    `${m.email} is now a ${m.role === 'lead' ? 'Volunteer' : 'Lead'}.`
                  )
                }
                disabled={busy}
                className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand hover:bg-blue-50"
              >
                {m.role === 'lead' ? 'Make Volunteer' : 'Make Lead'}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove ${m.email} from this church? They lose access right away.`)) {
                    run('DELETE', { userId: m.userId }, () => `Removed ${m.email}.`)
                  }
                }}
                disabled={busy}
                className="min-h-11 rounded-lg px-3 text-sm font-bold text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <HelpWizard title="Team guide" steps={HELP_STEPS} />
    </main>
  )
}
