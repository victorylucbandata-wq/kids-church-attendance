import Link from 'next/link'
import { listAccess, requireAdminPage } from '@/app/lib/church'
import Decor from '@/app/components/Decor'

// Things a lead sets up once and rarely touches on a Sunday.
export default async function SettingsPage() {
  const ctx = await requireAdminPage()
  const { churches } = await listAccess(ctx.userId)

  const items = [
    { href: '/admin/age-groups', emoji: '🏷️', label: 'Age Groups', desc: 'The groups kids are sorted into, like Preschool and Preteens.', show: true },
    { href: '/admin/service-times', emoji: '🕘', label: 'Service Times', desc: 'Your service times, and when check-in opens and closes on Sundays.', show: true },
    { href: '/admin/kiosk', emoji: '🔒', label: 'Check-in devices', desc: 'Choose which tablets or phones can open the kiosk.', show: ctx.role === 'lead' },
    { href: '/admin/team', emoji: '🔑', label: 'Team', desc: 'Who can sign in here. Invite or remove leaders and volunteers.', show: ctx.role === 'lead' },
    { href: '/admin/choose', emoji: '🔄', label: 'Switch church', desc: 'Open another church you help with.', show: churches.length > 1 || ctx.isNetworkAdmin },
    { href: '/network', emoji: '🌏', label: 'Network overview', desc: 'Every church at a glance, and the combined export.', show: ctx.isNetworkAdmin },
  ].filter((i) => i.show)

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">
        <h1 className="text-center text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">⚙️</span>Settings</h1>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="card flex items-center gap-4 p-4 transition hover:bg-blue-50">
            <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-2xl">{i.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-slate-900">{i.label}</span>
              <span className="block text-sm text-slate-600">{i.desc}</span>
            </span>
            <span aria-hidden="true" className="text-xl text-brand">→</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
