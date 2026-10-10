import { cookies } from 'next/headers'
import { churchBySlug, type Church } from '@/app/lib/church'
import { KIOSK_COOKIE } from '@/app/lib/cookie-names'
import { safeEqual } from '@/app/lib/session-token'
import { createAdminClient } from '@/app/lib/supabase/admin'
import { manilaClock, todayInManila } from '@/app/lib/dates'
import { listServiceTimes } from '@/app/lib/service-times'
import { formatMinutes, serviceAt, startMinutes } from '@/app/lib/service-clock'

export type Kiosk = { church: Church; db: ReturnType<typeof createAdminClient> }

/** True when this browser is one of the church's own check-in devices (a Lead switched it on). */
export async function isKioskDevice(churchId: string): Promise<boolean> {
  const value = (await cookies()).get(KIOSK_COOKIE)?.value
  if (!value) return false
  const { data } = await createAdminClient().from('churches').select('kiosk_key').eq('id', churchId).maybeSingle()
  return !!data && safeEqual(value, `${churchId}.${data.kiosk_key}`)
}

// Parents have no account, so kiosk routes use the secret key. They only answer the church's
// own check-in devices, and every query must be filtered by kiosk.church.id (the attendance
// trigger backs this up in the database).
export async function kioskFor(params: Promise<{ church: string }>): Promise<Kiosk | Response> {
  const { church: slug } = await params
  const church = await churchBySlug(slug)
  if (!church) return Response.json({ success: false, error: 'Church not found.' }, { status: 404 })
  if (!(await isKioskDevice(church.id))) {
    return Response.json(
      { success: false, locked: true, error: `Check-in only works on ${church.name}'s check-in device. Please ask a volunteer.` },
      { status: 403 }
    )
  }
  return { church, db: createAdminClient() }
}

export type CheckInState = {
  /** Today's session, or null while check-in is not open. */
  sessionId: string | null
  /** The service times parents can check in to right now. */
  serviceTimes: { id: string; label: string }[]
  /** True when the Sunday clock decides, so the server picks the service time. */
  clock: boolean
  /** Why check-in is shut on a clock day, e.g. "Check-in opens at 8:30 AM." */
  closed: string | null
}

/** Whether check-in is open and for which service, decided on the server rather than trusted from the browser. */
export async function checkInState(k: Kiosk): Promise<CheckInState> {
  const today = todayInManila()
  const findSession = () =>
    k.db.from('sessions').select('id').eq('church_id', k.church.id).eq('session_date', today).maybeSingle()

  const [times, { data: session }] = await Promise.all([listServiceTimes(k.church.id), findSession()])
  const all = times.map(({ id, label }) => ({ id, label }))
  const now = manilaClock()

  if (!now.sunday || !all.some((t) => startMinutes(t.label) !== null)) {
    return { sessionId: session?.id ?? null, serviceTimes: all, clock: false, closed: null }
  }

  const { open, opensAt } = serviceAt(all, now.minutes)
  if (!open) {
    const closed = opensAt === null ? 'Check-in is closed for today.' : `Check-in opens at ${formatMinutes(opensAt)}.`
    return { sessionId: null, serviceTimes: [], clock: true, closed }
  }

  let sessionId = session?.id ?? null
  if (!sessionId) {
    // The first kiosk visit inside a window opens today's session; nobody has to tap Start.
    await k.db
      .from('sessions')
      .upsert({ church_id: k.church.id, session_date: today }, { onConflict: 'church_id,session_date', ignoreDuplicates: true })
    sessionId = (await findSession()).data?.id ?? null
  }
  return { sessionId, serviceTimes: [open], clock: true, closed: null }
}

/** The service time a check-in goes to: the clock's on Sundays, otherwise the parent's pick (or the only one). */
export function serviceTimeFor(state: CheckInState, picked: string | undefined): string | undefined {
  const only = state.serviceTimes.length === 1 ? state.serviceTimes[0].id : undefined
  return state.clock ? only : picked || only
}
