'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { inputClass } from '@/app/lib/ui'
import { requestJson } from '@/app/lib/api'
import Notice from '@/app/components/Notice'

export default function AdminLoginPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [sharedDevice, setSharedDevice] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)

  const banner = params.get('expired')
    ? 'Your session ended. Sign in again to continue.'
    : params.get('link') === 'invalid'
      ? 'That sign-in link has expired or was already used. Request a new one below.'
      : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSending(true)
    const res = await requestJson('/api/auth/login', { method: 'POST', body: { email, sharedDevice } })
    setIsSending(false)
    if (res.ok) setSentTo(email.trim())
    else setError(res.error)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div aria-hidden="true" className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl shadow-lg shadow-blue-200">
            🔐
          </div>
          <h1 className="text-2xl font-black text-slate-900">Leader sign-in</h1>
          <p className="mt-1 text-sm text-slate-600">Kids Church Attendance</p>
        </div>

        {sentTo ? (
          <div className="space-y-4 text-center" role="status">
            <div aria-hidden="true" className="text-4xl">📬</div>
            <p className="font-black text-slate-800">Check your email</p>
            <p className="text-sm leading-relaxed text-slate-600">
              If <span className="font-bold text-slate-800">{sentTo}</span> has access, a sign-in link is on its way. Open it on this device. It works once and expires within an hour.
            </p>
            <button
              type="button"
              onClick={() => setSentTo('')}
              className="min-h-11 text-sm font-bold text-brand hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {banner && <Notice kind="error">{banner}</Notice>}

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Email address</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                autoFocus
              />
            </label>

            <label className="flex min-h-11 items-start gap-3 rounded-2xl border-2 border-blue-100 px-4 py-3">
              <input
                type="checkbox"
                checked={sharedDevice}
                onChange={(e) => setSharedDevice(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-brand"
              />
              <span>
                <span className="block text-sm font-bold text-slate-700">This is a shared device</span>
                <span className="block text-sm text-slate-600">Signs you out after 12 hours instead of 30 days.</span>
              </span>
            </label>

            {error && <Notice kind="error">{error}</Notice>}

            <button
              type="submit"
              disabled={isSending || !email.trim()}
              className="w-full rounded-2xl bg-brand px-4 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
            >
              {isSending ? 'Sending link…' : 'Email me a sign-in link'}
            </button>

            <p className="text-center text-sm text-slate-600">
              No password needed. Only people invited by their church can sign in.
            </p>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="inline-block px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900">
            ← Back to Check-In
          </Link>
        </div>
      </div>
    </main>
  )
}
