'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputClass, labelClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import Notice from '@/app/components/Notice'

export default function NetworkActions({ churchId, name, isActive }: { churchId: string; name: string; isActive: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = async () => {
    setBusy(true)
    const res = await requestJson('/api/admin/church', { method: 'POST', body: { churchId } })
    if (res.ok) router.push('/admin')
    else {
      setError(res.error)
      setBusy(false)
    }
  }

  const toggle = async () => {
    const msg = isActive
      ? `Turn off ${name}? Its kiosk link and leader sign-in stop working. No data is deleted.`
      : `Turn ${name} back on?`
    if (!confirm(msg)) return
    setBusy(true)
    const res = await requestJson('/api/network/churches', { method: 'PATCH', body: { churchId, isActive: !isActive } })
    setBusy(false)
    if (res.ok) router.refresh()
    else setError(res.error)
  }

  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      {error && <div className="w-full"><Notice kind="error">{error}</Notice></div>}
      <button onClick={open} disabled={busy || !isActive} className="min-h-11 flex-1 rounded-xl border-2 border-blue-100 px-3 text-sm font-black text-brand hover:bg-blue-50 disabled:opacity-40 sm:flex-none">
        View dashboard
      </button>
      <button onClick={toggle} disabled={busy} className="min-h-11 flex-1 rounded-xl px-3 text-sm font-bold text-slate-600 hover:text-slate-900 sm:flex-none">
        {isActive ? 'Turn off' : 'Turn on'}
      </button>
    </div>
  )
}

const toSlug = (name: string) =>
  name.toLowerCase().replace(/^victory\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export function NewChurchForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [leadEmail, setLeadEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    const res = await requestJson<{ invited: boolean }>('/api/network/churches', { method: 'POST', body: { name, slug, leadEmail } })
    setBusy(false)
    if (!res.ok) {
      setNotice({ kind: 'error', text: res.error })
      return
    }
    setNotice({
      kind: 'success',
      text: `${name.trim()} is ready at /${slug}. ${res.data.invited ? `An invite was sent to ${leadEmail.trim()}.` : `${leadEmail.trim()} already has an account and can sign in now.`}`,
    })
    setName('')
    setSlug('')
    setSlugTouched(false)
    setLeadEmail('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="text-lg font-black text-slate-800">Add a church</h2>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <label className="block">
        <span className={labelClass}>Church name</span>
        <input
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!slugTouched) setSlug(toSlug(e.target.value))
          }}
          placeholder="e.g. Victory Antipolo"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Kiosk link</span>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-600">/</span>
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
            pattern="[a-z0-9-]{2,40}"
            placeholder="antipolo"
            className={inputClass}
          />
        </div>
        <span className="mt-1.5 block text-sm text-slate-600">What goes on this church&apos;s QR code. Lowercase letters, numbers and dashes.</span>
      </label>
      <label className="block">
        <span className={labelClass}>First Lead&apos;s email</span>
        <input
          required
          type="email"
          inputMode="email"
          value={leadEmail}
          onChange={(e) => setLeadEmail(e.target.value)}
          placeholder="kidsministry.lead@example.com"
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
      >
        {busy ? 'Creating…' : 'Create church and invite Lead'}
      </button>
    </form>
  )
}
