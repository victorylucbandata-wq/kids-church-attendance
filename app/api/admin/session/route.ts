import { isAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('en-CA')

    const { data: session } = await supabase
      .from('sessions')
      .select('id, session_date, generated_at')
      .eq('session_date', today)
      .maybeSingle()

    return Response.json({ success: true, session: session ?? null })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to get session.' },
      { status: 500 }
    )
  }
}

export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('en-CA')

    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_date', today)
      .maybeSingle()

    if (existing) {
      return Response.json(
        { success: false, error: 'A session already exists for today.' },
        { status: 409 }
      )
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({ session_date: today })
      .select('id')
      .single()

    if (error) throw error

    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    return Response.json({ success: true, sessionId: session.id, memberCount: count ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate session.'
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
