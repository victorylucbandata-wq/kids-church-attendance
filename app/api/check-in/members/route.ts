import { createClient } from '@/app/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const today = new Date().toLocaleDateString('en-CA')

    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_date', today)
      .maybeSingle()

    if (!session) {
      return Response.json({ success: true, sessionId: null, members: [] })
    }

    const { data: checkedInIds } = await supabase
      .from('attendance')
      .select('member_id')
      .eq('session_id', session.id)

    const checkedSet = new Set((checkedInIds ?? []).map((r) => r.member_id))

    const { data: activeMembers } = await supabase
      .from('members')
      .select('id, first_name, last_name, nickname, role, birthday, age_group_id, age_groups(name)')
      .eq('is_active', true)

    const members = (activeMembers ?? [])
      .filter((m) => !checkedSet.has(m.id))
      .map((m) => {
        const ageGroupObj = m.age_groups as unknown as { name: string } | null
        return {
          memberId: m.id,
          firstName: m.first_name,
          lastName: m.last_name,
          nickname: m.nickname,
          ageGroup: ageGroupObj?.name ?? '',
          role: m.role,
          birthday: m.birthday,
        }
      })

    return Response.json({ success: true, sessionId: session.id, members })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load members.' },
      { status: 500 }
    )
  }
}
