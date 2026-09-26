# Kids Church Attendance System — Overhaul Plan

> **Note (2026-09-27):** Phase 2.1 (admin accounts via Supabase Auth) and the Row Level Security section of this plan were never built. They are superseded by [multi-church-implementation-plan.md](multi-church-implementation-plan.md). The rest of this plan shipped and is kept as the historical record of the Sheets-to-Supabase overhaul.

## Why are we doing this?

Our current check-in system runs on Google Sheets. It works, but it's hitting its limits — we can't easily add new features, the data isn't structured well for growth, and there's no proper admin tool for volunteers. We're moving to a proper database (Supabase) so we can add the features the team has been asking for, while keeping the check-in experience fast and familiar for parents.

---

## What's changing? (Summary for volunteers)

- **Time slots**: Instead of just "Sunday Morning / Afternoon," you'll select 9am, 11am, or Special Event when opening a session
- **Volunteers check in too**: Volunteers will appear in the system and can check themselves in, just like the kids
- **Birthdays**: We'll track birthdays — the system will show a birthday highlight when it's a kid's special day
- **Check-out**: Volunteers/admins can now check kids out when parents pick them up (safety feature)
- **Name display**: Names will show as "Nickname (Last Name, First Name)" for easier recognition
- **Better admin dashboard**: A richer summary showing headcounts by time slot, age group, kids vs. volunteers, and who's still in the room
- **Admin accounts**: Each volunteer/admin gets their own login instead of sharing one password
- **Manage members**: Admins can add, edit, and deactivate kids and volunteers directly from the admin page — no more editing spreadsheets

---

## Phase Overview

| Phase | What | Goal |
|-------|------|------|
| **1** | Set up the new foundation | Get the new database and hosting in place |
| **2** | Rebuild the admin experience | New admin login, member management, and dashboard |
| **3** | Update the check-in experience | Add time slots, volunteers, birthdays, and new name format |
| **4** | Add check-out and safety features | Check-out flow and "who's still here" tracking |
| **5** | Migrate and go live | Move member data over, test with the team, and switch |

---

## Phase 1: Set Up the New Foundation

**Goal**: Replace Google Sheets with a proper database. Set up hosting. Nothing changes for users yet.

### Tasks

1. **Create the Supabase project**
   - Set up a new Supabase project (our new database)
   - Configure it for Philippine timezone

2. **Design and create the database tables**
   - `members` — stores kids and volunteers (first name, last name, nickname, birthday, age group, role, parent info, contact, notes, active/inactive)
   - `age_groups` — list of age groups (e.g., Preschool, Preteens), manageable by admins
   - `sessions` — one row per day when check-in is opened
   - `attendance` — one row per person per session (time slot, check-in time, check-out time, notes)
   - `first_timers` — registration records for new kids

3. **Set up Vercel hosting**
   - Create a new Vercel project linked to the codebase
   - Connect Supabase credentials to Vercel

4. **Replace the Google Sheets connection with Supabase**
   - Swap out the backend code so the app talks to Supabase instead of Google Sheets
   - Keep the same user-facing behavior for now — nothing looks different yet

### Done when
- The app runs on the new database
- Existing features (generate session, check in, admin view) work exactly as before, just powered by Supabase

---

## Phase 2: Rebuild the Admin Experience

**Goal**: Give admins proper tools — their own logins and a real management interface.

### Tasks

1. **Set up admin accounts**
   - Replace the shared password with individual logins using Supabase Auth
   - Each admin/volunteer leader gets their own email + password
   - Old shared password is retired

2. **Build the member management pages**
   - A page listing all members (kids + volunteers) with search and filters
   - Ability to add a new member manually
   - Ability to edit any member's details (name, nickname, birthday, contact info, age group, role, notes)
   - Ability to deactivate a member (not delete — we keep the history)

3. **Build the age group management page**
   - A simple page to add, rename, reorder, or remove age groups
   - Check-in screens will pull from this list automatically

4. **Upgrade the admin dashboard**
   - Headcount breakdown by time slot (9am / 11am / Special)
   - Headcount breakdown by role (kids vs. volunteers)
   - Headcount breakdown by age group
   - Headcount breakdown by check-out status (still here vs. picked up) — placeholder until Phase 4
   - Auto-refresh every 20 seconds so numbers stay current without reloading

