import { createHmac, timingSafeEqual } from 'node:crypto'

// Verifies a Standard Webhooks signature (what Supabase Auth hooks send).
// secret: "v1,whsec_<base64>" as shown in the Supabase dashboard.
// Headers: webhook-id, webhook-timestamp (seconds), webhook-signature ("v1,<base64> v1,<base64> ...").
export function verifyWebhook(
  secret: string | undefined,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 5 * 60
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false
  const ts = Number(headers.timestamp)
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > toleranceSeconds) return false

  const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest()

  return headers.signature.split(' ').some((part) => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
