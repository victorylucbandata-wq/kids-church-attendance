'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } finally {
          router.push('/admin/login')
          router.refresh()
        }
      }}
      className={className ?? 'inline-block min-h-11 px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 disabled:opacity-60'}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
