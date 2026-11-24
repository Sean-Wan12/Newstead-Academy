# Newstead Academy app (phase 1)

Our own child care management app, replacing Lillio (formerly HiMama) for Newstead Academy's two Ontario centres, Richmond Hill and Markham. It is separate from the older single-page admin in `admin/`. The licensing rules and forecast engine were ported from that admin.

The app has no third-party dependencies and no build step. It uses only Node's built-in modules (`http`, `crypto`, `fs`, `url`), plain HTML and CSS, and vanilla ES modules in the browser.

## Run it

```
node app/seed.js --reset      # create FAKE demo data in app/.data (git-ignored)
node app/server.js            # http://127.0.0.1:3000
```

- `PORT` and `HOST` change the address. The default is `127.0.0.1:3000`.
- `node app/seed.js --reset --quiet-day` seeds without today's sample attendance, staff shifts and entries.
- `DATA_DIR=/some/folder` keeps data somewhere other than `app/.data`.
- Requires Node 18 or later. Tested with Node 22.

## Demo logins (fake data, local only)

These passwords are in a public repository. **Use them only with the demo data.** Real accounts must be created fresh. Never seed a real deployment.

| Who | Sign in with | Password | Tablet PIN |
|---|---|---|---|
| Owner | `owner@demo.newstead.test` | `Owner-demo-2026` | none |
| Supervisor, Richmond Hill | `super.rh@demo.newstead.test` | `Super-demo-2026` | 7391 |
| Supervisor, Markham | `super.mk@demo.newstead.test` | `Super-demo-2026` | 7392 |
| Lead educator for each room | `teacher.<loc>.<code>@demo.newstead.test`, e.g. `teacher.rh.t1@…` | `Teacher-demo-2026` | rh-t1 2580, t2 2581, t3 2582, p1 2583, p2 2584, p3 2585, k2 2586, k1 2587; mk-i1 2588, mk-t1 2589, mk-p1 2590 |
| Assistant for each room | `teacher.<loc>.<code>b@demo.newstead.test`, e.g. `teacher.rh.t1b@…` | `Teacher-demo-2026` | lead's PIN + 100 (rh-t1b 2680, …) |
| Floater (Preschool 1 and 2) | `teacher.rh.float@demo.newstead.test` | `Teacher-demo-2026` | 2468 |
| Classroom tablet, one per room | Classroom tab: `rh-toddler-1`, `rh-toddler-2`, `rh-preschool-1`, `rh-kindergarten-1`, `mk-infant-1`, … | `Tablet-demo-2026` | staff enter their own PIN |

Room codes: Richmond Hill `t1 t2 t3 p1 p2 p3 k2 k1`; Markham `i1 t1 p1`.

## What phase 1 does

**Sign-in and roles**
- The sign-in page has two tabs. *Staff* signs in with email and password. *Classroom tablet* uses a per-room login, the same idea as Lillio's classroom logins.
- On a tablet, staff tap their name and type a 4-digit PIN before recording. Every attendance change and entry records the person who made it, plus the tablet it was made on. Lillio cannot tell which teacher made an entry, so this is an improvement. The PIN unlock ends after 10 minutes without a change, or when someone taps Lock.
- Roles:
  - Owner: everything, both locations.
  - Supervisor (`admin`): manages their own location(s).
  - Educator (`teacher`): only their assigned room(s), today only.
  - Tablet (`device`): only its room(s), today only, and writes need a PIN.
- Educators can also sign in with their own password, for example on a phone. They use it to set their own PIN.
- Every permission is checked on the server, in `lib/permissions.js` and in each handler. The UI hiding a button is never the only protection.
- Passwords are hashed with `crypto.scrypt` and a per-user salt. So are PINs.
- Sessions use signed (HMAC-SHA256), HttpOnly, SameSite=Strict cookies. Each session has a server-side record, so signing out or revoking access takes effect immediately.
- State-changing requests must pass an origin check (`lib/origin.js`) and must send JSON bodies.
- Login rate limits:
  - 5 failures per account in 15 minutes locks that account for 15 minutes.
  - 20 failures per IP in 15 minutes locks that IP.
  - 5 wrong PINs on a tablet locks PIN entry for 5 minutes.
