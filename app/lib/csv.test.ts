// Run: node --test app/lib/csv.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asText, toCsv } from './csv.ts'

test('escapes commas, quotes, and newlines', () => {
  const csv = toCsv(['Name', 'Notes'], [['Santos, Maria', 'Says "hi"\nand waves']])
  assert.equal(csv, '﻿Name,Notes\r\n"Santos, Maria","Says ""hi""\nand waves"\r\n')
})

test('neutralizes formula injection in parent-typed text', () => {
  const csv = toCsv(['Notes'], [['=HYPERLINK("x")'], ['+1'], ['-2'], ['@SUM(A1)']])
  assert.deepEqual(csv.trim().split('\r\n').slice(1), [`"'=HYPERLINK(""x"")"`, `'+1`, `'-2`, `'@SUM(A1)`])
})

test('keeps phone numbers as text, even with a hostile quote', () => {
  const csv = toCsv(['Contact'], [[asText('09171234567')], [asText('09"&X')]], [0])
  assert.deepEqual(csv.trim().split('\r\n').slice(1), ['"=""09171234567"""', '"=""09""""&X"""'])
})

test('empty and missing cells stay blank', () => {
  assert.equal(toCsv(['A', 'B'], [[null, undefined]]), '﻿A,B\r\n,\r\n')
})
