import { kioskFor } from '@/app/lib/kiosk'
import { listServiceTimes } from '@/app/lib/service-times'

type Params = { params: Promise<{ church: string }> }

// Church name, age groups and service times for the kiosk forms.
export async function GET(_request: Request, { params }: Params) {
  const k = await kioskFor(params)
  if (k instanceof Response) return k

  const [{ data: ageGroups, error }, serviceTimes] = await Promise.all([
    k.db.from('age_groups').select('id, name').eq('church_id', k.church.id).order('sort_order'),
    listServiceTimes(k.church.id),
  ])
  if (error) return Response.json({ success: false, error: 'Could not load this church.' }, { status: 500 })

  return Response.json({
    success: true,
    church: { name: k.church.name, slug: k.church.slug },
    ageGroups: ageGroups ?? [],
    serviceTimes: serviceTimes.map((st) => ({ id: st.id, label: st.label })),
  })
}
