'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputClass } from '@/app/lib/ui'
import Link from 'next/link'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Incorrect password.')
        return
      }

      router.push('/admin')
    } catch {
      setError('Unable to connect. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4">
      <div className="w-full max-w-sm card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl shadow-lg shadow-blue-200">
            <span aria-hidden="true">🔐</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Admin Access</h1>
          <p className="mt-1 text-sm text-slate-500">Kids Church Attendance</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Enter admin password"
              autoFocus
            />
          </label>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full rounded-2xl bg-brand px-4 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-block px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900">
            ← Back to Check-In
          </Link>
        </div>
      </div>
    </main>
  )
}
