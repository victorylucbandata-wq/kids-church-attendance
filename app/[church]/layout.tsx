import Link from 'next/link'
import { churchBySlug } from '@/app/lib/church'
import { isKioskDevice } from '@/app/lib/kiosk'

type Props = { children: React.ReactNode; params: Promise<{ church: string }> }

// The kiosk (home, returning, first timer) only opens on a church's own check-in devices,
// so the kids list isn't public. The kiosk API checks the same thing on every request.
export default async function KioskLayout({ children, params }: Props) {
  const { church: slug } = await params
  const church = await churchBySlug(slug)
  if (!church || (await isKioskDevice(church.id))) return <>{children}</>

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-8 pb-24">
      <div className="mx-auto w-full max-w-sm card p-8 text-center">
        <div aria-hidden="true" className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 text-3xl">🔒</div>
        <p className="text-sm font-bold text-brand">{church.name}</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Check in at the kiosk</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          Check-in only works on the church&apos;s check-in device. Please use the kiosk, or ask a volunteer.
        </p>
        <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-slate-700">
          Setting up the check-in device? A Lead signs in on it, opens <b>Settings → Check-in devices</b>, and taps <b>Use this device</b>.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/admin/kiosk" className="inline-block px-4 py-3 text-sm font-bold text-brand hover:underline">Leaders</Link>
          <Link href="/?pick=1" className="inline-block px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900">Not your church?</Link>
        </div>
      </div>
    </main>
  )
}
