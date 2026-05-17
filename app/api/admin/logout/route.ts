import { clearAdminCookie } from '@/app/lib/auth'

export async function POST() {
  await clearAdminCookie()
  return Response.json({ success: true })
}
