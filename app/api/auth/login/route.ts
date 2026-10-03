import { cookies } from 'next/headers'
import { createClient } from '@/app/lib/supabase/server'
import { SHARED_DEVICE_COOKIE } from '@/app/lib/cookie-names'

// Sends a one-time sign-in link. Invite-only: unknown emails never get an account.
// The response is the same either way, so this can't be used to probe who has access.
export async function POST(request: Request) {
  const { email, sharedDevice } = (await request.json().catch(() => ({}))) as { email?: string; sharedDevice?: boolean }
  const address = email?.trim().toLowerCase()
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return Response.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 })
  }

  const supabase = await createClient()
  const origin = new URL(request.url).origin
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
  })

  // "No such user" stays silent (so this can't probe who has access); real failures don't.
  if (error && error.status === 429) {
    return Response.json({ success: false, error: 'Too many sign-in requests. Wait a minute and try again.' }, { status: 429 })
  }
  if (error && (error.status ?? 0) >= 500) {
    return Response.json({ success: false, error: 'We couldn\'t send the email just now. Try again in a minute, or ask your church lead.' }, { status: 502 })
  }

  const store = await cookies()
  store.set(SHARED_DEVICE_COOKIE, sharedDevice ? '1' : '0', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 })
  return Response.json({ success: true })
}
