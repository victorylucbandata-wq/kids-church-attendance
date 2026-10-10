export type Role = 'child' | 'volunteer'

export type AgeGroup = {
  id: string
  name: string
  sort_order: number
}

export type Session = {
  id: string
  session_date: string
  generated_at: string
}

export type UncheckedMember = {
  memberId: string
  firstName: string
  lastName: string
  nickname: string | null
  ageGroup: string
  role: Role
  /** Whether a birthday is today or within the week; the kiosk never gets the date. */
  birthday: 'today' | 'week' | null
}

export type AttendanceRow = {
  attendanceId: string
  memberId: string
  serviceTimeId: string | null
  memberName: string
  firstName: string
  lastName: string
  nickname: string | null
  ageGroup: string
  role: Role
  /** Service time label for this church, e.g. "9:00 AM". */
  timeSlot: string | null
  checkedIn: boolean
  checkedInAt: string | null
  checkedOutAt: string | null
  birthday: string | null
  notes: string | null
}

export type FirstTimerRecord = {
  submittedAt: string
  parentName: string
  contactNumber: string
  childFirstName: string
  childLastName: string
  childNickname: string | null
  age: string
  ageGroup: string
  birthday: string | null
  notes: string | null
}

export type ServiceTimeOption = { id: string; label: string }

export type AdminData = {
  church: { id: string; name: string; slug: string }
  role: 'lead' | 'volunteer' | 'staff' | 'network'
  email: string
  serviceTimes: ServiceTimeOption[]
  session: Session | null
  /** Today's Serve Team roster, per service. */
  roster: { serviceTimeId: string; memberId: string; serveRole: string; memberName: string }[]
  /** Sunday services whose check-in has closed (kids from them should have been picked up). */
  closedServiceIds: string[]
  attendanceRows: AttendanceRow[]
  firstTimers: FirstTimerRecord[]
  summary: {
    totalMembers: number
    checkedIn: number
    notCheckedIn: number
    firstTimersToday: number
    byTimeSlot: Record<string, number>
    byRole: Record<string, number>
    byAgeGroup: Record<string, number>
    checkedOut: number
    stillHere: number
  }
}
