# PRD: Kids Church Check-In for Multiple Victory Churches

**Status:** Draft for leadership review
**Date:** 2026-09-27
**Audience:** Victory network kids ministry leadership (approval to onboard other churches)
**Companion:** [Implementation Plan](multi-church-implementation-plan.md) (technical detail, phases, status log)

---

## 1. Why this matters

Victory Lucban's kids ministry runs Sunday check-in on this web app. Parents check their children in on a phone or a kiosk, and leaders watch who is in the room and check kids out at pickup. As of 2026-09-27 it holds 180 members, 18 Sunday sessions and 298 check-in records (row counts read from the production database on 2026-09-27).

Other Victory churches could use the same tool, but today it can only serve one church. Everything is shared: one list of kids, one set of age groups, one Sunday session per date, one admin password. A second church would see, and could change, Lucban's children's records.

This initiative makes the app serve many Victory churches from one installation, with each church's data completely separate.

## 2. Goals

1. **Any Victory church can run its Sunday check-in on the app** with its own kids, age groups, service times and leaders.
2. **No church can see or change another church's data.** This is enforced by the database itself, not only by the app's screens.
3. **Each leader has a personal sign-in.** Access can be given or removed person by person, and the app records who did what.
4. **Network leadership can see participation across churches** in one place, and download a combined attendance spreadsheet.
5. **Joining is cheap and fast for a new church:** a standard spreadsheet template to bring in existing members, and no new servers or accounts per church.
6. **Victory Lucban notices no loss of features** during the switch, and keeps checking in every Sunday.

## 3. Non-goals

These are deliberately out of scope for this initiative. How the goals are met is in the Implementation Plan.

- Separate copies of the app per church. (Considered and rejected on 2026-09-27; see section 8.)
- A regional tier between the network and individual churches.
- Charts, trends, targets or church-to-church comparisons inside the app. The combined spreadsheet export covers analysis for now.
- Churches customising the check-in flow, the First Timer form fields, or the look of the app.
- Google sign-in. (Possible later if volunteers ask for it.)
- Parent accounts. Parents keep checking in without an account, as today.
- Linking one child across two churches. A child who attends two churches is simply listed in both.

## 4. Who uses it

