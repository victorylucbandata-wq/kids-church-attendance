import { adminApi } from '@/app/lib/church'
import { asText, toCsv } from '@/app/lib/csv'

const PAGE = 1000

type Row = {
  first_name: string
  last_name: string
  nickname: string | null
  birthday: string | null
  role: string
  parent_name: string | null
  contact_number: string | null
  notes: string | null
  is_active: boolean
  age_groups: { name: string } | null
}

// Every member as CSV, in the import template's columns (plus Active), so a sheet
// exported here can be edited and imported back.
export async function GET() {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx

  const members: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await ctx.db
      .from('members')
      .select('first_name, last_name, nickname, birthday, role, parent_name, contact_number, notes, is_active, age_groups(name)')
      .eq('church_id', ctx.church.id)
      .order('last_name')
      .order('first_name')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
    members.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < PAGE) break
  }

  const csv = toCsv(
    ['Last Name', 'First Name', 'Nickname', 'Birthday', 'Role', 'Age Group', 'Parent / Guardian', 'Contact Number', 'Notes', 'Active'],
    members.map((m) => [
      m.last_name,
      m.first_name,
      m.nickname,
      m.birthday,
      m.role === 'volunteer' ? 'Serve Team' : 'Child',
      m.age_groups?.name ?? '',
      m.parent_name,
      asText(m.contact_number),
      m.notes,
      m.is_active ? 'Yes' : 'No',
    ]),
    [7]
  )
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="members-${ctx.church.slug}.csv"`,
    },
  })
}
