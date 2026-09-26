import { networkApi } from '@/app/lib/church'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { grantAccess } from '@/app/lib/invite'

const RESERVED = new Set(['admin', 'api', 'auth', 'network', 'check-in', 'kids-attendance', '_next'])

// Create a church and invite its first Lead.
export async function POST(request: Request) {
  const net = await networkApi()
  if (net instanceof Response) return net

  const { name, slug, leadEmail } = (await request.json().catch(() => ({}))) as { name?: string; slug?: string; leadEmail?: string }
  const cleanName = name?.trim().slice(0, 80)
  const cleanSlug = slug?.trim().toLowerCase()
  if (!cleanName) return Response.json({ success: false, error: 'Enter the church name.' }, { status: 400 })
  if (!cleanSlug || !/^[a-z0-9-]{2,40}$/.test(cleanSlug) || RESERVED.has(cleanSlug)) {
    return Response.json({ success: false, error: 'The link name can use lowercase letters, numbers and dashes (2–40 characters).' }, { status: 400 })
  }
  if (!leadEmail?.trim()) return Response.json({ success: false, error: 'Enter the first Lead\'s email.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: church, error } = await admin.from('churches').insert({ name: cleanName, slug: cleanSlug }).select('id').single()
  if (error || !church) {
    if (error?.code === '23505') return Response.json({ success: false, error: `The link /${cleanSlug} is already taken.` }, { status: 409 })
    return Response.json({ success: false, error: error?.message ?? 'Could not create the church.' }, { status: 500 })
  }

  const result = await grantAccess({ email: leadEmail, churchId: church.id, role: 'lead', invitedBy: net.userId, origin: new URL(request.url).origin })
  if (!result.ok) {
    // Don't leave a church behind that nobody can run.
    await admin.from('churches').delete().eq('id', church.id)
    return Response.json({ success: false, error: result.error }, { status: result.status })
  }
  return Response.json({ success: true, invited: result.invited })
}

// Turn a church's kiosk and sign-in on or off. Data is kept either way.
export async function PATCH(request: Request) {
  const net = await networkApi()
  if (net instanceof Response) return net

  const { churchId, isActive } = (await request.json().catch(() => ({}))) as { churchId?: string; isActive?: boolean }
  if (!churchId || typeof isActive !== 'boolean') return Response.json({ success: false, error: 'Choose a church.' }, { status: 400 })

  const { error } = await createAdminClient().from('churches').update({ is_active: isActive }).eq('id', churchId)
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