- Supervisors issue temporary passwords, which are shown once. The person must choose their own at first sign-in. No email is sent.
- Deactivating an account, resetting a password or turning off a tablet signs that person or tablet out everywhere.
- An activity log records sign-ins, failed sign-ins, account and room changes, attendance corrections, incidents, reviews and deletions.
- Every page has a strict Content-Security-Policy (`'self'` only) and no inline scripts or styles. Every value put into HTML goes through the escaping template in `public/js/shared/dom.js`.

**Teacher panel** (`/teacher`, built for a tablet)
- The room's children appear as large cards. Each card has one-tap Check in, Check out, Absent (with a reason), Undo, and Woke up.
- Group actions work on any selection: select one or several children, or "Select all here", then:
  - check in, check out, mark absent
  - meal, nap start, wake up, sleep check, diaper or toilet, note
  - from the "More entries" menu: activity, mood, supplies needed, temperature, health (staff only), medication given, incident, name-to-face check, and fluids (infant rooms only)
- A live ratio bar shows children here, staff in the room, staff needed under the room's Ontario ratio, and In ratio / Out of ratio. Staff use "Join room" and "Leave room" so they are counted.
- Filters: All, Not arrived, Here, Sleeping, Gone home, Absent.
- Tapping a child opens their day timeline. It shows allergies, medical and diet notes, authorized pickups, and every event in time order. From the timeline, staff can edit or delete entries, add a sleep check, and correct attendance (a reason is required and kept in the record).
- Supervisors can open the teacher panel from the admin panel and pick any room.

**Admin panel** (`/admin`)
- **Dashboard:** per room for any day: placed, scheduled, checked in, absent, not arrived and out. Also staff in the room against staff needed, ratio status, "over licensed capacity" flags, placeholder-room flags, and incidents to review.
- **Children:** search and filter. Add a child with a first placement. The child page has the profile (allergies, medical, diet, photo permission), room placements (place or move, end dates, schedule days) and contacts (guardian, authorized pickup and emergency flags). It also links to their daily entries.
- **Attendance:** any day. Check a child in or out for someone (with time and who dropped off or picked up), mark absent, and correct a record (the reason and the previous values are kept). Also shows staff in rooms that day and lets you clock staff out.
- **Daily entries:** filter by date range, room, child and type. Shows incidents that need review, with a Review button. Supervisors can add backdated entries and edit or delete entries.
- **Rooms:** licensed age group, how the room runs, licensed and operating capacity, ratio and maximum group (from the rules), mixed-age approval, and a placeholder flag.
- **Capacity forecast:** the ported engine. Rooms down the side, months across. Click a cell to see who is in the room and what changes that month. You can set the horizon, toddler move-up age and school-leaving age.
- **Staff and logins:** staff accounts, roles, rooms, PINs, temporary passwords, and classroom tablet logins (create, reset password, change rooms, deactivate, remove).
- **Activity log**, and **My account** (change password, set PIN, and location details, which only the owner can edit).
- The location switcher appears for the owner, or for a supervisor of both locations.

**Data model**
Collections in storage:
- `locations`, `rooms`, `children`
- `enrollments`: room placements with start date, optional end date and schedule days. A new placement automatically ends the open one the day before.
- `contacts`, `users`, `devices`
- `attendance`: one record per child per day, with check-in and check-out time, who recorded it, drop-off and pickup person, absence reason, and correction history.
- `staffShifts`: staff in rooms, for ratios.
- `entries`: one record per child; a group entry shares a `groupId`. Entries are soft-deleted and keep their edit history.
- `sessions`, `audit`

A child counts as enrolled in a room on a date only when a placement covers that date. The research found that Lillio's statuses make this ambiguous.

## API endpoints and required roles

All endpoints take and return JSON. "Any signed-in" still means the data is limited to what that person may see. Teachers and tablets get only their rooms, today only.

