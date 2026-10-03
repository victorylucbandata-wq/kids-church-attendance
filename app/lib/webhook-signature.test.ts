// Run: node --test app/lib/webhook-signature.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyWebhook } from './webhook-signature.ts'

const rawKey = Buffer.from('a very secret hook key for tests')
const SECRET = `v1,whsec_${rawKey.toString('base64')}`
const body = JSON.stringify({ user: { email: 'lead@example.com' }, email_data: { token_hash: 'abc' } })
const NOW = 1_800_000_000
const sign = (id: string, ts: number, b: string, key = rawKey) =>
  `v1,${createHmac('sha256', key).update(`${id}.${ts}.${b}`).digest('base64')}`
const h = (sig: string, ts = NOW, id = 'msg_1') => ({ id, timestamp: String(ts), signature: sig })

test('accepts a valid signature', () => {
  assert.equal(verifyWebhook(SECRET, h(sign('msg_1', NOW, body)), body, NOW), true)
})

test('accepts when one of several signatures matches (key rotation)', () => {
  assert.equal(verifyWebhook(SECRET, h(`v1,AAAA ${sign('msg_1', NOW, body)}`), body, NOW), true)
})

test('rejects a tampered body', () => {
  assert.equal(verifyWebhook(SECRET, h(sign('msg_1', NOW, body)), body.replace('lead@', 'evil@'), NOW), false)
})

test('rejects a signature made with another key', () => {
  assert.equal(verifyWebhook(SECRET, h(sign('msg_1', NOW, body, Buffer.from('wrong'))), body, NOW), false)
})

test('rejects old or future timestamps (replay)', () => {
  assert.equal(verifyWebhook(SECRET, h(sign('msg_1', NOW - 600, body), NOW - 600), body, NOW), false)
  assert.equal(verifyWebhook(SECRET, h(sign('msg_1', NOW + 600, body), NOW + 600), body, NOW), false)
})

test('rejects missing secret, headers, or wrong version', () => {
  assert.equal(verifyWebhook(undefined, h(sign('msg_1', NOW, body)), body, NOW), false)
  assert.equal(verifyWebhook(SECRET, { id: null, timestamp: String(NOW), signature: sign('msg_1', NOW, body) }, body, NOW), false)
  assert.equal(verifyWebhook(SECRET, h(sign('msg_1', NOW, body).replace('v1,', 'v2,')), body, NOW), false)
})