5. **Add manual attendance override**
   - Admins can manually mark someone as checked in from the dashboard (e.g., if the kiosk is busy)
   - Admins can correct a wrong time slot on a check-in record

### Done when
- Each admin logs in with their own account
- Admins can manage members and age groups without touching a spreadsheet
- Dashboard shows rich headcount summaries and refreshes automatically

---

## Phase 3: Update the Check-In Experience

**Goal**: Parents and volunteers see the new features when checking in.

### Tasks

1. **Add time slot selector**
   - After the session is generated for the day, the check-in screen shows a selector: 9am, 11am, or Special Event
   - The selected slot is recorded with the check-in

2. **Add volunteer check-in**
   - Volunteers appear in the check-in list alongside kids
   - They are visually distinguished (e.g., a "Volunteer" label or different color)
   - Volunteers select their time slot just like parents do for kids

3. **Update name display format**
   - All names now display as "Nickname (Last Name, First Name)"
   - Applies to the check-in list, admin dashboard, and everywhere names appear

4. **Add birthday highlight**
   - On the check-in confirmation screen: a "Happy Birthday!" message when it's the kid's birthday
   - On the admin dashboard: a birthday badge next to the name in the attendance list
   - Birthday date visible on member detail in the admin interface

5. **Update the first-timer registration form**
   - New fields: first name, last name, nickname, birthday
   - Role defaults to "child" (volunteers are added by admins)
   - Form still auto-checks in the kid on submission

### Done when
- Parents see time slot options and birthday messages during check-in
- Volunteers can check themselves in
- Names display in the new format everywhere
- First-timer form collects all new fields

---

## Phase 4: Add Check-Out and Safety Features

**Goal**: Admins can check kids out when parents pick them up. The dashboard shows who's still in the room.

### Tasks

1. **Add check-out to the admin dashboard**
   - Each checked-in person gets a "Check Out" button in the attendance list
   - Tapping it records the pick-up time
   - Status changes from "Checked In" to "Checked Out" with the time

2. **"Still here" safety view**
   - A prominent card on the dashboard showing how many kids are still in the room (checked in but not yet checked out)
   - This is the number volunteers care about most at the end of a service

3. **Update the summary cards**
   - The check-out breakdown (from Phase 2's placeholder) now shows live data
   - Cards: Total Present, Still Here, Checked Out

### Done when
- Volunteers can check kids out from the admin dashboard
- The "Still Here" count is visible and accurate
- Summary cards reflect check-out status in real time (via auto-polling)

---

## Phase 5: Migrate and Go Live

**Goal**: Move existing member data over, test with the team, and switch from the old system.

### Tasks

1. **Export member data from Google Sheets**
   - Pull the active member roster from the current spreadsheet
   - Split full names into first name / last name
   - Assign role ("child" for all existing members)
   - Leave nickname and birthday blank (admins fill these in later)

2. **Import into Supabase**
   - Load the cleaned-up member data into the new database
   - Verify counts match

3. **Create admin accounts for the team**
   - Set up Supabase Auth accounts for each volunteer/admin who needs access
   - Share login credentials with the team

4. **Team testing**
   - Run a mock Sunday with the full team using the new system
   - Test: session generation, check-in (returning + first timer), check-out, admin dashboard, member management
   - Collect feedback and fix issues

5. **Go live**
   - Point the live URL to the new system
   - Keep the old Google Sheet as a read-only archive (don't delete it)
   - Remove old Google Apps Script credentials from the environment

6. **Post-launch: fill in missing data**
   - Admins use the new member management page to add nicknames and birthdays over the coming weeks
   - No rush — the system works fine without them, they just enhance the experience

### Done when
- All active members are in the new system
- The team has tested the full flow
- The old Google Sheets system is retired (but preserved)
- The new system is live and serving Sunday check-ins

---

## What stays the same

- The check-in home screen looks and feels the same — "Returning Member" and "First Timer" buttons
- Parents don't need accounts or passwords
- The check-in flow is still tap-and-go
- The app is still accessed from the same kind of URL on any device

## What the old system becomes

- The Google Sheet is kept as a read-only archive of historical attendance
- The Google Apps Script is deactivated
- All new data lives in Supabase going forward
