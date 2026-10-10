// On Sundays check-in runs on the clock: a service time named with a time, like "9:00 AM",
// opens 30 minutes before it starts and closes 90 minutes after. Times without one
// ("Special Event"), and every other day, still open when a lead taps Start Session.
export const OPENS_BEFORE = 30
export const CLOSES_AFTER = 90

/** Minutes after midnight for names like "9:00 AM", "11am" or "4:30 PM Tagalog"; null if the name isn't a time. */
// ponytail: the start time is read from the name; add a start_time column if names stop being times.
export function startMinutes(label: string): number | null {
  const m = label.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\b/i)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2] ?? 0)
  if (hour < 1 || hour > 12 || minute > 59) return null
  return ((hour % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0)) * 60 + minute
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** The service open at `now` (when two overlap, the earlier stays open until it closes) and, if none, when the next opens. */
export function serviceAt<T extends { label: string }>(times: T[], now: number): { open: T | null; opensAt: number | null } {
  const timed = times
    .map((t) => ({ t, start: startMinutes(t.label) }))
    .filter((x): x is { t: T; start: number } => x.start !== null)
    .sort((a, b) => a.start - b.start)
  const open = timed.find((x) => now >= x.start - OPENS_BEFORE && now < x.start + CLOSES_AFTER)
  const next = timed.find((x) => x.start - OPENS_BEFORE > now)
  return { open: open?.t ?? null, opensAt: open || !next ? null : next.start - OPENS_BEFORE }
}

/** The timed services whose check-in window has already closed at `now`. */
export function closedBy<T extends { label: string }>(times: T[], now: number): T[] {
  return times.filter((t) => {
    const start = startMinutes(t.label)
    return start !== null && now >= start + CLOSES_AFTER
  })
}
