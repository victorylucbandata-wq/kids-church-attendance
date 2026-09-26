'use client'

import { Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { inputClass } from '@/app/lib/ui'
import { LAST_CHURCH_KEY } from '@/app/components/RememberChurch'

type Church = { name: string; slug: string }

const noSubscribe = () => () => {}
const readRemembered = () => {
  try {
    return localStorage.getItem(LAST_CHURCH_KEY) ?? ''
  } catch {
    return ''  // storage blocked: behave as if nothing is remembered
  }
}

export default function ChurchPicker(props: { churches: Church[] }) {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense>
      <Picker {...props} />
    </Suspense>
  )
}

function Picker({ churches }: { churches: Church[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState('')
  // null during server render, then this phone's remembered church ('' if none).
  const remembered = useSyncExternalStore(noSubscribe, readRemembered, () => null)
  const picking = !!params.get('pick')
  const goTo = !picking && remembered && churches.some((c) => c.slug === remembered) ? remembered : null

  // Returning phones go straight to their church; "Not your church?" (?pick=1) forgets it.
  useEffect(() => {
    if (goTo) router.replace(`/${goTo}`)
    else if (picking) {
      try {
        localStorage.removeItem(LAST_CHURCH_KEY)
      } catch {
        // storage blocked: nothing to forget
      }
    }
  }, [goTo, picking, router])

  if (remembered === null || goTo) return <p role="status" className="py-6 text-center text-sm text-slate-600">Opening your church…</p>

  const shown = churches.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="space-y-3">
      {churches.length > 6 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search churches"
          placeholder="Search by church name…"
          className={inputClass}
        />
      )}
      {shown.map((c) => (
        <Link
          key={c.slug}
          href={`/${c.slug}`}
          className="flex min-h-[64px] w-full items-center justify-between rounded-2xl border-2 border-blue-100 bg-white px-5 py-4 shadow-md transition hover:border-brand hover:bg-blue-50"
        >
          <span className="text-lg font-black text-slate-800">{c.name}</span>
          <span aria-hidden="true" className="text-xl text-brand">→</span>
        </Link>
      ))}
      {shown.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-600">
          {churches.length === 0 ? 'No churches are set up yet.' : 'No church matches that name.'}
        </p>
      )}
    </div>
  )
}
