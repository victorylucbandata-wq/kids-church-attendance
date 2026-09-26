# Kids Church Attendance — Detailed Technical Plan

> **Note (2026-09-27):** Phase 2.1 (admin accounts via Supabase Auth) and the Row Level Security section of this plan were never built. They are superseded by [multi-church-implementation-plan.md](multi-church-implementation-plan.md). The rest of this plan shipped and is kept as the historical record of the Sheets-to-Supabase overhaul.

This is the implementation-level counterpart to the volunteer-friendly overview in `.claude/plans/generic-frolicking-phoenix.md`.

---

## Phase 1: Set Up the New Foundation

### 1.1 Create Supabase Project

- Create a new Supabase project via dashboard or MCP tools
- Region: Southeast Asia (closest to Philippines)
- Note project URL and anon/service_role keys

### 1.2 Database Schema

#### `age_groups`
```sql
CREATE TABLE age_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial data
INSERT INTO age_groups (name, sort_order) VALUES
  ('Preschool', 1),
  ('Preteens', 2);
```

#### `members`
```sql
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  birthday DATE,
  role TEXT NOT NULL DEFAULT 'child' CHECK (role IN ('child', 'volunteer')),
  age_group_id UUID REFERENCES age_groups(id),
  parent_name TEXT,
  contact_number TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

- `age_group_id` nullable (volunteers may not have an age group)
- `parent_name`, `contact_number` nullable (not applicable for volunteers)

#### `sessions`
```sql
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id)
);
```

- One row per day (enforced by `UNIQUE` on `session_date`)
- No schedule column — time slot moved to attendance

#### `attendance`
```sql
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id),
  member_id UUID NOT NULL REFERENCES members(id),
  time_slot TEXT NOT NULL CHECK (time_slot IN ('9am', '11am', 'Special')),
  checked_in BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, member_id)
);
```

- `UNIQUE(session_id, member_id)` — a member appears once per day
- `time_slot` is set at check-in time, not at session generation
- `checked_out_at` used in Phase 4, nullable until then

#### `first_timers`
```sql
CREATE TABLE first_timers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id),
  session_id UUID REFERENCES sessions(id),
  parent_name TEXT,
  contact_number TEXT,
  child_first_name TEXT NOT NULL,
  child_last_name TEXT NOT NULL,
  child_nickname TEXT,
  birthday DATE,
  age TEXT,
  age_group_id UUID REFERENCES age_groups(id),
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);
```

#### Row Level Security

- All tables: RLS enabled
- Public (anon) access: `SELECT` on `members` (active only), `age_groups`, `sessions`; `INSERT` on `attendance`, `first_timers`; `UPDATE` on `attendance` (check-in only)
- Authenticated access: full CRUD on all tables
- Policies scoped by `auth.role()` — anon for kiosk, authenticated for admin

### 1.3 Set Up Vercel

- Create Vercel project, link to repo
- Install Supabase Vercel integration (auto-injects `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Remove old env vars: `GOOGLE_SCRIPT_URL`, `ATTENDANCE_SECRET`
- Keep `ADMIN_PASSWORD` temporarily (removed in Phase 2)

### 1.4 Replace Google Sheets Backend

**Dependencies to install:**
```
@supabase/supabase-js @supabase/ssr
```

**New files:**
- `app/lib/supabase/client.ts` — browser client (anon key, for check-in kiosk)
- `app/lib/supabase/server.ts` — server client (service role, for API routes)
- `app/lib/supabase/types.ts` — generated TypeScript types from Supabase (`supabase gen types`)

**Files to modify:**
- `app/lib/types.ts` — update types to match new schema (add `time_slot`, `role`, `birthday`, `first_name`/`last_name`/`nickname`, `checked_out_at`)
- `app/lib/gas.ts` — delete entirely (replaced by Supabase clients)
- `app/api/attendance/route.ts` — rewrite to use Supabase `insert` for first-timer flow
- `app/api/check-in/members/route.ts` — rewrite: query `members` joined with `attendance` for today's session
- `app/api/check-in/returning/route.ts` — rewrite: `update` attendance row
- `app/api/admin/data/route.ts` — rewrite: query sessions, attendance with aggregation
- `app/api/admin/session/route.ts` — rewrite: `insert` session row + bulk `insert` attendance rows
- `app/api/admin/login/route.ts` — keep as-is for now (Phase 2 replaces)
- `app/api/admin/logout/route.ts` — keep as-is for now

