import { requireAdminPage } from '@/app/lib/church'
import { loadDashboardData } from '@/app/lib/dashboard-data'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const ctx = await requireAdminPage()

  let data: Awaited<ReturnType<typeof loadDashboardData>> | null = null
  let error: string | null = null
  try {
    data = await loadDashboardData(ctx)
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load dashboard data.'
  }

  return <AdminDashboard initialData={data} initialError={error} />
}
