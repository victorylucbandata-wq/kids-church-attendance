import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isValidSessionToken } from '@/app/lib/session-token'
import { SESSION_LIMIT_COOKIE } from '@/app/lib/cookie-names'

// Session limits live here because Supabase only time-boxes sessions on Pro plans
// (docs/multi-church-implementation-plan.md, 4.3). The limit cookie is set at sign-in.

const PUBLIC_ADMIN_PATHS = ['/admin/login']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    }
  )

  // Refreshes the access token when needed; must run before any auth decision.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')
  if (PUBLIC_ADMIN_PATHS.includes(path)) return response

  const withinLimit = isValidSessionToken(request.cookies.get(SESSION_LIMIT_COOKIE)?.value, process.env.SESSION_SECRET)

  if (!user || !withinLimit) {
    if (user) await supabase.auth.signOut()
    const denied = isApi
      ? NextResponse.json({ success: false, error: 'Please sign in again.' }, { status: 401 })
      : NextResponse.redirect(new URL(`/admin/login${user ? '?expired=1' : ''}`, request.url))
    // Carry over any cookie changes (e.g. the sign-out clearing auth cookies).
    for (const c of response.cookies.getAll()) denied.cookies.set(c)
    denied.cookies.delete(SESSION_LIMIT_COOKIE)
    return denied
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/network/:path*', '/api/admin/:path*', '/api/network/:path*'],
}