**Key behavior change in session generation:**
- Currently, `generateSession` creates attendance rows pre-populated for all members
- New model: `generateSession` only creates the `sessions` row. Attendance rows are created at check-in time (since time slot is selected at check-in, not session generation)
- The "unchecked members" query becomes: all active members who do NOT have an attendance row for today's session

**Files to delete:**
- `gas/Code.gs` — no longer needed (keep in git history)

### 1.5 Verification

- Run `npm run dev`, generate a session, check in a member, view admin dashboard
- All existing flows work identically from the user's perspective
- No Google Sheets calls remain in the codebase

---

## Phase 2: Rebuild the Admin Experience

### 2.1 Supabase Auth

**New files:**
- `app/lib/supabase/middleware.ts` — Supabase Auth middleware for session refresh
- `middleware.ts` — Next.js middleware protecting `/admin/*` routes (redirect to login if no session)

**Files to modify:**
- `app/lib/auth.ts` — rewrite: use Supabase Auth instead of cookie-based shared password
- `app/admin/login/page.tsx` — rewrite: email + password form calling `supabase.auth.signInWithPassword()`
- `app/api/admin/login/route.ts` — delete (auth handled client-side by Supabase SDK)
- `app/api/admin/logout/route.ts` — rewrite: call `supabase.auth.signOut()`
- `.env.local` — remove `ADMIN_PASSWORD`

### 2.2 Member Management Pages

**New files:**
- `app/admin/members/page.tsx` — list all members with search, filter by role/age group/active status
- `app/admin/members/new/page.tsx` — create member form (first name, last name, nickname, birthday, role, age group, parent name, contact, notes)
- `app/admin/members/[id]/page.tsx` — edit member form, deactivate toggle
- `app/api/admin/members/route.ts` — `GET` (list with filters), `POST` (create)
- `app/api/admin/members/[id]/route.ts` — `GET` (single), `PUT` (update), `PATCH` (deactivate)

**Display name helper:**
- `app/lib/display-name.ts` — utility function: `formatDisplayName(first_name, last_name, nickname)` returns `"Nickname (Last Name, First Name)"` or `"First Name Last Name"` if no nickname

### 2.3 Age Group Management

**New files:**
- `app/admin/age-groups/page.tsx` — list, add, rename, reorder, delete age groups
- `app/api/admin/age-groups/route.ts` — `GET` (list), `POST` (create)
- `app/api/admin/age-groups/[id]/route.ts` — `PUT` (update), `DELETE` (only if no members reference it)

### 2.4 Upgrade Admin Dashboard

**Files to modify:**
- `app/admin/AdminDashboard.tsx` — major rewrite:
  - Summary cards: Total Present, by time slot (9am/11am/Special), by role (kids/volunteers), by age group, checkout placeholder (shows "—" until Phase 4)
  - Attendance table: add time slot column, display name in new format
  - Auto-polling: `useEffect` with `setInterval` every 20 seconds re-fetching `/api/admin/data`
- `app/api/admin/data/route.ts` — return grouped aggregations:
  ```json
  {
    "summary": {
      "total": 45,
      "checkedIn": 32,
      "notCheckedIn": 13,
      "byTimeSlot": { "9am": 20, "11am": 10, "Special": 2 },
      "byRole": { "child": 28, "volunteer": 4 },
      "byAgeGroup": { "Preschool": 15, "Preteens": 13 },
      "checkedOut": 0,
      "stillHere": 32
    }
  }
  ```

### 2.5 Manual Attendance Override

**Files to modify:**
- `app/admin/AdminDashboard.tsx` — add "Manual Check-In" button that opens a member picker + time slot selector; add "Edit" action on attendance rows to correct time slot
- `app/api/admin/attendance/route.ts` — new: `POST` (manual check-in), `PATCH` (correct time slot)

### 2.6 Verification

- Log in with a Supabase Auth account
- Create, edit, deactivate a member
- Add/rename an age group
- Generate a session, manually check in a member
- Verify dashboard auto-refreshes and shows all summary breakdowns
- Verify old shared password login no longer works

---

## Phase 3: Update the Check-In Experience

### 3.1 Time Slot Selector