| Method | Path | Roles |
|---|---|---|
| POST | `/api/auth/login` | public |
| POST | `/api/auth/device-login` | public |
| POST | `/api/auth/logout` | public |
| GET | `/api/auth/me` | public (returns `signedIn: false` when signed out) |
| POST | `/api/auth/password` | owner, admin, teacher (also allowed with a temporary password) |
| PUT | `/api/auth/pin` | owner, admin, teacher |
| GET | `/api/auth/device-staff` | device |
| POST | `/api/auth/pin-unlock` | device |
| POST | `/api/auth/pin-lock` | device |
| GET | `/api/meta` | any signed-in |
| GET | `/api/locations`, `/api/locations/:id` | any signed-in |
| PATCH | `/api/locations/:id` | owner |
| GET | `/api/rooms?location=`, `/api/rooms/:id` | any signed-in |
| POST, PATCH, DELETE | `/api/rooms`, `/api/rooms/:id` | owner, admin (DELETE archives) |
| GET | `/api/rooms/:id/status` | owner, admin, teacher, device |
| GET | `/api/children?location=&room=&date=&status=`, `/api/children/:id` | any signed-in |
| POST, PATCH, DELETE | `/api/children`, `/api/children/:id` | owner, admin |
| GET | `/api/children/:id/timeline?date=` | owner, admin, teacher, device |
| GET, POST, PATCH, DELETE | `/api/enrollments`, `/api/enrollments/:id` | owner, admin |
| GET | `/api/contacts?child=` (or `?location=` for admins) | any signed-in |
| POST, PATCH, DELETE | `/api/contacts`, `/api/contacts/:id` | owner, admin |
| GET, POST | `/api/users` | owner, admin |
| PATCH | `/api/users/:id` | owner, admin |
| POST | `/api/users/:id/reset-password` | owner, admin |
| PUT, DELETE | `/api/users/:id/pin` | owner, admin |
| GET, POST | `/api/devices` | owner, admin |
| PATCH, DELETE | `/api/devices/:id` | owner, admin |
| POST | `/api/devices/:id/reset-password` | owner, admin |
| GET | `/api/attendance?location=&date=&room=` | owner, admin, teacher, device |
| POST | `/api/attendance/check-in`, `/check-out`, `/absent`, `/undo` | owner, admin, teacher, device |
| PATCH | `/api/attendance/:id` (correction; needs `reason`) | owner, admin, teacher, device |
| GET | `/api/staff-attendance?location=&date=` | owner, admin, teacher, device |
| POST | `/api/staff-attendance/clock-in`, `/clock-out` | owner, admin, teacher, device |
| GET | `/api/entries?location=&date=` or `&from=&to=`, `&room=&child=&type=&unreviewed=` | owner, admin, teacher, device |
| POST | `/api/entries` (`childIds[]`, `type`, `data`) | owner, admin, teacher, device |
| POST | `/api/entries/nap-end` | owner, admin, teacher, device |
| PATCH, DELETE | `/api/entries/:id` | owner, admin, teacher, device |
| POST | `/api/entries/:id/sleep-check` | owner, admin, teacher, device |
| POST | `/api/entries/:id/review` | owner, admin |
| GET | `/api/dashboard?location=&date=` | owner, admin |
| GET | `/api/forecast?location=&horizon=&moveAge=&leaveAge=` | owner, admin |
| GET | `/api/audit?location=&limit=` | owner, admin |

Admins act only on their own location(s). Supervisors manage only educators. Writes from a tablet return `403` with `details.code = "pin_required"` until a staff member enters their PIN.

## Files

