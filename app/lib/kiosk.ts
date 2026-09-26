import { churchBySlug, type Church } from '@/app/lib/church'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { todayInManila } from '@/app/lib/dates'

export type Kiosk = { church: Church; db: ReturnType<typeof createAdminClient> }

// Parents have no account, so kiosk routes use the secret key. Every query they make
// must be filtered by kiosk.church.id; the attendance trigger backs this up in the database.
export async function kioskFor(params: Promise<{ church: string }>): Promise<Kiosk | Response> {
  const { church: slug } = await params
  const church = await churchBySlug(slug)
  if (!church) return Response.json({ success: false, error: 'Church not found.' }, { status: 404 })
  return { church, db: createAdminClient() }
}

/** Today's session for the church, decided on the server rather than trusted from the browser. */
export async function todaysSessionId(k: Kiosk): Promise<string | null> {
  const { data } = await k.db
    .from('sessions')
    .select('id')
    .eq('church_id', k.church.id)
    .eq('session_date', todayInManila())
    .maybeSingle()
  return data?.id ?? null
}
