import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const COOKIE_NAME = 'admin_session'
const COOKIE_VALUE = 'authenticated'

export async function requireAdmin(): Promise<void> {
  const store = await cookies()
  if (store.get(COOKIE_NAME)?.value !== COOKIE_VALUE) {
    redirect('/admin/login')
  }
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === COOKIE_VALUE
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
