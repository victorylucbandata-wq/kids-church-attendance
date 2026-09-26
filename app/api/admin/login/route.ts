import { isCorrectPassword, setAdminCookie } from '@/app/lib/auth'

export async function POST(request: Request) {
  try {
    const { password } = (await request.json()) as { password?: string }

    if (!isCorrectPassword(password)) {
      return Response.json({ success: false, error: 'Incorrect password.' }, { status: 401 })
    }

    await setAdminCookie()
    return Response.json({ success: true })
  } catch {
    return Response.json({ success: false, error: 'Something went wrong.' }, { status: 500 })
  }
}
