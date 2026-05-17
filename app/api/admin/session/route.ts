import { isAdmin } from '@/app/lib/auth'
import { callGas } from '@/app/lib/gas'
import { Session } from '@/app/lib/types'

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await callGas<{ success: boolean; session: Session | null }>('getSession')
    return Response.json({ success: true, session: data.session })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to get session.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { schedule } = (await request.json()) as { schedule?: string }

    if (!schedule) {
      return Response.json({ success: false, error: 'Schedule is required.' }, { status: 400 })
    }

    const data = await callGas<{ success: boolean; sessionId: string; memberCount: number }>(
      'generateSession',
      { schedule }
    )

    return Response.json({ success: true, sessionId: data.sessionId, memberCount: data.memberCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate session.'
    const status = message.includes('already exists') ? 409 : 500
    return Response.json({ success: false, error: message }, { status })
  }
}
