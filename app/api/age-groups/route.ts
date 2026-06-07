import { createClient } from '@/app/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('age_groups')
      .select('id, name')
      .order('sort_order')

    if (error) throw error

    return Response.json({ success: true, ageGroups: data })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load age groups.' },
      { status: 500 }
    )
  }
}
