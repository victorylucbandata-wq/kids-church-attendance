import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSessionToken, isValidSessionToken, safeEqual } from '@/app/lib/session-token'

const COOKIE_NAME = 'admin_session'
const MAX_AGE = 60 * 60 * 8

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect('/admin/login')
  }
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionToken(store.get(COOKIE_NAME)?.value, process.env.ADMIN_PASSWORD)
}

export function isCorrectPassword(password: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD
  return !!password && !!expected && safeEqual(password, expected)
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, createSessionToken(process.env.ADMIN_PASSWORD!, MAX_AGE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