| Role | Who | What they can do |
|---|---|---|
| **Network admin** | The app's maintainer | Create a church, invite its first Lead, turn a church off, see the network overview, view any church's dashboard read-only, download the combined export |
| **Church Lead** | Each church's kids ministry lead | Everything a church's leaders do today (start the session, check kids out, manage members, age groups and service times, download that church's export), plus invite and remove their own team |
| **Church Volunteer** | Leaders and serve team at a church | Same as Lead, except managing who has access |
| **Parent** | Families at each church | Check in children at their church's kiosk link. No account. |

A person can belong to more than one church and chooses which one to work in after signing in.

## 5. What changes for each group

**Parents**
- Each church gets its own check-in link (for example `/lucban`) for its QR codes and signs.
- The app's home page becomes a church picker that remembers the parent's church after the first visit.
- The check-in steps themselves do not change.

**Church leaders**
- Sign in with their own email address, by tapping a one-time link that the app emails to them. There are no passwords to remember.
- Sessions last 30 days on a personal phone. A "This is a shared device" option at sign-in ends the session after 12 hours, for a shared check-in tablet.
- A new **Service Times** screen replaces the fixed 9:00 AM / 11:00 AM / Special Event choices, so each church sets its own.
- A new **Import members** screen takes a filled-in copy of the standard template.

**Network leadership**
- A **network overview** with one row per church: this Sunday's and last Sunday's check-ins, first timers, serve team, and whether today's session was started.
- A **combined export**: the existing attendance spreadsheet with a Church column added.

## 6. Data and privacy

The app stores children's names, nicknames, birthdays, age groups, allergy and care notes, and parent or guardian names and contact numbers. In the Philippines this is personal information under the Data Privacy Act of 2012 (RA 10173), and children's data deserves particular care.

- **Separation:** each church's records are visible only to that church's signed-in leaders, and to the network admin for support. The database refuses any other request.
- **Hosting:** Supabase (database) and Vercel (app), with the app's server functions in Singapore since 2026-09-27.
- **No sharing:** data is not shared outside the church it belongs to, and is not used for anything other than attendance and child safety.
- **Leaving:** a church that stops using the app can have its data exported to a spreadsheet and then deleted.
- **Sign-in emails** are sent through the network admin's own automation server (n8n) and a Gmail account. They contain only a sign-in link.

Whether the network needs a formal data-sharing agreement with each church, or a privacy notice shown to parents at check-in, is an open question for leadership (section 9).

## 7. Success criteria

Stated as outcomes. The Implementation Plan's status log tracks progress against them.

1. **Lucban switch:** Victory Lucban runs 2 consecutive Sundays on the multi-church version with no lost check-ins and no support calls about access.
2. **Pilot church:** one additional Victory church runs 3 consecutive Sundays, with its existing members imported from the template, without the network admin editing data on its behalf.
3. **Isolation proven:** a signed-in leader of one church cannot read or change another church's records through the app or directly against the database. Verified by tests before any second church's data is loaded.
4. **Self-serve joining:** after the pilot, a new church can go from "invited" to "first Sunday" using only the invite email, the template and the in-app screens.
5. **Visibility:** network leadership can answer "which churches checked in how many kids this Sunday?" from the overview page, without asking each church.

## 8. Cost

Verified against vendor pages on 2026-09-27.

| Item | Cost | Source and notes |
|---|---|---|
| Supabase database and sign-in | $0 on the Free plan | [supabase.com/pricing](https://supabase.com/pricing): "Limit of 2 active projects", "500 MB database size", "50,000 monthly active users". One shared project serves every church, so the 2-project limit does not constrain growth. The next tier is "from $25/month". |
| Vercel hosting | Current plan, unchanged | No new projects per church. |
| Sign-in emails | $0 | Sent through the network admin's existing n8n and a Gmail account (decided 2026-09-27). Supabase's built-in email cannot be used: it allows "2 messages per hour" and "will refuse to deliver messages to addresses that are not part of the project's team" ([Supabase SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp)). |
| Domain name | Not yet priced | Needed before printing QR codes for other churches, so the links on printed signs never change. No longer required for sign-in emails. |

**Why one shared app rather than a copy per church:** Supabase's Free plan allows 2 active projects, so beyond 2 churches, separate copies would mean paying per church or juggling accounts, and every fix would have to be deployed N times. The shared app costs the same for 1 church or 30.

**Known limit to watch:** "Free projects are paused after 1 week of inactivity" (Supabase pricing page). A daily keep-alive job was deployed on 2026-09-27 to prevent this.

## 9. Open questions

| # | Question | Owner |
|---|---|---|
| 1 | Does the network need a data-sharing agreement with each church, or a privacy notice for parents at check-in, under RA 10173? | Network leadership |
| 2 | Which church pilots after Lucban? | Network leadership |
| 3 | Where is the n8n server hosted, and how reliable is it on Sunday mornings? Sign-in depends on it. (A fallback is documented in the Implementation Plan.) | Network admin |
| 4 | Domain name choice and yearly cost. | Network admin |
| 5 | Daily sending limit of the personal Gmail account used by n8n. Google's published limits cover only Workspace accounts ("2,000" per day, "500 for trial accounts", [Workspace sending limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace)); personal Gmail is not documented there. Expected volume is a few dozen sign-in emails a week. | Network admin |
| 6 | Are there churches that need a First Timer field Lucban does not ask for? Assumed "no" for now. | Network leadership |

## 10. Decision history

All decisions below come from the planning session of 2026-09-27.

- One shared app with separated data, chosen over a copy per church, for cost and maintenance.
- Two admin levels (network and church). Inside a church, Lead and Volunteer differ only in managing access.
- Personal, invite-only sign-in by email link, chosen over one shared password per church. This briefly switched to shared passwords during the session and was reversed in favour of personal accounts. It also replaces the "individual logins" step of the original 2026 overhaul plan, which was never built.
- Sign-in emails go through n8n and Gmail rather than a paid email service, which removed the need for a domain before launch.
- Network visibility is an overview page plus a combined export, not in-app analytics.
- New churches bring members in through a fixed template and a self-serve import screen, chosen over one-off imports by hand.
- Staged rollout (Lucban, then a pilot church, then everyone else) with no fixed deadline.
