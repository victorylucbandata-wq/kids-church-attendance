// Member import: parse a CSV (the template, or the attendance export) and check every row.
// Pure, so the server can run it for both the preview and the real import.

export const MAX_ROWS = 2000

export type ImportRow = {
  line: number
  name: string
  status: 'ok' | 'duplicate' | 'error'
  problems: string[]
  /** Set when status is 'ok': the members row to insert (without church_id). */
  member?: {
    first_name: string
    last_name: string
    nickname: string | null
    birthday: string | null
    role: 'child' | 'volunteer'
    age_group_id: string | null
    parent_name: string | null
    contact_number: string | null
    notes: string | null
  }
}

export type ExistingMember = { first_name: string; last_name: string; birthday: string | null }

// RFC 4180: quoted fields may hold commas, quotes ("") and line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

// Undo what our own export adds: ="0917…" keeps leading zeros, a leading ' blocks formulas.
function clean(value: string | undefined): string {
  const v = (value ?? '').trim()
  const text = v.match(/^="(.*)"$/)
  if (text) return text[1].replace(/""/g, '"').trim()
  return /^'[=+\-@]/.test(v) ? v.slice(1) : v
}

// YYYY-MM-DD, or M/D/YYYY (how Excel and Sheets in the Philippines save dates).
export function parseBirthday(value: string): string | null | 'invalid' {
  if (!value) return null
  let y: number, m: number, d: number
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]]
  else if (mdy) [y, m, d] = [+mdy[3], +mdy[1], +mdy[2]]
  else return 'invalid'
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 1900) return 'invalid'
  if (date.getTime() > Date.now()) return 'invalid'
  return date.toISOString().slice(0, 10)
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

function closest(name: string, options: string[]): string | null {
  const n = name.toLowerCase()
  let best: string | null = null
  let bestScore = Infinity
  for (const o of options) {
    const l = o.toLowerCase()
    const score = l.includes(n) || n.includes(l) ? 0 : distance(n, l)
    if (score < bestScore) { best = o; bestScore = score }
  }
  return best !== null && bestScore <= Math.max(2, Math.floor(name.length / 2)) ? best : null
}

const key = (first: string, last: string, birthday: string | null) =>
  `${first.toLowerCase()}|${last.toLowerCase()}|${birthday ?? ''}`

const COLUMNS = {
  last: ['last name'],
  first: ['first name'],
  nickname: ['nickname'],
  birthday: ['birthday'],
  role: ['role'],
  ageGroup: ['age group'],
  parent: ['parent / guardian', 'parent/guardian', 'parent', 'guardian'],
  contact: ['contact number', 'contact'],
  notes: ['notes'],
} as const

export function checkImport(
  text: string,
  ageGroups: { id: string; name: string }[],
  existing: ExistingMember[]
): { error: string } | { rows: ImportRow[] } {
  const all = parseCsv(text).filter((r) => r.some((c) => c.trim()))
  if (all.length < 2) return { error: 'The file has no member rows. Fill in the template and save it as CSV.' }
  if (all.length - 1 > MAX_ROWS) return { error: `The file has more than ${MAX_ROWS} rows. Split it into smaller files.` }

  const header = all[0].map((h) => h.trim().toLowerCase())
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([k, names]) => [k, header.findIndex((h) => (names as readonly string[]).includes(h))])
  ) as Record<keyof typeof COLUMNS, number>
  if (col.first < 0 || col.last < 0) {
    return { error: 'The first row must hold the column names, including "First Name" and "Last Name". Use the template.' }
  }

  const groupByName = new Map(ageGroups.map((g) => [g.name.toLowerCase(), g.id]))
  const seen = new Set(existing.map((m) => key(m.first_name.trim(), m.last_name.trim(), m.birthday)))

  // The header is line 1, so data starts at line 2 (blank lines are skipped, which is fine for a hint).
  return {
    rows: all.slice(1).map((cells, i): ImportRow => {
      const get = (k: keyof typeof COLUMNS) => (col[k] < 0 ? '' : clean(cells[col[k]]))
      const first = get('first')
      const last = get('last')
      const problems: string[] = []

      if (!first) problems.push('First name is missing.')
      if (!last) problems.push('Last name is missing.')

      const birthdayText = get('birthday')
      const birthday = parseBirthday(birthdayText)
      if (birthday === 'invalid') problems.push(`Birthday "${birthdayText}" is not a date. Use YYYY-MM-DD, e.g. 2018-03-25.`)

      const roleText = get('role').toLowerCase()
      const role = !roleText || roleText === 'child' ? 'child'
        : ['serve team', 'volunteer'].includes(roleText) ? 'volunteer' : null
      if (!role) problems.push(`Role "${get('role')}" should be Child or Serve Team.`)

      // The export writes "Serve Team" as the age group of volunteers; that is not a real group.
      const groupText = get('ageGroup')
      let ageGroupId: string | null = null
      if (groupText && !(role === 'volunteer' && groupText.toLowerCase() === 'serve team')) {
        ageGroupId = groupByName.get(groupText.toLowerCase()) ?? null
        if (!ageGroupId) {
          const hint = closest(groupText, ageGroups.map((g) => g.name))
          problems.push(
            `Age group "${groupText}" doesn't exist.` +
              (hint ? ` Did you mean "${hint}"?` : ` Add it under Age Groups first, or leave it blank.`)
          )
        }
      }

      const name = [first, last].filter(Boolean).join(' ') || '(no name)'
      if (problems.length) return { line: i + 2, name, status: 'error', problems }

      const k = key(first, last, birthday as string | null)
      if (seen.has(k)) return { line: i + 2, name, status: 'duplicate', problems: ['Already a member, or listed twice in this file. Skipped.'] }
      seen.add(k)

      return {
        line: i + 2,
        name,
        status: 'ok',
        problems: [],
        member: {
          first_name: first,
          last_name: last,
          nickname: get('nickname') || null,
          birthday: birthday as string | null,
          role: role!,
          age_group_id: ageGroupId,
          parent_name: get('parent') || null,
          contact_number: get('contact') || null,
          notes: get('notes') || null,
        },
      }
    }),
  }
}