**Files to modify:**
- `app/check-in/returning/page.tsx` — add a step before age group selection: time slot picker (9am / 11am / Special). Selected slot passed to check-in API.
- `app/api/check-in/returning/route.ts` — accept `timeSlot` in request body, write to `attendance.time_slot`
- `app/check-in/new/page.tsx` — replace `serviceSchedule` dropdown with time slot selector (same 3 options)

**Flow change for returning members:**
- Current: group select → member select → confirm
- New: time slot select → group select → member select → confirm

### 3.2 Volunteer Check-In

**Files to modify:**
- `app/check-in/returning/page.tsx` — fetch includes volunteers; add a "Volunteers" option alongside age groups (or a separate section). Volunteer names show with a visual badge.
- `app/api/check-in/members/route.ts` — query returns all active members (both roles), includes `role` field
- `app/lib/types.ts` — add `role` to `UncheckedMember` type

### 3.3 Name Display Format

**Files to modify (everywhere names render):**
- `app/check-in/returning/page.tsx` — use `formatDisplayName()`
- `app/admin/AdminDashboard.tsx` — use `formatDisplayName()`
- `app/admin/members/page.tsx` — use `formatDisplayName()`
- `app/check-in/new/page.tsx` — confirmation screen uses `formatDisplayName()`

### 3.4 Birthday Highlight

**New file:**
- `app/lib/birthday.ts` — `isBirthdayToday(birthday: string | Date): boolean` utility

**Files to modify:**
- `app/check-in/returning/page.tsx` — on successful check-in, if birthday is today, show "Happy Birthday!" message in the toast/confirmation
- `app/admin/AdminDashboard.tsx` — birthday badge (e.g., cake emoji) next to name in attendance table when birthday matches today
- `app/api/check-in/members/route.ts` — include `birthday` in response
- `app/api/admin/data/route.ts` — include `birthday` in attendance row data

### 3.5 First-Timer Form Update

**Files to modify:**
- `app/check-in/new/page.tsx` — replace single `childName` with `firstName`, `lastName`, `nickname`, `birthday` fields. Replace `serviceSchedule` with time slot selector. Remove `age` free text, keep age group dropdown (now fetched from `age_groups` table).
- `app/api/attendance/route.ts` — accept new fields, create `members` row with structured name, create `first_timers` record, create `attendance` row with time slot

### 3.6 Verification

- Check in a returning member: verify time slot selector appears and is recorded
- Check in a volunteer: verify they appear in the list with a badge
- Verify names display as "Nickname (Last Name, First Name)" everywhere
- Check in a member whose birthday is today: verify "Happy Birthday!" appears
- Register a first-timer: verify new form fields, verify member + attendance created correctly

---

## Phase 4: Add Check-Out and Safety Features

### 4.1 Check-Out on Admin Dashboard

**Files to modify:**
- `app/admin/AdminDashboard.tsx` — for each checked-in row, show a "Check Out" button. On click, calls API. Row updates to show "Checked Out" badge + time. Button disappears once checked out.
- `app/api/admin/attendance/route.ts` — add `PATCH` handler for checkout: sets `checked_out_at = now()` on the attendance row

### 4.2 "Still Here" Safety View

**Files to modify:**
- `app/admin/AdminDashboard.tsx` — add a prominent card (red/orange accent) showing count of `checked_in = true AND checked_out_at IS NULL`. This is the "Still Here" number.
- `app/api/admin/data/route.ts` — `summary.stillHere` now computed from real data instead of placeholder

### 4.3 Update Summary Cards

**Files to modify:**
- `app/admin/AdminDashboard.tsx` — replace the Phase 2 checkout placeholder with live numbers:
  - "Still Here" card (checked in, not checked out)
  - "Checked Out" card (checked in and checked out)
  - Both update on the 20-second polling cycle

### 4.4 Verification

- Check in 3 members, check out 1
- Verify "Still Here" shows 2, "Checked Out" shows 1
- Verify the attendance table shows correct statuses and times
- Verify auto-polling updates these numbers without manual refresh

---

## Phase 5: Migrate and Go Live

### 5.1 Export from Google Sheets

- Download the Members sheet as CSV
- Write a one-time migration script (`scripts/migrate-members.ts`):
  - Parse CSV
  - Split `FullName` into `first_name` / `last_name` (heuristic: last word = last name, rest = first name; flag ambiguous names for manual review)
  - Map `AgeGroup` text to `age_group_id` UUID
  - Set `role = 'child'`, `nickname = null`, `birthday = null`
  - Set `is_active` from sheet's active column
  - Output SQL inserts or use Supabase client to insert

