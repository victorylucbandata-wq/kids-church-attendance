import { createHmac, timingSafeEqual } from 'node:crypto'

// Admin cookie value is `<expiry ms>.<signature>`, signed with ADMIN_PASSWORD.
// It can't be forged without the password, and changing the password signs everyone out.

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function sign(expires: string, secret: string): string {
  return createHmac('sha256', secret).update(`admin-session:${expires}`).digest('base64url')
}

export function createSessionToken(secret: string, maxAgeSeconds: number, now = Date.now()): string {
  const expires = String(now + maxAgeSeconds * 1000)
  return `${expires}.${sign(expires, secret)}`
}

export function isValidSessionToken(token: string | undefined, secret: string | undefined, now = Date.now()): boolean {
  if (!token || !secret) return false
  const [expires, signature, extra] = token.split('.')
  if (!expires || !signature || extra !== undefined) return false
  if (!/^\d+$/.test(expires) || Number(expires) <= now) return false
  return safeEqual(signature, sign(expires, secret))
}
