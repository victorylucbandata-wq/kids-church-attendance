import { callGas } from '@/app/lib/gas'

export async function POST(request: Request) {
  try {
    const { attendanceId, notes } = (await request.json()) as {
      attendanceId?: string
      notes?: string
    }

    if (!attendanceId) {
      return Response.json({ success: false, error: 'attendanceId is required.' }, { status: 400 })
    }

    await callGas('checkIn', { attendanceId, notes: notes ?? '' })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Check-in failed.' },
      { status: 500 }
    )
  }
}
