// Run: node --test app/lib/service-clock.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatMinutes, serviceAt, startMinutes } from './service-clock.ts'
import { manilaClock } from './dates.ts'

const at = (h: number, m = 0) => h * 60 + m
const lucban = [{ label: '9:00 AM' }, { label: '11:00 AM' }, { label: 'Special Event' }]

test('reads start times from service names', () => {
  assert.equal(startMinutes('9:00 AM'), at(9))
  assert.equal(startMinutes('11am'), at(11))
  assert.equal(startMinutes('12:00 PM'), at(12))
  assert.equal(startMinutes('12:15 am'), 15)
  assert.equal(startMinutes('4:30 P.M. Tagalog'), at(16, 30))
  assert.equal(startMinutes('Special Event'), null)
  assert.equal(startMinutes('13:00 PM'), null)
})

test('Lucban Sunday: 9 AM opens 8:30, hands over to 11 AM at 10:30, closes 12:30', () => {
  assert.deepEqual(serviceAt(lucban, at(8, 29)), { open: null, opensAt: at(8, 30) })
  assert.equal(serviceAt(lucban, at(8, 30)).open?.label, '9:00 AM')
  assert.equal(serviceAt(lucban, at(10, 29)).open?.label, '9:00 AM')
  assert.equal(serviceAt(lucban, at(10, 30)).open?.label, '11:00 AM')
  assert.equal(serviceAt(lucban, at(12, 29)).open?.label, '11:00 AM')
  assert.deepEqual(serviceAt(lucban, at(12, 30)), { open: null, opensAt: null })
})

test('overlapping services: the earlier stays open until it closes, gaps say when the next opens', () => {
  const close = [{ label: '9:00 AM' }, { label: '10:00 AM' }]
  assert.equal(serviceAt(close, at(10, 15)).open?.label, '9:00 AM')
  assert.equal(serviceAt(close, at(10, 30)).open?.label, '10:00 AM')
  const apart = [{ label: '8:00 AM' }, { label: '4:00 PM' }]
  assert.deepEqual(serviceAt(apart, at(12)), { open: null, opensAt: at(15, 30) })
  assert.deepEqual(serviceAt([{ label: 'Special Event' }], at(9)), { open: null, opensAt: null })
})

test('formats and Manila clock', () => {
  assert.equal(formatMinutes(at(8, 30)), '8:30 AM')
  assert.equal(formatMinutes(at(12, 30)), '12:30 PM')
  assert.equal(formatMinutes(at(15, 30)), '3:30 PM')
  // Sunday 2026-10-11 00:30 UTC is 8:30 AM in Manila; Saturday 23:00 UTC is Sunday 7:00 AM there.
  assert.deepEqual(manilaClock(new Date('2026-10-11T00:30:00Z')), { sunday: true, minutes: at(8, 30) })
  assert.deepEqual(manilaClock(new Date('2026-10-10T23:00:00Z')), { sunday: true, minutes: at(7) })
  assert.deepEqual(manilaClock(new Date('2026-10-11T16:00:00Z')), { sunday: false, minutes: 0 })
})
