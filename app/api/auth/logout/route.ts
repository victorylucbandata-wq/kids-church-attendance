import { cookies } from 'next/headers'
import { createClient } from '@/app/lib/supabase/server'
import { CHURCH_COOKIE, SESSION_LIMIT_COOKIE } from '@/app/lib/cookie-names'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const store = await cookies()
  store.delete(SESSION_LIMIT_COOKIE)
  store.delete(CHURCH_COOKIE)
  return Response.json({ success: true })
}
