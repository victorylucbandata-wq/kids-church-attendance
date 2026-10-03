// Run: node --test app/lib/member-import.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkImport, parseBirthday, parseCsv } from './member-import.ts'
import { asText, toCsv } from './csv.ts'

const GROUPS = [{ id: 'g1', name: 'Toddlers' }, { id: 'g2', name: 'Big Kids' }]
const HEADER = 'Last Name,First Name,Nickname,Birthday,Role,Age Group,Parent / Guardian,Contact Number,Notes'

const rows = (csv: string, existing: { first_name: string; last_name: string; birthday: string | null }[] = []) => {
  const r = checkImport(csv, GROUPS, existing)
  if ('error' in r) throw new Error(r.error)
  return r.rows
}

test('parses quoted commas, quotes and line breaks', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi""\nthere"\r\nd,e,f'), [['a', 'b, c', 'say "hi"\nthere'], ['d', 'e', 'f']])
})

test('birthday accepts ISO and M/D/YYYY, rejects nonsense', () => {
  assert.equal(parseBirthday('2018-03-25'), '2018-03-25')
  assert.equal(parseBirthday('3/25/2018'), '2018-03-25')
  assert.equal(parseBirthday(''), null)
  assert.equal(parseBirthday('2018-02-30'), 'invalid')
  assert.equal(parseBirthday('25/03/2018'), 'invalid')
  assert.equal(parseBirthday('2999-01-01'), 'invalid')
})

test('a good row becomes a member', () => {
  const [r] = rows(`${HEADER}\nSantos,Maria,Mia,2018-03-25,Child,toddlers,Ana Santos,09171234567,Peanut allergy`)
  assert.equal(r.status, 'ok')
  assert.deepEqual(r.member, {
    first_name: 'Maria', last_name: 'Santos', nickname: 'Mia', birthday: '2018-03-25', role: 'child',
    age_group_id: 'g1', parent_name: 'Ana Santos', contact_number: '09171234567', notes: 'Peanut allergy',
  })
})

test('row errors: missing name, bad date, bad role, unknown age group with hint', () => {
  const [a, b] = rows(`${HEADER}\n,Maria,,13/45/2018,Parent,,,,\nCruz,Juan,,,Child,Big Kid,,,`)
  assert.equal(a.status, 'error')
  assert.equal(a.problems.length, 3)
  assert.equal(b.status, 'error')
  assert.match(b.problems[0], /Did you mean "Big Kids"/)
})

test('duplicates are skipped against existing members and within the file', () => {
  const r = rows(`${HEADER}\nSantos,Maria,,2018-03-25,,,,,\nsantos,MARIA,,3/25/2018,,,,,\nReyes,Ben,,,,,,,`, [
    { first_name: 'Ben', last_name: 'Reyes', birthday: null },
  ])
  assert.deepEqual(r.map((x) => x.status), ['ok', 'duplicate', 'duplicate'])
})

test('round-trips our own export: phone text, Serve Team age group, extra columns', () => {
  const csv = toCsv(
    ['Church', 'Date', 'Last Name', 'First Name', 'Role', 'Age Group', 'Contact Number', 'Notes'],
    [['Lucban', '2026-09-27', 'Lim', 'Grace', 'Serve Team', 'Serve Team', asText('09170000000'), '=1+1']],
    [6]
  )
  const [r] = rows(csv)
  assert.equal(r.status, 'ok')
  assert.equal(r.member?.role, 'volunteer')
  assert.equal(r.member?.age_group_id, null)
  assert.equal(r.member?.contact_number, '09170000000')
  assert.equal(r.member?.notes, '=1+1')
})

test('file-level errors', () => {
  assert.ok('error' in checkImport('', GROUPS, []))
  assert.ok('error' in checkImport('Name,Birthday\nMaria,2018-01-01', GROUPS, []))
})
