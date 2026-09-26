import { createAdminClient } from '@/app/lib/supabase/admin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Secret key: after the RLS cutover the publishable key can read nothing.
    const supabase = createAdminClient()

    const { error } = await supabase.from('age_groups').select('id').limit(1)

    if (error) throw error

    return Response.json({ success: true, pingedAt: new Date().toISOString() })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Keep-alive ping failed.' },
      { status: 500 }
    )
  }
}
