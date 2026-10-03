import { cookies } from 'next/headers'
import { createClient } from '@/app/lib/supabase/server'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { listAccess } from '@/app/lib/church'
import { CHURCH_COOKIE } from '@/app/lib/cookie-names'

// Switches the church the signed-in person is working in.
export async function POST(request: Request) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ success: false, error: 'Please sign in again.' }, { status: 401 })

  const { churchId } = (await request.json().catch(() => ({}))) as { churchId?: string }
  const { churches, isNetworkAdmin } = await listAccess(user.id)
  let allowed = churches.some((m) => m.church.id === churchId)
  if (!allowed && isNetworkAdmin && churchId) {
    const { data } = await createAdminClient().from('churches').select('id').eq('id', churchId).maybeSingle()
    allowed = !!data
  }
  if (!allowed) return Response.json({ success: false, error: 'You do not have access to that church.' }, { status: 403 })

  const store = await cookies()
  store.set(CHURCH_COOKIE, churchId!, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  return Response.json({ success: true })
}
