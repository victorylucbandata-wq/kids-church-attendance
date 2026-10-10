import { adminApi } from '@/app/lib/church'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { emailsById, grantAccess } from '@/app/lib/invite'

const ROLES = ['lead', 'volunteer', 'staff'] as const
const isRole = (r: unknown): r is (typeof ROLES)[number] => ROLES.includes(r as (typeof ROLES)[number])

// Team management is for church Leads only (plan 4.2). The Lead check happens here,
// then membership rows are written with the secret key.

export async function GET() {
  const ctx = await adminApi({ lead: true })
  if (ctx instanceof Response) return ctx

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('church_memberships').select('user_id, role, created_at').eq('church_id', ctx.church.id).order('created_at')
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })

  const emails = await emailsById(admin, (data ?? []).map((m) => m.user_id))
  const team = (data ?? [])
    .map((m) => ({ userId: m.user_id, email: emails.get(m.user_id) ?? '(unknown)', role: m.role, isYou: m.user_id === ctx.userId }))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.email.localeCompare(b.email))
  return Response.json({ success: true, team })
}

export async function POST(request: Request) {
  const ctx = await adminApi({ lead: true })
  if (ctx instanceof Response) return ctx

  const { email, role } = (await request.json().catch(() => ({}))) as { email?: string; role?: string }
  if (!isRole(role)) return Response.json({ success: false, error: 'Choose Lead, Volunteer or Staff.' }, { status: 400 })

  const result = await grantAccess({ email: email ?? '', churchId: ctx.church.id, role, invitedBy: ctx.userId, origin: new URL(request.url).origin })
  if (!result.ok) return Response.json({ success: false, error: result.error }, { status: result.status })
  return Response.json({ success: true, invited: result.invited })
}

async function leadCount(churchId: string) {
  const { count } = await createAdminClient()
    .from('church_memberships').select('user_id', { count: 'exact', head: true }).eq('church_id', churchId).eq('role', 'lead')
  return count ?? 0
}

export async function PATCH(request: Request) {
  const ctx = await adminApi({ lead: true })
  if (ctx instanceof Response) return ctx

  const { userId, role } = (await request.json().catch(() => ({}))) as { userId?: string; role?: string }
  if (!userId || !isRole(role)) return Response.json({ success: false, error: 'Choose a person and a role.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('church_memberships').select('role').eq('church_id', ctx.church.id).eq('user_id', userId).maybeSingle()
  if (!current) return Response.json({ success: false, error: 'That person is not on this team.' }, { status: 404 })
  if (current.role === 'lead' && role !== 'lead' && (await leadCount(ctx.church.id)) <= 1) {
    return Response.json({ success: false, error: 'Every church needs at least one Lead. Make someone else a Lead first.' }, { status: 409 })
  }

  const { error } = await admin.from('church_memberships').update({ role }).eq('church_id', ctx.church.id).eq('user_id', userId)
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function DELETE(request: Request) {
  const ctx = await adminApi({ lead: true })
  if (ctx instanceof Response) return ctx

  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string }
  if (!userId) return Response.json({ success: false, error: 'Choose a person to remove.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('church_memberships').select('role').eq('church_id', ctx.church.id).eq('user_id', userId).maybeSingle()
  if (!current) return Response.json({ success: true })
  if (current.role === 'lead' && (await leadCount(ctx.church.id)) <= 1) {
    return Response.json({ success: false, error: 'Every church needs at least one Lead. Make someone else a Lead first.' }, { status: 409 })
  }

  const { error } = await admin.from('church_memberships').delete().eq('church_id', ctx.church.id).eq('user_id', userId)
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
