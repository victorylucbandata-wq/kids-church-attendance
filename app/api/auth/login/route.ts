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
    // Three Supabase limits share this status: 60s per address, the project's hourly email cap,
    // and 30 requests / 5 min per IP. Log which one so a screenshot isn't the only clue.
    console.warn('[auth/login] Supabase 429', error.code, error.message)
    const seconds = /after (\d+) seconds/.exec(error.message)?.[1]
    const message = seconds
      ? `A link was already sent to this address. Wait ${seconds} seconds, then check your inbox and spam before asking for another.`
      : 'Too many sign-in requests. Wait a few minutes and try again, or ask your church lead.'
    return Response.json({ success: false, error: message }, { status: 429 })
  }
  if (error && (error.status ?? 0) >= 500) {
    return Response.json({ success: false, error: 'We couldn\'t send the email just now. Try again in a minute, or ask your church lead.' }, { status: 502 })
  }

  const store = await cookies()
  store.set(SHARED_DEVICE_COOKIE, sharedDevice ? '1' : '0', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 })
  return Response.json({ success: true })
}
