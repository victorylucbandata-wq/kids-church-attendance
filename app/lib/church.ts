import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { CHURCH_COOKIE } from '@/app/lib/cookie-names'

export type Role = 'lead' | 'volunteer' | 'network'

export type Church = { id: string; name: string; slug: string; is_active: boolean }

export type AdminContext = {
  /** Signed-in user's client: every kids-data query runs under Row Level Security. */
  db: Awaited<ReturnType<typeof createClient>>
  userId: string
  email: string
  church: Church
  role: Role
  isNetworkAdmin: boolean
}

type Resolved =
  | { status: 'signed-out' }
  | { status: 'choose-church'; userId: string; isNetworkAdmin: boolean }
  | { status: 'ok'; ctx: AdminContext }

// Memberships and roles are read with the secret key: the server is trusted, and it keeps
// this working before and after the RLS cutover. Kids data itself always goes through `db`.
export async function listAccess(userId: string) {
  const admin = createAdminClient()
  const [{ data: memberships }, { data: net }] = await Promise.all([
    admin.from('church_memberships').select('role, churches(id, name, slug, is_active)').eq('user_id', userId),
    admin.from('network_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  ])
  const churches = (memberships ?? [])
    .map((m) => ({ role: m.role as 'lead' | 'volunteer', church: m.churches as unknown as Church }))
    .filter((m) => m.church?.is_active)
    .sort((a, b) => a.church.name.localeCompare(b.church.name))
  return { churches, isNetworkAdmin: !!net }
}

// cache: the admin layout and its page both ask, once per request is enough.
const resolve = cache(async (): Promise<Resolved> => {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { status: 'signed-out' }

  const { churches, isNetworkAdmin } = await listAccess(user.id)
  const store = await cookies()
  const wanted = store.get(CHURCH_COOKIE)?.value

  let church: Church | undefined
  let role: Role | undefined
  const membership = churches.find((m) => m.church.id === wanted) ?? (!wanted && churches.length === 1 ? churches[0] : undefined)
  if (membership) {
    church = membership.church
    role = membership.role
  } else if (wanted && isNetworkAdmin) {
    // Network admins can open any church, read-only (PRD section 4).
    const { data } = await createAdminClient().from('churches').select('id, name, slug, is_active').eq('id', wanted).maybeSingle()
    if (data) {
      church = data as Church
      role = 'network'
    }
  }

  if (!church || !role) return { status: 'choose-church', userId: user.id, isNetworkAdmin }
  return { status: 'ok', ctx: { db, userId: user.id, email: user.email ?? '', church, role, isNetworkAdmin } }
})

/** For server components under /admin: redirects when signed out or no church is picked. */
export async function requireAdminPage(): Promise<AdminContext> {
  const r = await resolve()
  if (r.status === 'signed-out') redirect('/admin/login')
  if (r.status === 'choose-church') redirect('/admin/choose')
  return r.ctx
}

/** Like requireAdminPage, but returns null instead of redirecting (for layouts). */
export async function getAdminContext(): Promise<AdminContext | null> {
  const r = await resolve()
  return r.status === 'ok' ? r.ctx : null
}

/**
 * For /api/admin route handlers. Returns the context, or a Response to send back.
 * `write` blocks the network admin's read-only view; `lead` requires a church Lead.
 */
export async function adminApi(opts: { write?: boolean; lead?: boolean } = {}): Promise<AdminContext | Response> {
  const r = await resolve()
  if (r.status === 'signed-out') {
    return Response.json({ success: false, error: 'Please sign in again.' }, { status: 401 })
  }
  if (r.status === 'choose-church') {
    return Response.json({ success: false, error: 'Choose a church first.' }, { status: 409 })
  }
  const { ctx } = r
  if ((opts.write || opts.lead) && ctx.role === 'network') {
    return Response.json({ success: false, error: 'Network view is read-only.' }, { status: 403 })
  }
  if (opts.lead && ctx.role !== 'lead') {
    return Response.json({ success: false, error: 'Only a church Lead can do that.' }, { status: 403 })
  }
  return ctx
}

/** For /api/network and /network: the signed-in user must be a network admin. */
export async function networkApi(): Promise<{ userId: string } | Response> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ success: false, error: 'Please sign in again.' }, { status: 401 })
  const { isNetworkAdmin } = await listAccess(user.id)
  if (!isNetworkAdmin) return Response.json({ success: false, error: 'Network admins only.' }, { status: 403 })
  return { userId: user.id }
}

/** Resolves a kiosk church from its URL slug (secret-key client; kiosk has no user). */
export async function churchBySlug(slug: string): Promise<Church | null> {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null
  const { data } = await createAdminClient()
    .from('churches')
    .select('id, name, slug, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as Church | null) ?? null
}
