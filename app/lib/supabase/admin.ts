import { createClient } from '@supabase/supabase-js'

// Secret-key client: bypasses Row Level Security. Server-only.
// Allowed callers (enforced by eslint no-restricted-imports): the parent kiosk APIs,
// which scope every query by the church in the URL; membership/role lookups in
// app/lib/church.ts; invites; the network screens; and the keep-alive cron.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set.')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
