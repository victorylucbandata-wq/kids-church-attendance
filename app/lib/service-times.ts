import { createAdminClient } from '@/app/lib/supabase/admin'

export type ServiceTime = { id: string; label: string; sort_order: number; is_active: boolean }

// Service times are church configuration, not personal data, so they are read with the
// secret key and always filtered by church. This also works before the RLS cutover.
export async function listServiceTimes(churchId: string, { activeOnly = true } = {}): Promise<ServiceTime[]> {
  let query = createAdminClient()
    .from('service_times')
    .select('id, label, sort_order, is_active')
    .eq('church_id', churchId)
    .order('sort_order')
    .order('label')
  if (activeOnly) query = query.eq('is_active', true)
  const { data } = await query
  return (data ?? []) as ServiceTime[]
}
