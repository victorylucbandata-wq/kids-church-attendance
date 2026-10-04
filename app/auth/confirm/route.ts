import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/app/lib/supabase/server'
import { createSessionToken } from '@/app/lib/session-token'
import { CHURCH_COOKIE, SESSION_LIMIT_COOKIE, SHARED_DEVICE_COOKIE } from '@/app/lib/cookie-names'

const TYPES: EmailOtpType[] = ['magiclink', 'invite', 'email', 'signup']
const PERSONAL_DEVICE = 60 * 60 * 24 * 30
const SHARED_DEVICE = 60 * 60 * 12

// Landing page for the emailed sign-in and invite links. Two link formats arrive here:
//  - ?token_hash=&type=  from our own email (Send Email hook -> n8n)
//  - ?code=              from Supabase's built-in email / SMTP fallback (PKCE; the code
//                        verifier cookie was set when the link was requested on this browser)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')
  const fail = NextResponse.redirect(new URL('/admin/login?link=invalid', url))

  const supabase = await createClient()
  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return fail
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return fail
  } else {
    return fail
  }

  const store = await cookies()
  // Invites are opened on the invitee's own phone; treat them as personal devices.
  const shared = type !== 'invite' && store.get(SHARED_DEVICE_COOKIE)?.value === '1'
  const maxAge = shared ? SHARED_DEVICE : PERSONAL_DEVICE
  store.set(SESSION_LIMIT_COOKIE, createSessionToken(process.env.SESSION_SECRET!, maxAge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
  store.delete(SHARED_DEVICE_COOKIE)
  store.delete(CHURCH_COOKIE)
  return NextResponse.redirect(new URL('/admin/choose', url))
}
