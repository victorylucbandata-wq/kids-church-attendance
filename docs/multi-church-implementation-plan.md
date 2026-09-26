# Implementation Plan: Multi-Church Kids Check-In

**Companion to:** [PRD](multi-church-prd.md)
**Date:** 2026-09-27
**Supersedes:** Phase 2.1 (Supabase Auth admin accounts) and the Row Level Security section (1.2) of [PLAN_DETAILED.md](PLAN_DETAILED.md). Neither was built. The rest of that overhaul plan shipped and remains the historical record.

---

## 1. Starting point (verified 2026-09-27)

What the code and database actually look like today, as opposed to what the original overhaul plan described.

| Area | Today | Source |
|---|---|---|
| Tenancy | None. No church concept anywhere in `app/`. | `grep -rniE "church_id\|tenant\|lucban" app` returned nothing |
| Admin auth | Shared `ADMIN_PASSWORD`; signed `<expiry>.<HMAC>` cookie since PR #3 | `app/lib/auth.ts`, `app/lib/session-token.ts` |
| Server DB key | The **publishable** key, not a secret or service-role key | `.env.local` defines only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ADMIN_PASSWORD` |
| RLS | Effectively open: the publishable key reads every table (members 180, attendance 298, sessions 18 rows) | REST `count=exact` checks, 2026-09-27 |
| Key exposure | Publishable key is **not** in any browser bundle; `app/lib/supabase/client.ts` is unused | Grep of local `.next/static` and 12 live JS files, 2026-09-27 |
| Blocking constraints | `sessions.session_date UNIQUE`, `age_groups.name UNIQUE`, `attendance.time_slot CHECK IN ('9am','11am','Special')` | PLAN_DETAILED.md section 1.2 |
| Hard-coded service times | `app/check-in/new/page.tsx`, `app/check-in/returning/page.tsx`, `app/admin/AdminDashboard.tsx`, `app/api/admin/sessions/export/route.ts`, `app/admin/sessions/page.tsx` (slot ordering) | Source |
| Functions region | `sin1` since PR #3 (was `iad1`) | `vercel.json` |

## 2. Vendor constraints that shaped this plan

| Constraint | Consequence | Source |
|---|---|---|
| Supabase built-in email: "2 messages per hour", refuses addresses outside the project team | A custom email path is mandatory for invite and sign-in links | [auth-smtp](https://supabase.com/docs/guides/auth/auth-smtp) |
| Send Email hook is available on Free, and can be "any HTTP endpoint"; requests signed with `standardwebhooks` | Supabase calls an n8n webhook, which verifies the signature and sends through Gmail | [auth-hooks](https://supabase.com/docs/guides/auth/auth-hooks), [send-email-hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) |
| Resend requires "at least one domain" verified | Resend was dropped in favour of n8n + Gmail, since there is no domain yet | [Resend domains](https://resend.com/docs/dashboard/domains/introduction) |
| Session time-boxing and inactivity timeout are "only available on Pro Plans and up"; by default a session "lasts indefinitely" | The 30-day and 12-hour limits are enforced by the app (section 4.3), not by Supabase settings | [sessions](https://supabase.com/docs/guides/auth/sessions) |
| Free plan: 2 active projects, 500 MB DB, 50,000 MAU, pause after 1 week idle | One shared project for all churches; keep-alive cron stays | [pricing](https://supabase.com/pricing) |

## 3. Data model changes

All changes are additive migrations with a backfill, so Lucban keeps working between steps.

### 3.1 New tables

```sql
CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE church_memberships (
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead', 'volunteer')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (church_id, user_id)
);

