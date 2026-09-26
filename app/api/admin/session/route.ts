import { adminApi } from '@/app/lib/church'
import { todayInManila } from '@/app/lib/dates'

// Starts today's check-in session for the current church.
export async function POST() {
  const ctx = await adminApi({ write: true })
  if (ctx instanceof Response) return ctx

  try {
    const { data: session, error } = await ctx.db
      .from('sessions')
      .insert({ church_id: ctx.church.id, session_date: todayInManila(), generated_by: ctx.userId })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return Response.json({ success: false, error: 'A session already exists for today.' }, { status: 409 })
      }
      throw error
    }

    const { count } = await ctx.db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', ctx.church.id)
      .eq('is_active', true)

    return Response.json({ success: true, sessionId: session.id, memberCount: count ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate session.'
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
