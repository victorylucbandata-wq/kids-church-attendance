import { isAdmin } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('age_groups')
    .select('id, name, sort_order')
    .order('sort_order')

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, ageGroups: data })
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await request.json()
  if (!name?.trim()) {
    return Response.json({ success: false, error: 'Name is required.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: maxRow } = await supabase
    .from('age_groups')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('age_groups')
    .insert({ name: name.trim(), sort_order: nextOrder })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ success: false, error: 'An age group with that name already exists.' }, { status: 409 })
    }
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, id: data.id })
}