```
app/
  server.js              dev server: static files from public/, /api/* to api/_router.js
  seed.js                fake demo data (refuses to run in production or against non-JSON storage)
  api/_router.js         origin check, body, session -> principal, role check, JSON errors
  api/*.js               one file per resource; each exports { routes: [{ method, path, roles, handler }] }
  lib/storage/           storage interface: json-file.js (dev), production-stub.js (not implemented), index.js
  lib/sessions.js        signed cookies and server-side sessions
  lib/passwords.js       scrypt hashing, password and PIN rules, temporary passwords
  lib/permissions.js     who may do what
  lib/records.js         shared data helpers: placements on a date, child access, audit, safe user shapes
  lib/validate.js        input validation for every body and query
  lib/rules.js           Ontario rules (O. Reg. 137/15), ported from admin/js/rules.js, plus ratioStatus()
  lib/engine.js          the forecast, ported unchanged from admin/js/engine.js
  lib/forecast-input.js  stored data -> engine input
  lib/entry-types.js     daily entry types and their fields (shared with the UI via /api/meta)
  lib/locations.js       the two locations, Richmond Hill's licensed rooms, Markham placeholders
  public/                login.html, admin.html, teacher.html, css/, js/shared, js/admin, js/teacher
```

## Stubbed, partial or not built yet

- **Production database:** `lib/storage/production-stub.js` throws on purpose. Only the JSON-file adapter works. It is single-process and local only.
- **Rate limits** are kept in memory. On serverless hosting each instance would count separately, so a shared store is needed.
- **Markham rooms** are placeholders (Infant 1, Toddler 1, Preschool 1 with regulation maximums). Correct them from the licence under Rooms, then untick "Placeholder".
- **Not built yet:**
  - parent app and accounts
  - daily reports sent to parents (at check-out or at a set time)
  - photos and videos
  - messaging
  - billing and subsidies
  - waitlist and registration
  - menus and calendars
  - checklists
  - health screening questionnaires
  - weekly planner and developmental framework tags (activities use Ontario's four *How Does Learning Happen?* foundations for now)
  - reports and CSV export
  - a parent sign-in kiosk
  - staff certifications and schedules
  - offline mode
  - moving children between rooms or virtual areas during the day
  - scheduled future absences in bulk (supervisors can mark any single day)
- **Attendance is one check-in and one check-out per child per day.** Lillio allows several. Undo and corrections cover mistakes.
- **Ratios use the regulation's standard ratios.** Not modelled yet: reduced ratios allowed at arrival, departure and rest times, mixed-age group ratios, and a child counted while temporarily in another room.
- The forecast always applies the regulation's mixed-age allowance. It does not read each room's "mixed-age approved" flag yet.
- Teachers' one-tap check-out does not ask who picked the child up. The person can be added through "Correct attendance".
- **Entry form choices are our own.** Lillio's exact dropdown lists (health observations, mood terms, supply types, toilet options) were not visible in the research. See `docs/research/lillio-foundation.md`, "Not verified".
- **No automated tests in `app/` yet.** The QA agent owns `tests/`. Phase 1 was checked by hand with curl and a Playwright script.

## Decisions for the owner

1. **Database and hosting.** Real children's records must not go to any hosted service until these are chosen:
   - a database with Canadian data residency, encryption at rest, backups and access logs
   - a privacy review
   - a retention policy

   Vercel can serve `public/` as static files and run the API as functions. `api/_router.js` `handleApi(req, res)` can be wrapped in one catch-all function, or each `api/*.js` can become its own function. The JSON-file adapter cannot run there, and `SESSION_SECRET` (32+ characters), `APP_ORIGIN` and `TRUST_PROXY=1` must be set.
2. **Parent app:** accounts for guardians, what parents see (entries marked "staff only" are hidden), daily report timing, and kiosk sign-in with a code or signature.
3. **Billing:** whether to build it or keep a separate system. Lillio's SMART Billing add-on is not enabled at Newstead.
4. **Teacher logins:** whether educators should also keep personal password logins (currently optional), or use only classroom tablets plus PINs, as Lillio does.
5. **PIN policy:** 4 digits, and the 10-minute auto-lock. Also whether supervisors may unlock any tablet at their location (currently yes).
6. **Markham licence details**, including room capacities and any mixed-age approval.
7. **Importing real data from Lillio:** the Enrollment CSV covers children and placements. It needs a decision on how to treat Lillio's "Not Active" and graduated statuses (see research section A). Do this only after the database decision.
