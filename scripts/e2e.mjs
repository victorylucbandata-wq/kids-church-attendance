// End-to-end check against a running app, using a throwaway church and users (all removed after).
// Uses the real database in .env.local. From the app folder:
//   node --env-file=.env.local scripts/e2e.mjs http://localhost:3000
//   node --env-file=.env.local scripts/e2e.mjs https://<production address>
import { createClient } from '@supabase/supabase-js'

const env = process.env
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const B = process.argv[2] ?? 'http://localhost:3000'
const tag = Math.random().toString(36).slice(2, 8)
const slug = `e2e-test-${tag}`

// The highlighted tab's text on an admin page ('' when the page has no tabs).
const activeTab = (html) => {
  const a = html.split('aria-current="page"')[1] ?? ''
  return a.slice(a.indexOf('>') + 1).split('</a>')[0].replace(/<[^>]*>|[^A-Za-z]/g, '')
}

let passed = 0, failed = 0
const check = (name, ok, extra = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra && !ok ? `  -> ${extra}` : ''}`) }

class Jar {
  c = new Map()
  header() { return [...this.c].map(([k, v]) => `${k}=${v}`).join('; ') }
  store(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = raw.split(';')
      const i = pair.indexOf('='); const k = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim()
      const expired = attrs.some((a) => /max-age=0\b/i.test(a) || /expires=thu, 01 jan 1970/i.test(a))
      if (!v || expired) this.c.delete(k); else this.c.set(k, v)
    }
  }
}
async function call(jar, method, path, body) {
  const res = await fetch(B + path, {
    method, redirect: 'manual',
    headers: { cookie: jar?.header() ?? '', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  jar?.store(res)
  const text = await res.text()
  let json = null; try { json = JSON.parse(text) } catch {}
  return { status: res.status, location: res.headers.get('location') ?? '', json, text }
}
async function signIn(email) {
  const jar = new Jar()
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const r = await call(jar, 'GET', `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`)
  return { jar, r }
}

const made = { users: [], churchId: null }
try {
  // ---------- setup ----------
  const { data: church } = await admin.from('churches').insert({ name: `E2E Test ${tag}`, slug }).select('id').single()
  made.churchId = church.id
  const { data: st } = await admin.from('service_times').insert({ church_id: church.id, label: '10:00 AM' }).select('id').single()
  const { data: ag } = await admin.from('age_groups').insert({ church_id: church.id, name: 'E2E Kids', sort_order: 1 }).select('id').single()
  const mk = async (who) => {
    const { data, error } = await admin.auth.admin.createUser({ email: `${who}.${tag}@e2e.invalid`, email_confirm: true })
    if (error) throw error
    made.users.push(data.user.id); return data.user
  }
  const lead = await mk('lead'), vol = await mk('vol'), net = await mk('net')
  await admin.from('church_memberships').insert([
    { church_id: church.id, user_id: lead.id, role: 'lead' },
    { church_id: church.id, user_id: vol.id, role: 'volunteer' },
  ])
  await admin.from('network_admins').insert({ user_id: net.id })
  const { data: lucban } = await admin.from('churches').select('id').eq('slug', 'lucban').single()
  const { data: lucbanMember } = await admin.from('members').select('id').eq('church_id', lucban.id).limit(1).single()

  // ---------- kiosk (no account) ----------
  let r = await call(null, 'GET', '/')
  check('home page lists churches', r.status === 200 && r.text.includes('Victory Lucban') && r.text.includes(`E2E Test ${tag}`), `status ${r.status}`)
  r = await call(null, 'GET', '/lucban')
  check('/lucban kiosk renders', r.status === 200 && r.text.includes('Victory Lucban'), `status ${r.status}`)
  r = await call(null, 'GET', '/no-such-church')
  check('unknown church is 404', r.status === 404, `status ${r.status}`)
  r = await call(null, 'GET', '/check-in/returning')
  check('old kiosk URL redirects to picker', [307, 308].includes(r.status) && r.location.endsWith('/'), `${r.status} ${r.location}`)
  r = await call(null, 'GET', '/api/kiosk/lucban/setup')
  check('Lucban setup: 3 service times', r.json?.success && r.json.serviceTimes.length === 3 && r.json.ageGroups.length >= 1, JSON.stringify(r.json)?.slice(0, 120))
  r = await call(null, 'GET', `/api/kiosk/${slug}/setup`)
  check('test church setup is its own', r.json?.serviceTimes?.length === 1 && r.json.serviceTimes[0].label === '10:00 AM', JSON.stringify(r.json)?.slice(0, 120))
  r = await call(null, 'GET', `/api/kiosk/${slug}/members`)
  check('kiosk before session: not open', r.json?.success && r.json.sessionId === null)

  // ---------- admin without sign-in ----------
  r = await call(null, 'GET', '/admin')
  check('/admin redirects to login when signed out', r.status === 307 && r.location.includes('/admin/login'), `${r.status} ${r.location}`)
  r = await call(null, 'GET', '/api/admin/data')
  check('/api/admin/data is 401 when signed out', r.status === 401)

  // ---------- lead signs in ----------
  const L = await signIn(lead.email)
  check('lead sign-in link lands on church picker', L.r.status === 307 && L.r.location.includes('/admin/choose'), `${L.r.status} ${L.r.location}`)
  check('session limit cookie set', L.jar.c.has('session_limit'))
  r = await call(L.jar, 'GET', '/api/admin/data')
  check('single-church lead goes straight in', r.json?.success && r.json.church?.slug === slug, JSON.stringify(r.json)?.slice(0, 160))
  r = await call(L.jar, 'POST', '/api/admin/church', { churchId: lucban.id })
  check('lead cannot switch into Lucban', r.status === 403)

  // ---------- navigation ----------
  for (const [path, tab] of [['/admin', 'Today'], ['/admin/members', 'Members'], ['/admin/members/import', 'Members'], ['/admin/sessions', 'History'], ['/admin/settings', 'Settings'], ['/admin/age-groups', 'Settings'], ['/admin/service-times', 'Settings'], ['/admin/team', 'Settings']]) {
    r = await call(L.jar, 'GET', path)
    check(`${path} shows the tabs with ${tab} highlighted`, r.status === 200 && activeTab(r.text) === tab && r.text.includes('href="/admin/settings"'), `${r.status} active=${activeTab(r.text)}`)
  }
  r = await call(L.jar, 'GET', '/admin/settings')
  check('lead sees Team in Settings, not Switch church (one church)', r.text.includes('href="/admin/team"') && !r.text.includes('href="/admin/choose"'))
  r = await call(null, 'GET', '/admin/login')
  check('sign-in page has no tabs', r.status === 200 && !r.text.includes('aria-label="Admin sections"'))
  r = await call(L.jar, 'POST', '/api/admin/session')
  check('lead starts today\'s session', r.json?.success === true, r.text.slice(0, 160))
  r = await call(L.jar, 'POST', '/api/admin/members', { first_name: 'Ana', last_name: `E2E${tag}`, role: 'child', age_group_id: ag.id })
  check('lead adds a member', r.json?.success === true, r.text.slice(0, 160))
  const memberId = r.json?.id

  // ---------- kiosk flows for the test church ----------
  r = await call(null, 'GET', `/api/kiosk/${slug}/members`)
  check('kiosk lists only this church\'s members', r.json?.members?.length === 1 && r.json.members[0].memberId === memberId, JSON.stringify(r.json)?.slice(0, 160))
  r = await call(null, 'POST', `/api/kiosk/${slug}/check-in`, { memberId: lucbanMember.id, serviceTimeId: st.id })
  check('kiosk rejects another church\'s member', r.status === 400, `${r.status} ${r.text.slice(0, 120)}`)
  r = await call(null, 'POST', `/api/kiosk/${slug}/check-in`, { memberId, serviceTimeId: st.id, notes: 'peanuts' })
  check('kiosk returning check-in works', r.json?.success === true, r.text.slice(0, 160))
  const firstTimer = {
    parentName: 'E2E Parent', contactNumber: '09170000000', childFirstName: 'Ben', childLastName: `E2E${tag}`,
    ageGroupId: ag.id, serviceTimeId: st.id,
  }
  r = await call(null, 'POST', `/api/kiosk/${slug}/register`, firstTimer)
  check('first-timer registration needs privacy consent', r.status === 400 && /privacy/.test(r.json?.error ?? ''), `${r.status} ${r.text.slice(0, 120)}`)
  r = await call(null, 'POST', `/api/kiosk/${slug}/register`, { ...firstTimer, consent: true })
  check('kiosk first-timer registration works', r.json?.success === true, r.text.slice(0, 160))

  r = await call(L.jar, 'GET', '/api/admin/data')
  const rows = r.json?.attendanceRows ?? []
  check('dashboard sees 2 check-ins and 1 first timer', r.json?.summary?.checkedIn === 2 && r.json.summary.firstTimersToday === 1, JSON.stringify(r.json?.summary))
  check('dashboard shows only this church\'s members', rows.length === 2 && rows.every((x) => x.lastName === `E2E${tag}`), `${rows.length} rows`)
  check('dashboard labels the service time', rows.filter((x) => x.checkedIn).every((x) => x.timeSlot === '10:00 AM'))

  r = await call(L.jar, 'GET', '/api/admin/sessions/export')
  const lines = r.text.replace(/^﻿/, '').trim().split('\r\n')
  check('export: Church column first, 2 rows, all this church', lines[0].startsWith('Church,Date') && lines.length === 3 && lines.slice(1).every((l) => l.startsWith(`E2E Test ${tag},`)), lines.slice(0, 2).join(' | '))
  r = await call(L.jar, 'GET', '/api/admin/sessions/export?scope=network')
  check('lead cannot export the whole network', r.status === 403, `${r.status}`)

  // ---------- member import ----------
  const csv = [
    'Last Name,First Name,Nickname,Birthday,Role,Age Group,Parent / Guardian,Contact Number,Notes',
    `E2E${tag},Cara,,2018-03-25,Child,e2e kids,Ana,09171234567,"Peanuts, mild"`,
    `E2E${tag},Dan,,,Serve Team,,,,`,
    `E2E${tag},Ana,,,,,,,`,
    `E2E${tag},Eli,,13/45/2018,,E2E Kid,,,`,
  ].join('\r\n')
  r = await call(L.jar, 'POST', '/api/admin/members/import', { csv })
  check('import preview: ready, ready, duplicate, problem', r.json?.rows?.map((x) => x.status).join() === 'ok,ok,duplicate,error', r.text.slice(0, 200))
  r = await call(L.jar, 'POST', '/api/admin/members/import', { csv, confirm: true })
  check('import saves the 2 ready rows', r.json?.imported === 2, r.text.slice(0, 200))
  r = await call(L.jar, 'POST', '/api/admin/members/import', { csv, confirm: true })
  check('re-upload imports nothing new', r.json?.imported === 0, r.text.slice(0, 200))
  const { count: imported } = await admin.from('members').select('id', { count: 'exact', head: true }).eq('church_id', church.id)
  check('test church now has 4 members', imported === 4, String(imported))

  // ---------- team rules ----------
  r = await call(L.jar, 'GET', '/api/admin/team')
  check('lead sees team of 2', r.json?.team?.length === 2, r.text.slice(0, 160))
  r = await call(L.jar, 'PATCH', '/api/admin/team', { userId: lead.id, role: 'volunteer' })
  check('only Lead cannot demote themselves', r.status === 409, `${r.status}`)
  const V = await signIn(vol.email)
  r = await call(V.jar, 'GET', '/api/admin/team')
  check('volunteer cannot open team', r.status === 403, `${r.status}`)
  r = await call(V.jar, 'GET', '/api/admin/data')
  check('volunteer can run the dashboard', r.json?.success === true)
  r = await call(V.jar, 'GET', '/admin/settings')
  check('volunteer does not see Team in Settings', r.status === 200 && r.text.includes('href="/admin/age-groups"') && !r.text.includes('href="/admin/team"'))
  r = await call(L.jar, 'DELETE', '/api/admin/team', { userId: vol.id })
  check('lead removes volunteer', r.json?.success === true, r.text.slice(0, 120))
  r = await call(V.jar, 'GET', '/api/admin/data')
  check('removed volunteer loses access on next request', r.status === 409, `${r.status}`)

  // ---------- session limit ----------
  const tampered = new Jar(); tampered.c = new Map(L.jar.c); tampered.c.set('session_limit', '9999999999999.forged')
  r = await call(tampered, 'GET', '/api/admin/data')
  check('forged session limit is rejected', r.status === 401, `${r.status}`)
  const noLimit = new Jar(); noLimit.c = new Map(L.jar.c); noLimit.c.delete('session_limit')
  r = await call(noLimit, 'GET', '/api/admin/data')
  check('missing session limit is rejected', r.status === 401, `${r.status}`)

  // ---------- network admin ----------
  const N = await signIn(net.email)
  r = await call(N.jar, 'GET', '/network')
  check('network page renders for network admin', r.status === 200 && r.text.includes(`E2E Test ${tag}`) && r.text.includes('Victory Lucban'), `${r.status}`)
  r = await call(L.jar, 'GET', '/network')
  check('lead is sent away from /network', r.status === 307, `${r.status}`)
  r = await call(N.jar, 'POST', '/api/admin/church', { churchId: church.id })
  r = await call(N.jar, 'GET', '/api/admin/data')
  check('network admin views church read-only', r.json?.role === 'network' && r.json.summary.checkedIn === 2, JSON.stringify(r.json)?.slice(0, 120))
  r = await call(N.jar, 'POST', '/api/admin/members', { first_name: 'X', last_name: 'Y' })
  check('network view blocks writes', r.status === 403, `${r.status}`)
  r = await call(N.jar, 'POST', '/api/admin/members/import', { csv })
  check('network view blocks import', r.status === 403, `${r.status}`)
  r = await call(N.jar, 'GET', '/api/admin/sessions/export?scope=network')
  check('network export includes both churches', r.status === 200 && r.text.includes(`E2E Test ${tag},`) && r.text.includes('Victory Lucban,'), `${r.status}`)

  // ---------- sign out ----------
  r = await call(L.jar, 'POST', '/api/auth/logout')
  r = await call(L.jar, 'GET', '/api/admin/data')
  check('sign out ends the session', r.status === 401, `${r.status}`)
} catch (e) {
  failed++
  console.log('ERROR', e?.message ?? e)
} finally {
  // ---------- cleanup: everything tagged with this run ----------
  if (made.churchId) {
    for (const t of ['attendance', 'first_timers', 'members', 'sessions', 'age_groups', 'service_times', 'church_memberships']) {
      const { error } = await admin.from(t).delete().eq('church_id', made.churchId)
      if (error) console.log('cleanup', t, error.message)
    }
    await admin.from('churches').delete().eq('id', made.churchId)
  }
  for (const id of made.users) {
    await admin.from('network_admins').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
  const { count } = await admin.from('churches').select('id', { count: 'exact', head: true }).like('slug', 'e2e-test-%')
  console.log(`cleanup: ${count ?? '?'} test churches left, ${made.users.length} test users deleted`)
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}