CREATE TABLE network_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE service_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  label TEXT NOT NULL,            -- e.g. '9:00 AM', 'Special Event'
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (church_id, label)
);
```

**Why a separate `network_admins` table** rather than a role on `church_memberships`: the network admin is not a member of a church, and must not become one by accident when a church is created.

**Why `service_times` rows rather than a text column:** labels become editable per church, and attendance keeps a stable reference when a label is renamed.

### 3.2 Existing tables: dispositions

| Table | Change | Backfill |
|---|---|---|
| `members` | Add `church_id UUID NOT NULL REFERENCES churches` | All rows to Victory Lucban |
| `age_groups` | Add `church_id NOT NULL`; replace `UNIQUE(name)` with `UNIQUE(church_id, name)` | All rows to Lucban |
| `sessions` | Add `church_id NOT NULL`; replace `UNIQUE(session_date)` with `UNIQUE(church_id, session_date)`; add `generated_by UUID REFERENCES auth.users` | All rows to Lucban; `generated_by` stays null for history |
| `attendance` | Add `church_id NOT NULL` (denormalised so RLS stays a single-column check); add `service_time_id UUID REFERENCES service_times`; drop the `time_slot` CHECK; add `checked_in_by`, `checked_out_by` | Create Lucban's 3 service times from the current values, map each row's `time_slot`, keep `time_slot` text for one release as a fallback, then drop it |
| `first_timers` | Add `church_id NOT NULL` | From the linked session's church |

**Integrity guard:** a trigger on `attendance` rejects rows whose `church_id` differs from its session's or member's church. This is cheap and catches app bugs that RLS alone would not, for example a leader of church A attaching church A's attendance to church B's member.

### 3.3 Row Level Security

Enable RLS on every table. The publishable key gets **no** policies, so it is denied everything, which closes the gap found on 2026-09-27.

```sql
CREATE FUNCTION is_church_member(target UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM church_memberships WHERE church_id = target AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM network_admins WHERE user_id = auth.uid());
$$;
```

- `members`, `age_groups`, `sessions`, `attendance`, `first_timers`, `service_times`: `authenticated` may read and write rows `WHERE is_church_member(church_id)`.
- Network admin writes are **read-only in the UI** (per PRD section 4) but not blocked by RLS, so support fixes remain possible.
- `church_memberships`: a user reads their own rows; a church's Leads read, insert and delete that church's rows; Volunteers cannot write.
- `churches`: authenticated members read their churches; only network admins insert and update.

### 3.4 Two server clients, one rule

| Caller | Client | Why |
|---|---|---|
| Admin pages and admin APIs | **User session client** (publishable key + the signed-in user's JWT) | RLS enforces church separation on every query. A bug in app code cannot leak another church's data. |
| Parent kiosk APIs (`/api/check-in/*`, `/api/attendance`, `/api/age-groups`) | **Secret key client**, server-only | Parents have no account. These routes resolve the church from the URL slug and scope every query by that `church_id` explicitly. |
| Keep-alive cron | Secret key client | No user. |

**Rule:** the secret key is only imported from one module (`app/lib/supabase/admin.ts`), and that module is only imported by kiosk routes and the cron. A lint rule (`no-restricted-imports`) enforces this.

## 4. Sign-in and access

### 4.1 Email path (decided 2026-09-27)

1. Leader enters their email on `/admin/login`, and the app calls `supabase.auth.signInWithOtp`.
2. Supabase's **Send Email hook** POSTs to the n8n webhook.
3. n8n: a Code node verifies the `standardwebhooks` signature with `SEND_EMAIL_HOOK_SECRET` and rejects anything else. It builds the link from `token_hash` and `redirect_to`, then sends it with the Gmail node.
4. The link lands on `/auth/confirm`, which exchanges the token and sets the session cookie.

Invites use `supabase.auth.admin.inviteUserByEmail` (secret key, server-only) plus a `church_memberships` row, and go through the same hook.

**Fallback if n8n is unavailable:** in the Supabase dashboard, turn the hook off and set custom SMTP to `smtp.gmail.com` with a Gmail app password. This is a settings change, about 10 minutes, with no code. Keep the app password pre-generated and stored with the other secrets so this can be done on a Sunday morning.

### 4.2 Roles in the app

- The church context comes from a `church_id` cookie set when the user picks a church after sign-in. Every admin request checks it against `church_memberships`, and RLS re-checks it.
- **Lead-only:** the Team screen (invite, remove, change role). Everything else is open to Lead and Volunteer.
- **Network admin:** `/network` (overview, churches, invite first Lead, deactivate church), and read-only viewing of any church's dashboard.

### 4.3 Session length (app-enforced, since Supabase time-boxing is Pro-only)

- On sign-in the app sets a signed cookie `session_limit=<started_at>.<max_age>.<HMAC>`, using the existing `app/lib/session-token.ts` helper. `max_age` is 30 days, or 12 hours when "This is a shared device" is ticked.
- The request interceptor (Next 16 renamed `middleware.ts` to `proxy.ts`; confirm against `node_modules/next/dist/docs` at build time, per `AGENTS.md`) refreshes the Supabase session. It calls `signOut` and redirects to login when the limit has passed or the cookie is missing or invalid.
- Removing someone from a church takes effect on their next request, because the membership check and RLS both run per request.

## 5. Phases

### Stage 1: Lucban on the multi-church foundation

**Gate to start:** n8n webhook reachable over HTTPS from Supabase; Gmail app password generated for the fallback; a Supabase backup taken (Dashboard > Database > Backups) on the day of migration.

| Step | Work | Estimate |
|---|---|---|
| 1.1 | Migrations 3.1 and 3.2 with Lucban backfill; integrity trigger | 0.5 day |
| 1.2 | RLS 3.3; secret key client and import rule 3.4; switch admin routes to the user session client | 1 day |
| 1.3 | Sign-in 4.1 (login, confirm, n8n workflow), session limits 4.3, church picker after sign-in, Team screen | 1.5 to 2 days |
| 1.4 | Scope every existing admin screen and API by church; kiosk routes by slug (`/[church]/check-in/...`); `/` becomes church picker with remembered church | 1 to 1.5 days |
| 1.5 | Service Times screen; replace the 5 hard-coded service time locations (section 1) with `service_times` | 0.5 to 1 day |
| 1.6 | Network overview `/network` and Church column in the export | 0.5 to 1 day |
| 1.7 | Isolation test suite (section 6) and a weekday deploy | 0.5 day |

**Stage 1 total: about 5.5 to 7.5 days.**

**Cutover (a weekday):**
1. Deploy.
2. The network admin signs in and creates Lucban's Leads by invite.
3. Leads sign in and invite volunteers.
4. The old `/` QR codes land on the church picker; Lucban parents tap Lucban once.
5. Remove `ADMIN_PASSWORD` from Vercel after the first successful Sunday.

**Exit criteria:** PRD success criterion 1 (two clean Sundays), plus the isolation suite passing in CI.

### Stage 2: Pilot church and self-serve import

**Gate to start:** stage 1 exit criteria met; pilot church named by leadership (PRD open question 2); leadership answer on the data-sharing agreement or privacy notice (PRD open question 1).

| Step | Work | Estimate |
|---|---|---|
| 2.1 | Member template: a Google Sheet to copy, plus CSV download. Columns match the export: Last Name, First Name, Nickname, Birthday (YYYY-MM-DD), Role (Child/Serve Team), Age Group, Parent / Guardian, Contact Number, Notes | 0.25 day |
| 2.2 | Import screen: upload, parse, preview with per-row errors (unknown age group with a closest-match hint, bad date, missing name), duplicate skip on (church, lower(first), lower(last), birthday), confirm, insert in one transaction | 0.75 to 1 day |
| 2.3 | Onboard the pilot: create church, invite Lead, Lead sets age groups and service times, imports members | Onboarding only |

**Exit criteria:** PRD success criterion 2 (three Sundays without network admin data edits).

### Stage 3: Remaining churches

**Gate to start:** stage 2 exit criteria met; domain purchased and pointed at Vercel before any church prints QR codes (PRD open question 4).

The work is onboarding only, with no planned build. Anything a church asks for goes through a new decision, not into this plan.

## 5b. Stage 1 cutover runbook (added 2026-09-27)

**Deviation from 4.1, decided during the build:** the Send Email hook points at the app
(`/api/auth/send-email`), which verifies the Standard Webhooks signature and then posts the
finished email to the n8n workflow "Kids Church Check-In mailer" (header-token webhook, then
Gmail). Signature checking needs Node `crypto`, which self-hosted n8n Code nodes often block,
so it lives in tested app code instead. n8n still sends every email.

**Before deploy day (network admin):**
1. n8n: reconnect the Gmail credential "Jansen Email" (its Google access had expired on 2026-09-27; this also affects other workflows that use it).
2. Supabase, Authentication > URL Configuration: Site URL = the production address; add `https://<production>/auth/confirm` and `http://localhost:3000/auth/confirm` to Redirect URLs.
3. Supabase, Authentication > Hooks > Send Email: HTTPS, URL `https://<production>/api/auth/send-email`, generate the secret, and copy it.
4. Vercel, Settings > Environment Variables (Production and Preview): `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `N8N_MAILER_WEBHOOK_URL`, `N8N_MAILER_TOKEN` (copy from `.env.local`), and `SEND_EMAIL_HOOK_SECRET` (from step 3). Keep `ADMIN_PASSWORD` until after the first Sunday.

**Deploy day (a weekday):**
1. Merge the stage 1 PR; wait for the production deploy.
2. The network admin signs in at `/admin/login` (account and Lucban Lead membership were created 2026-09-27) and confirms the email arrives.
3. Apply `supabase/migrations/20260927000002_multi_church_rls_cutover.sql` (dry run first), then run `supabase/tests/isolation.sql` with `apply_cutover=0`, plus the end-to-end script against production.
4. Invite Lucban's other leaders from Team; they sign in before Sunday.
5. Old kiosk QR codes land on the church picker; parents tap Lucban once.

**Rollback:** before step 3, revert the merge (old code and database still match). After step 3, revert the merge **and** restore the pre-cutover policies from the backup (`pg_restore --section=post-data` is not enough on its own; re-create the anon policies listed in open item 7), so revert the code within minutes if anything is wrong.

## 6. Isolation tests (required before any second church's data exists)

Run against a Supabase branch or local stack with 2 seeded churches (A and B), a Lead and a Volunteer in each, and a network admin. Keep these as a script in `scripts/` (run with `node --test`), not manual clicks.

1. The publishable key alone reads 0 rows from every table.
2. Church A Lead reads 0 rows of church B from every table, and every insert, update or delete targeting B fails.
3. Church A Volunteer cannot insert into or delete from `church_memberships`.
4. Every admin API called with an A session and a B `church_id` cookie returns 403, not B's data.
5. The kiosk API for `/a/...` never returns B's members, even with a B `memberId` posted.
6. The attendance integrity trigger rejects a cross-church row.
7. A session past its `session_limit` is signed out, and a tampered `session_limit` cookie is rejected.
8. A removed member loses access on their next request.

## 7. Status log

The source of truth for "where are we". Each entry records what changed since the previous one.

| Date | Change since last entry |
|---|---|
| 2026-09-27 | Plan created. Decisions from the 2026-09-27 planning session recorded in the PRD, section 10. Nothing built. Production already has: Singapore function region, signed admin cookie, CSV export (PR #3). |
| 2026-09-27 | **Stage 1 gate met; step 1.1 applied to production.** Gate: n8n API reachable over HTTPS (Hostinger VPS); database access via Session pooler `aws-1-ap-southeast-1` (confirms Singapore); backup of the whole `public` schema taken and row counts verified (`~/kids-church-attendance/backups/`, local only). Migration `supabase/migrations/20260927000001_multi_church_foundation.sql` dry-run in a rolled-back transaction, then applied: Victory Lucban created; 180 members, 298 attendance, 18 sessions, 39 first timers, 3 age groups backfilled; 3 service times created and all 298 check-ins linked. Deployed code smoke-tested against it with no errors. Transition defaults and trigger remain until cutover. |
| 2026-09-27 | **Stage 1 code complete on branch `stage1-multi-church` (not deployed).** Sign-in by emailed link, app-enforced session limits (`proxy.ts`), church picker, per-church scoping of every admin API/page, kiosk under `/[church]`, Service Times, Team, Network overview, Church column in exports. Cutover migration `...000002` written and isolation-tested (11 checks, all pass with it; fail as expected without it); **not applied**. Compat migration `...000003` (legacy `time_slot` optional) applied to production after a dry run as the live app. End-to-end run against a local production build with a throwaway church and users: 38/38 checks pass, all test data removed. Remaining before cutover: n8n Send Email workflow, Supabase Auth settings, Vercel env vars, first network admin and Lucban Lead invites. |
| 2026-09-27 | Email path built and tested: `/api/auth/send-email` verifies signatures (6 unit tests; unsigned and forged requests rejected by the running app) and posts to the new, active n8n workflow "Kids Church Check-In mailer" (header token; requests without it get 403). The one live send failed inside n8n: the "Jansen Email" Gmail credential needs reconnecting. The app now only treats `{sent: true}` from n8n as success, because n8n replied 200 despite the failure. First network admin account created and made Lead of Victory Lucban. Cutover runbook added (5b). |

## 8. Open items needing follow-up

| # | Item | Needs |
|---|---|---|
| 1 | n8n host, uptime, and whether it is reachable from Supabase over HTTPS | Network admin |
| 2 | Personal Gmail daily sending limit (not documented on Google's Workspace limits page) | Network admin, if volume grows |
| 3 | Data-sharing agreement or parent privacy notice under RA 10173 | Network leadership (stage 2 gate) |
| 4 | Pilot church | Network leadership (stage 2 gate) |
| 5 | Domain | Network admin (stage 3 gate) |
| 6 | ~~`first_timers` shows 0 rows to the app.~~ **Resolved 2026-09-27:** 39 rows exist; the publishable key may insert but not read them, so dashboard, Past Sessions and export showed 0. Fixed by step 1.2 (admin reads as the signed-in user). | Done |
| 7 | ~~Confirm current RLS state.~~ **Resolved 2026-09-27:** RLS is on for every table, but the `anon` role has SELECT/INSERT/UPDATE (and DELETE on `members`, `age_groups`) with `true` conditions; `authenticated` has ALL. Step 1.2 replaces these for the kids tables. | Done |
| 8 | The database also holds a separate, live app's tables (`sfc_*`: 46 participants, 230 attendance, last used 2026-09-22) with the same open anon policies. Step 1.2 must not touch them, and isolation test 1 applies to the kids tables only. Consider moving that app to its own project, and tightening its policies, as separate work. | Network admin |
