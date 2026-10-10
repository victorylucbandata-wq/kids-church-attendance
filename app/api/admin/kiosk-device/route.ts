import { cookies } from 'next/headers'
import { adminApi } from '@/app/lib/church'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { isKioskDevice } from '@/app/lib/kiosk'
import { KIOSK_COOKIE } from '@/app/lib/cookie-names'

// About 400 days, the longest a browser keeps a cookie; switching it on again renews it.
const DEVICE_MAX_AGE = 400 * 24 * 60 * 60

// Is this browser one of the church's check-in devices?
export async function GET() {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx
  return Response.json({ success: true, thisDevice: await isKioskDevice(ctx.church.id), canManage: ctx.role === 'lead', slug: ctx.church.slug })
}

// Leads only. `enable`: make this browser a check-in device. `reset`: switch every device off.
export async function POST(request: Request) {
  const ctx = await adminApi({ lead: true })
  if (ctx instanceof Response) return ctx
  const { action } = (await request.json().catch(() => ({}))) as { action?: string }
  const admin = createAdminClient()
  const store = await cookies()

  if (action === 'enable') {
    const { data } = await admin.from('churches').select('kiosk_key').eq('id', ctx.church.id).single()
    store.set(KIOSK_COOKIE, `${ctx.church.id}.${data!.kiosk_key}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DEVICE_MAX_AGE,
    })
    return Response.json({ success: true })
  }

  if (action === 'reset') {
    const { error } = await admin.from('churches').update({ kiosk_key: crypto.randomUUID() }).eq('id', ctx.church.id)
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
    store.delete(KIOSK_COOKIE)
    return Response.json({ success: true })
  }

  return Response.json({ success: false, error: 'Unknown action.' }, { status: 400 })
}
