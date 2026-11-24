# Tests for the Newstead admin

Run everything (the admin site and the new app) with one command from the repository root:

```
tests/run.sh
```

| Command | Runs |
|---|---|
| `tests/run.sh unit` | The admin unit tests only |
| `tests/run.sh e2e` | The admin end-to-end tests only |
| `tests/run.sh app` | The app's tests (`tests/app/`) only |

For `e2e` and `app`, any extra arguments go to pytest, for example `tests/run.sh app -k ratio`.

Needs Node 18 or later, Python 3 with `pytest` and `playwright`, and Chrome at `/usr/bin/google-chrome`. Nothing is installed from npm.

## What is tested

| Folder | Runner | Covers |
|---|---|---|
| `unit/rules.test.js` | `node --test` | Ratios, group sizes and age ranges from O. Reg. 137/15, staff needed (including the 3 to 10 infant ratio), the 20% mixed-age limit, the Richmond Hill licence rooms |
| `unit/engine.test.js` | `node --test` | The 24-month forecast: toddler to preschool at 30 months, infant to toddler at 18 months, early moves under the mixed-age limit, September school leavers and kindergarten moves, end dates, future starts, operating-capacity caps, empty locations |
| `unit/csv.test.js` | `node --test` | Lillio Enrollment (csv) import: quoted fields, CRLF, byte-order mark, missing columns, accents, namesakes getting more last-name letters, future starts, unmatched classrooms, Lillio's "Test" rows, only first name and last-name initial stored, stable ids on re-import, room counts on a date following the export's enroll/grad date rule. If the real export is on the machine, its room counts are checked too (numbers only, no names printed) |
| `e2e/` | pytest + Playwright | Every page for an admin without console errors (both locations, empty states, weekends, holidays, month end, DST), teacher and unlinked-person access, check-in, attendance per location and per day, Markham rooms and roster import, Richmond Hill roster import and "Roster as of", saved text with markup shown as text, phone width (390 px), visible keyboard focus |

## How the end-to-end tests run

- A local web server serves `admin/`. The Richmond Hill roster file is replaced by `fixtures/richmond-hill.js`, which `fixtures/make_fixtures.py` builds with made-up names. No real child's record is loaded, printed or screenshotted.
- `e2e/mock_claude.js` stands in for claude.ai's `window.claude`: the `user` calls return promises as the platform's do, and the `db` follows its documented rules (`set` replaces, `update` merges and fails on a missing document, snapshots are frozen).
- The clock is fixed to Toronto time (default Monday 23 November 2026, 9:00) with Playwright's clock, and the browser's time zone is America/Toronto unless a test sets another.
- `NA_ADMIN=/path/to/other/admin tests/run.sh e2e` runs the end-to-end tests against another copy of the site, for example an older version, to show which regression tests it fails.

Tests named `REGRESSION` reproduce a bug that was found and fixed; `docs/qa/qa-report.md` lists them.

## The app (`app/`)

`tests/app/` tests the new Node app. Each test module seeds its own copy of the app's fake demo data into a temporary folder and starts `app/server.js` on a free port. The server runs with `tests/app/fake_clock.js`, so tests can move its clock (midnight, DST, PIN auto-lock, session expiry). It stops the server and deletes the folder at the end.

| File | Covers |
|---|---|
| `unit/engine-port.test.js` | The app's forecast engine and rules equal the admin's on random rosters; ratio status |
| `test_api_permissions.py` | Every read route for owner, both supervisors, lead, assistant, floater, tablet locked and unlocked, and signed out; refused writes change nothing; IDOR; mass assignment; no hashes in responses |
| `test_api_auth.py` | Cookies, session fixation, tampered and expired sessions, CSRF and origin checks, JSON-only bodies, malformed and oversized bodies, headers, path traversal, rate limits, PIN unlock and auto-lock, deactivation, tablets, temporary passwords |
| `test_api_records.py` | Attendance, corrections, sleep and sleep checks, group entries, ratios including 3 to 10 for infants, staff Join and Leave, the dashboard against the records, room moves, Toronto midnight and DST, the forecast |
| `test_robustness.py` | Writes at the same moment, a crash mid-write, restart persistence, empty states, long text |
| `test_ui.py` | Admin sections and teacher panel in Chrome, stored markup shown as text, 390, 768 and 1024 px widths, keyboard focus, the PIN pad, a tablet set to another time zone |
| `test_route_coverage.py` | All 63 API routes are listed with their tests |

`NA_APP=/path/to/app tests/run.sh app` runs them against another copy of the app.

