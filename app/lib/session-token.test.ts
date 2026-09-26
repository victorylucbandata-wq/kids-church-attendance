// Run: node --test app/lib/session-token.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSessionToken, isValidSessionToken, safeEqual } from './session-token.ts'

const SECRET = 'correct horse'

test('a fresh token is valid', () => {
  assert.equal(isValidSessionToken(createSessionToken(SECRET, 60), SECRET), true)
})

test('the old fixed cookie value is rejected', () => {
  assert.equal(isValidSessionToken('authenticated', SECRET), false)
})

test('forged, tampered, and expired tokens are rejected', () => {
  const token = createSessionToken(SECRET, 60, 1_000)
  const [expires, sig] = token.split('.')
  assert.equal(isValidSessionToken(token, 'wrong password', 1_000), false)
  assert.equal(isValidSessionToken(`${Number(expires) + 999999}.${sig}`, SECRET, 1_000), false)
  assert.equal(isValidSessionToken(token, SECRET, Number(expires)), false)
  assert.equal(isValidSessionToken(`${token}.x`, SECRET, 1_000), false)
})

test('no secret configured means nobody is admin', () => {
  assert.equal(isValidSessionToken(createSessionToken(SECRET, 60), undefined), false)
  assert.equal(isValidSessionToken(createSessionToken(SECRET, 60), ''), false)
})

test('safeEqual compares exactly', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('abc', 'abcd'), false)
})
