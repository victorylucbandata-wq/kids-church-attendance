import { requireAdmin } from '@/app/lib/auth'
import { callGas } from '@/app/lib/gas'
import { AdminData } from '@/app/lib/types'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  await requireAdmin()

  let data: (AdminData & { success: boolean }) | null = null
  let error: string | null = null

  try {
    data = await callGas<AdminData & { success: boolean }>('getAdminData')
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load dashboard data.'
  }

  return <AdminDashboard initialData={data} initialError={error} />
}
