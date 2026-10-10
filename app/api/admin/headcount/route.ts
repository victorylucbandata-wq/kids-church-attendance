import { adminApi } from '@/app/lib/church'
import { loadHeadcount } from '@/app/lib/headcount'
import { toCsv } from '@/app/lib/csv'

// The headcount table as CSV (?format=csv) or JSON. Staff may use it; it holds numbers only.
export async function GET(request: Request) {
  const ctx = await adminApi({ staff: true })
  if (ctx instanceof Response) return ctx

  const { services, rows } = await loadHeadcount(ctx.church.id)
  if (new URL(request.url).searchParams.get('format') !== 'csv') return Response.json({ success: true, services, rows })

  const csv = toCsv(
    ['Date', ...services, 'Kids', 'First timers', 'Serve Team'],
    rows.map((r) => [r.date, ...services.map((s) => r.byService[s] ?? 0), r.kids, r.firstTimers, r.serveTeam])
  )
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="headcount-${ctx.church.slug}.csv"`,
    },
  })
}
