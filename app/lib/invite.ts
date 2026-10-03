import { createAdminClient } from '@/app/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

// ponytail: scans up to 1,000 accounts; switch to a paged search if the network outgrows that.
export async function findUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

export async function emailsById(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const wanted = new Set(ids)
  return new Map((data?.users ?? []).filter((u) => wanted.has(u.id)).map((u) => [u.id, u.email ?? '']))
}

/**
 * Gives `email` a role in a church. New people get an invite email (through the
 * Supabase Send Email hook); existing accounts are simply added and can sign in as usual.
 */
export async function grantAccess(
  opts: { email: string; churchId: string; role: 'lead' | 'volunteer'; invitedBy: string; origin: string }
): Promise<{ ok: true; invited: boolean } | { ok: false; error: string; status: number }> {
  const email = opts.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.', status: 400 }

  const admin = createAdminClient()
  let userId = await findUserIdByEmail(admin, email)
  let invited = false
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${opts.origin}/auth/confirm` })
    if (error || !data.user) return { ok: false, error: `Couldn't send the invite: ${error?.message ?? 'unknown error'}`, status: 502 }
    userId = data.user.id
    invited = true
  }

  const { error } = await admin.from('church_memberships').upsert(
    { church_id: opts.churchId, user_id: userId, role: opts.role, invited_by: opts.invitedBy },
    { onConflict: 'church_id,user_id' }
  )
  if (error) return { ok: false, error: error.message, status: 500 }
  return { ok: true, invited }
}
