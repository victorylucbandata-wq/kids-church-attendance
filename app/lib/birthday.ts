// `today` defaults to the device's date; servers pass Manila's.
export function isBirthdayToday(birthday: string | null, today = new Date()): boolean {
  if (!birthday) return false
  const bday = new Date(birthday + 'T00:00:00')
  return bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate()
}

export function isBirthdayThisWeek(birthday: string | null, now = new Date()): boolean {
  if (!birthday) return false
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const bday = new Date(birthday + 'T00:00:00')
  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
  const diffMs = thisYear.getTime() - today.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 6
}
