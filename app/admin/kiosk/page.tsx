'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Decor from '@/app/components/Decor'
import Notice from '@/app/components/Notice'
import { requestJson } from '@/app/lib/api'

type Status = { thisDevice: boolean; canManage: boolean; slug: string }

const fetchStatus = () => requestJson<Status>('/api/admin/kiosk-device')

// Which devices may open the kiosk. Switched on per browser, for about a year.
export default function KioskDevicesPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const show = (res: Awaited<ReturnType<typeof fetchStatus>>) => {
    if (res.ok) setStatus(res.data)
    else setNotice({ kind: 'error', text: res.error })
  }
  useEffect(() => {
    fetchStatus().then(show)
  }, [])

  const act = async (action: 'enable' | 'reset', done: string) => {
    setBusy(true)
    setNotice(null)
    const res = await requestJson('/api/admin/kiosk-device', { method: 'POST', body: { action } })
    setBusy(false)
    if (!res.ok) return setNotice({ kind: 'error', text: res.error })
    setNotice({ kind: 'success', text: done })
    show(await fetchStatus())
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">
        <Link href="/admin/settings" className="inline-block py-3 text-sm font-bold text-brand hover:underline">← Settings</Link>
        <h1 className="text-center text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">🔒</span>Check-in devices</h1>

        <div className="card space-y-2 p-5 text-sm leading-relaxed text-slate-700">
          <p>The kiosk only opens on devices a Lead has switched on, so the list of kids isn&apos;t public.</p>
          <p>Do this once on the church&apos;s check-in tablet or phone, while signed in on it. It stays on for about a year. If the device is reset or its browser data is cleared, switch it on again here.</p>
        </div>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
        {!status && !notice && <p role="status" className="py-4 text-center text-sm text-slate-600">Loading…</p>}

        {status && (
          <div className="card space-y-3 p-5">
            <p className={`rounded-2xl px-4 py-3 text-sm font-black ${status.thisDevice ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-900'}`}>
              {status.thisDevice ? '✓ This device is switched on for check-in.' : 'This device is not switched on for check-in.'}
            </p>
            {!status.canManage && <p className="text-sm text-slate-700">Only a Lead can switch devices on or off.</p>}
            {status.canManage && !status.thisDevice && (
              <button
                onClick={() => act('enable', 'This device can now open the kiosk.')}
                disabled={busy}
                className="w-full rounded-2xl bg-brand px-4 py-3 text-base font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
              >
                Use this device for check-in
              </button>
            )}
            {status.thisDevice && (
              <Link href={`/${status.slug}`} className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm font-black text-brand hover:bg-blue-50">
                Open the kiosk →
              </Link>
            )}
            {status.canManage && (
              <button
                onClick={() => {
                  if (confirm('Switch off every check-in device, including this one? Each one will need switching on again.')) {
                    act('reset', 'All check-in devices are switched off.')
                  }
                }}
                disabled={busy}
                className="min-h-11 w-full rounded-2xl border-2 border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Switch off all devices
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
