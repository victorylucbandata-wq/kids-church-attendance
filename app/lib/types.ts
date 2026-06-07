export type TimeSlot = '9am' | '11am' | 'Special'

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
  birthday: string | null
}

export type AttendanceRow = {
  attendanceId: string
  memberName: string
  firstName: string
  lastName: string
  nickname: string | null
  ageGroup: string
  role: Role
  timeSlot: TimeSlot | null
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

export type AdminData = {
  session: Session | null
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
