# Tests for the Newstead admin

Run everything with one command from the repository root:

```
tests/run.sh
```

`tests/run.sh unit` runs only the unit tests. `tests/run.sh e2e` runs only the end-to-end tests, and any extra arguments go to pytest (for example `tests/run.sh e2e -k roster`).

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
