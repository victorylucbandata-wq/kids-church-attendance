export type AgeGroup = 'Toddlers' | 'Preschool' | 'Kinder' | 'Grades 1-3' | 'Grades 4-6' | 'Not sure'

export type ServiceSchedule = 'Sunday Morning' | 'Sunday Afternoon' | 'Special Event'

export type Session = {
  sessionId: string
  sessionDate: string
  schedule: ServiceSchedule
  generatedAt: string
}

export type UncheckedMember = {
  attendanceId: string
  memberId: string
  memberName: string
  ageGroup: AgeGroup
}

export type AttendanceRow = {
  attendanceId: string
  memberName: string
  ageGroup: AgeGroup
  checkedIn: boolean
  checkedInAt: string | null
  notes: string
}

export type FirstTimerRecord = {
  submittedAt: string
  parentName: string
  contactNumber: string
  childName: string
  age: string
  ageGroup: AgeGroup
  notes: string
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
  }
}
