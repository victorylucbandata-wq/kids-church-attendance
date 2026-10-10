'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from './SignOutButton'

// The same header and tabs on every admin page, so leaders always know where they are.
const TABS = [
  { href: '/admin', emoji: '📋', label: 'Today', match: (p: string) => p === '/admin' },
  { href: '/admin/members', emoji: '👥', label: 'Members', match: (p: string) => p.startsWith('/admin/members') },
  { href: '/admin/sessions', emoji: '📅', label: 'History', match: (p: string) => p.startsWith('/admin/sessions') },
  {
    href: '/admin/settings',
    emoji: '⚙️',
    label: 'Settings',
    match: (p: string) => ['/admin/settings', '/admin/age-groups', '/admin/service-times', '/admin/team', '/admin/choose'].some((s) => p.startsWith(s)),
  },
]

const ROLE_LABEL = { lead: 'Lead', volunteer: 'Volunteer', network: 'Network admin (view only)' }

type Props = { churchName: string; email: string; role: keyof typeof ROLE_LABEL }

export default function AdminNav({ churchName, email, role }: Props) {
  const pathname = usePathname()
  return (
    <header className="bg-blue-50 px-4 pt-4">
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black text-slate-900"><span aria-hidden="true" className="mr-1.5">⛪</span>{churchName}</p>
            <p className="truncate text-sm text-slate-600">
              {email} · {ROLE_LABEL[role]}
            </p>
          </div>
          <SignOutButton className="min-h-11 shrink-0 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 disabled:opacity-60" />
        </div>

        <nav aria-label="Admin sections" className="grid grid-cols-4 gap-2">
          {TABS.map((t) => {
            const active = t.match(pathname)
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 py-1.5 text-sm font-black transition ${
                  active
                    ? 'bg-brand text-white shadow-md shadow-blue-200'
                    : 'border-2 border-blue-100 bg-white text-slate-700 hover:bg-blue-50'
                }`}
              >
                <span aria-hidden="true" className="text-lg leading-none">{t.emoji}</span>
                <span className="mt-1">{t.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
