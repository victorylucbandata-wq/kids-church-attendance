import { callGas } from '@/app/lib/gas'
import { UncheckedMember } from '@/app/lib/types'

type GasResponse = {
  success: boolean
  sessionId: string | null
  members: UncheckedMember[]
}

export async function GET() {
  try {
    const data = await callGas<GasResponse>('getUncheckedMembers')
    // Deduplicate by attendanceId in case Sheets has duplicate rows
    const seen = new Set<string>()
    const members = data.members.filter((m) => {
      if (seen.has(m.attendanceId)) return false
      seen.add(m.attendanceId)
      return true
    })
    return Response.json({ success: true, sessionId: data.sessionId, members })
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load members.' },
      { status: 500 }
    )
  }
}
