import { adminApi } from '@/app/lib/church'
import { listServiceTimes } from '@/app/lib/service-times'
import { formatDisplayName } from '@/app/lib/display-name'

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

// The Serve Team roster for one date: who serves at each service, and in which role.
export async function GET(request: Request) {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx
  const date = new URL(request.url).searchParams.get('date')
  if (!isDate(date)) return Response.json({ success: false, error: 'Pick a date.' }, { status: 400 })

  const [serviceTimes, { data: volunteers }, { data: roster }, { data: pastRoles }, { data: session }] = await Promise.all([
    listServiceTimes(ctx.church.id),
    ctx.db.from('members').select('id, first_name, last_name, nickname')
      .eq('church_id', ctx.church.id).eq('role', 'volunteer').eq('is_active', true).order('last_name').order('first_name'),
    ctx.db.from('roster').select('id, service_time_id, member_id, serve_role').eq('church_id', ctx.church.id).eq('service_date', date),
    ctx.db.from('roster').select('serve_role').eq('church_id', ctx.church.id).neq('serve_role', '').limit(500),
    ctx.db.from('sessions').select('id').eq('church_id', ctx.church.id).eq('session_date', date).maybeSingle(),
  ])

  // Who has tapped in that day, to show next to the roster.
  const { data: arrived } = session
    ? await ctx.db.from('attendance').select('member_id, checked_in_at').eq('church_id', ctx.church.id).eq('session_id', session.id)
    : { data: [] }
  const arrivedAt = new Map((arrived ?? []).map((a) => [a.member_id, a.checked_in_at as string | null]))

  return Response.json({
    success: true,
    serviceTimes: serviceTimes.map(({ id, label }) => ({ id, label })),
    volunteers: (volunteers ?? []).map((v) => ({ id: v.id, name: formatDisplayName(v.first_name, v.last_name, v.nickname) })),
    roster: (roster ?? []).map((r) => ({
      id: r.id,
      serviceTimeId: r.service_time_id,
      memberId: r.member_id,
      serveRole: r.serve_role,
      checkedInAt: arrivedAt.get(r.member_id) ?? null,
    })),
    roles: [...new Set((pastRoles ?? []).map((r) => r.serve_role))].sort(),
  })
}

// Put a Serve Team member on a service.
export async function POST(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx
  const { date, serviceTimeId, memberId, serveRole } = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (!isDate(date) || typeof serviceTimeId !== 'string' || typeof memberId !== 'string') {
    return Response.json({ success: false, error: 'Choose a date, a service and a person.' }, { status: 400 })
  }

  const { data: member } = await ctx.db
    .from('members').select('id').eq('id', memberId).eq('church_id', ctx.church.id).eq('role', 'volunteer').maybeSingle()
  if (!member) return Response.json({ success: false, error: 'Only Serve Team members can be put on the roster.' }, { status: 400 })

  const { error } = await ctx.db.from('roster').insert({
    church_id: ctx.church.id,
    service_date: date,
    service_time_id: serviceTimeId,
    member_id: memberId,
    serve_role: typeof serveRole === 'string' ? serveRole.trim().slice(0, 40) : '',
  })
  if (error) {
    if (error.code === '23505') return Response.json({ success: false, error: 'Already on this service.' }, { status: 409 })
    return Response.json({ success: false, error: 'Could not add to the roster.' }, { status: 400 })
  }
  return Response.json({ success: true })
}

// Take someone off a service.
export async function DELETE(request: Request) {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx
  const { id } = (await request.json().catch(() => ({}))) as { id?: string }
  if (!id) return Response.json({ success: false, error: 'Nothing to remove.' }, { status: 400 })
  const { error } = await ctx.db.from('roster').delete().eq('id', id).eq('church_id', ctx.church.id)
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
