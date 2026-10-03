import { adminApi } from '@/app/lib/church'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { listServiceTimes } from '@/app/lib/service-times'

export async function GET() {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx
  return Response.json({ success: true, serviceTimes: await listServiceTimes(ctx.church.id, { activeOnly: false }) })
}

export async function POST(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  const { label } = (await request.json().catch(() => ({}))) as { label?: string }
  const clean = label?.trim().slice(0, 40)
  if (!clean) return Response.json({ success: false, error: 'Enter a service time, e.g. 9:00 AM.' }, { status: 400 })

  const db = createAdminClient()
  const existing = await listServiceTimes(ctx.church.id, { activeOnly: false })
  const { error } = await db.from('service_times').insert({
    church_id: ctx.church.id,
    label: clean,
    sort_order: Math.max(0, ...existing.map((s) => s.sort_order)) + 1,
  })
  if (error) {
    if (error.code === '23505') return Response.json({ success: false, error: 'That service time already exists.' }, { status: 409 })
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
  return Response.json({ success: true })
}
