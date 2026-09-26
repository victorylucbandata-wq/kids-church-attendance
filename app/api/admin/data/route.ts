import { adminApi } from '@/app/lib/church'
import { loadDashboardData } from '@/app/lib/dashboard-data'

export async function GET() {
  const ctx = await adminApi()
  if (ctx instanceof Response) return ctx

  try {
    return Response.json(await loadDashboardData(ctx))
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load data.' },
      { status: 500 }
    )
  }
}