### 5.2 Import into Supabase

- Run migration script against production Supabase
- Verify row count matches active members in sheet
- Spot-check 5-10 records for correct name splitting

### 5.3 Create Admin Accounts

- Use Supabase dashboard or `supabase.auth.admin.createUser()` to create accounts for each volunteer/admin
- Send credentials to team (email + temporary password, force reset on first login)

### 5.4 Team Testing

- Schedule a non-Sunday test session with the volunteer team
- Walk through: session generation → check-in (returning) → check-in (first timer) → check-out → admin dashboard → member management → age group management
- Document issues, fix before go-live

### 5.5 Go Live

- Deploy to Vercel production
- Verify env vars are set (Supabase keys, no more Google Script vars)
- First real Sunday with the new system
- Keep old Google Sheet accessible (read-only) for historical reference

### 5.6 Post-Launch Data Enrichment

- Admins fill in nicknames and birthdays via member management page over the following weeks
- No code changes needed — just data entry

### 5.7 Cleanup

- Delete `gas/Code.gs` from the repo (already unused since Phase 1)
- Remove any remaining Google Sheets references from code or env
- Archive the `.env.local` Google credentials

---

## File Summary

### New files
| File | Phase | Purpose |
|------|-------|---------|
| `app/lib/supabase/client.ts` | 1 | Browser Supabase client |
| `app/lib/supabase/server.ts` | 1 | Server Supabase client |
| `app/lib/supabase/types.ts` | 1 | Generated TypeScript types |
| `app/lib/supabase/middleware.ts` | 2 | Auth session refresh |
| `middleware.ts` | 2 | Protect admin routes |
| `app/lib/display-name.ts` | 2 | Name formatting utility |
| `app/lib/birthday.ts` | 3 | Birthday check utility |
| `app/admin/members/page.tsx` | 2 | Member list |
| `app/admin/members/new/page.tsx` | 2 | Create member |
| `app/admin/members/[id]/page.tsx` | 2 | Edit member |
| `app/admin/age-groups/page.tsx` | 2 | Age group management |
| `app/api/admin/members/route.ts` | 2 | Member CRUD API |
| `app/api/admin/members/[id]/route.ts` | 2 | Single member API |
| `app/api/admin/age-groups/route.ts` | 2 | Age group API |
| `app/api/admin/age-groups/[id]/route.ts` | 2 | Single age group API |
| `app/api/admin/attendance/route.ts` | 2 | Manual override + checkout API |
| `scripts/migrate-members.ts` | 5 | One-time migration script |

### Modified files
| File | Phase | Changes |
|------|-------|---------|
| `app/lib/types.ts` | 1 | New schema types |
| `app/api/attendance/route.ts` | 1, 3 | Supabase rewrite, new form fields |
| `app/api/check-in/members/route.ts` | 1, 3 | Supabase rewrite, add role/birthday |
| `app/api/check-in/returning/route.ts` | 1, 3 | Supabase rewrite, add time_slot |
| `app/api/admin/data/route.ts` | 1, 2, 4 | Supabase rewrite, aggregations, checkout |
| `app/api/admin/session/route.ts` | 1 | Supabase rewrite (session row only) |
| `app/api/admin/logout/route.ts` | 2 | Supabase Auth signOut |
| `app/admin/login/page.tsx` | 2 | Email + password form |
| `app/admin/AdminDashboard.tsx` | 2, 3, 4 | Summary cards, polling, names, birthday, checkout |
| `app/check-in/returning/page.tsx` | 3 | Time slot, volunteers, names, birthday toast |
| `app/check-in/new/page.tsx` | 3 | New form fields, time slot |
| `app/lib/auth.ts` | 2 | Rewrite for Supabase Auth |
| `.env.local` | 1, 2 | Swap Google vars for Supabase vars |

### Deleted files
| File | Phase | Reason |
|------|-------|--------|
| `app/lib/gas.ts` | 1 | Replaced by Supabase clients |
| `gas/Code.gs` | 5 | No longer needed |
| `app/api/admin/login/route.ts` | 2 | Auth handled by Supabase SDK |
