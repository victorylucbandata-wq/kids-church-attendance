import { isAdmin } from '@/app/lib/auth'
import { callGas } from '@/app/lib/gas'
import { AdminData } from '@/app/lib/types'

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await callGas<AdminData & { success: boolean }>('getAdminData')
    // data already contains success: true from callGas
    return Response.json(data)
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load data.' },
      { status: 500 }
    )
  }
}
