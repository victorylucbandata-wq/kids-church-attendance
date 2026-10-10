// Sunday in the Philippines, regardless of which region the server runs in.
export function todayInManila(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

// Day of week and minutes after midnight in the Philippines, for the Sunday check-in clock.
export function manilaClock(now = new Date()): { sunday: boolean; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(now)
      .map((x) => [x.type, x.value])
  )
  return { sunday: p.weekday === 'Sun', minutes: Number(p.hour) * 60 + Number(p.minute) }
}
