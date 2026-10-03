'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestJson } from '@/app/lib/api'
import Notice from '@/app/components/Notice'

type Choice = { id: string; name: string; role: 'lead' | 'volunteer' }

export default function ChurchChoice({ churches }: { churches: Choice[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const pick = async (id: string) => {
    setBusy(id)
    setError('')
    const res = await requestJson('/api/admin/church', { method: 'POST', body: { churchId: id } })
    if (res.ok) {
      router.push('/admin')
      router.refresh()
    } else {
      setError(res.error)
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && <Notice kind="error">{error}</Notice>}
      {churches.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => pick(c.id)}
          disabled={busy !== null}
          className="flex min-h-[72px] w-full items-center justify-between rounded-2xl border-2 border-blue-100 bg-white px-5 py-4 text-left shadow-md transition hover:border-brand hover:bg-blue-50 disabled:opacity-60"
        >
          <span>
            <span className="block text-lg font-black text-slate-800">{c.name}</span>
            <span className="block text-sm text-slate-600">{c.role === 'lead' ? 'Lead' : 'Volunteer'}</span>
          </span>
          <span className="text-sm font-black text-brand">{busy === c.id ? 'Opening…' : 'Open →'}</span>
        </button>
      ))}
    </div>
  )
}
