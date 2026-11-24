# QA report: Newstead admin (phase 1, `admin/`)

Date: 23 November 2026. Scope: the existing single-page admin under `admin/`. The new app under `app/` is phase 2.

Children are referred to by id only. The end-to-end tests load a synthetic Richmond Hill roster with made-up names. The real Lillio export was read only for counts.

## Summary

- **17 bugs found and fixed** in `admin/`: 1 critical, 3 high, 6 medium, 7 low. One more fix went into `tools/make_roster.py`. Each fix has a regression test.
- **Task 1 is done.** An admin can now import a fresh Lillio Enrollment (csv) for Richmond Hill, the same way as for Markham. The import replaces the built-in `admin/data/richmond-hill.js`. "Roster as of <date>" now shows on Classroom rosters, the Dashboard and the Enrollment overview. Any room with more children than its licence allows is flagged with "check the roster in Lillio".
- **Test suite:** `tests/run.sh` runs 43 unit tests and 54 end-to-end tests. **97 passed, 0 failed.**
- **Against the original code** (`NA_ADMIN=<copy of the old admin> tests/run.sh`), 27 end-to-end tests and 7 unit tests fail. A few of those fail only because a feature or export is new. The rest are the regressions listed below.

### About the 27/26 in Kindergarten 1

The Nov 16 export really does list 27 current Kindergarten 1 children: every one has an enroll date on or before Nov 16 and no grad date. The site counted correctly from a stale snapshot. Lillio's 26 means one of those 27 rows needs an end date in Lillio.

The same export shows Toddler 2 at 16. That is a child moving from Toddler 2 to Preschool 2 on Nov 23, whose old Toddler 2 row has no grad date. The forecast already handled this as a move. But a re-import on or after Nov 23 would have counted that child in both rooms (bug 5, now fixed).

## Task 1: Richmond Hill roster import

| Change | Where |
|---|---|
| The imported roster is watched for every location (it was Markham only). For Richmond Hill, `locRoster()` prefers the import over the built-in file | `js/setup.js` (roster watcher), `js/locations.js` (`locRoster`, `rosterInfo`) |
| The import button shows for admins at both locations. It matches Lillio classroom names to room names or licence names, so Lillio's Kindergarten 2 maps to the room licensed as Preschool 4 | `js/forecast-views.js` (`renderRosters`), `js/setup.js` (`rosterImportForm`) |
| "Roster as of 16 Nov 2026" text, with a warning once the roster is more than 7 days old | `rosterAsOfText()` in `js/locations.js`, used on Classroom rosters, Dashboard (`#dRosterAsOf`) and Enrollment overview |
| Flag for any room whose current roster count is over its *licensed* capacity: "Kindergarten 1 has 27 children on the roster for 26 licensed spaces: check the roster in Lillio…" | `overLicensed()` in `js/locations.js`; shown on Classroom rosters (`#rosterFlags`), Dashboard, Daily summary alerts and Enrollment overview |
| The month-end alert used to say "licensed spaces" while comparing against operating capacity. It now says "operating" when the cap is lower than the licence | `js/alerts.js` |

Tests: `test_TASK1_richmond_hill_import_replaces_the_built_in_roster`, `test_richmond_hill_shows_roster_date_and_over_capacity_flag`, `test_richmond_hill_import_saved_in_shared_database`, `test_old_roster_is_marked_stale`, `test_richmond_hill_without_the_built_in_roster_file`, and the unit test `Lillio classroom names match the Richmond Hill rooms…`.

## Bugs found and fixed

Line numbers refer to the original files, before the fix.

### 1. Critical: everyone the admin is shared with was treated as an admin

- **Steps to reproduce:** share the admin with a Contributor who is not linked as staff, or with a teacher. Open it. They see every page, every child, parent contacts and billing. They can switch locations and edit staff and setup.
- **Root cause:** `js/identity.js:19` reads `ME.admin = !!(u.isOwner() || u.canEdit())`. On claude.ai, `isOwner()` and `canEdit()` return promises (runtime contract 0.2.99). A promise is always truthy, so every signed-in viewer became an admin. The old ad-hoc test `/tmp/t/test2.py` mocked these calls as synchronous, which hid the bug.
- **Fix:** `await` both calls.
- **Regression tests:** `test_REGRESSION_non_editor_is_not_admin_when_isOwner_and_canEdit_return_promises`, `test_teacher_lands_on_their_room_checkin_and_cannot_reach_other_routes`, `test_unlinked_person_sees_welcome_everywhere_and_no_search`, `test_inactive_staff_record_does_not_grant_teacher_access`, `test_teacher_is_moved_to_their_location`.

### 2. High: teachers and unlinked people could search every child, family and staff member, and open edit forms

- **Steps to reproduce:** as a teacher on #checkin, press `/` (or the search icon on a phone) and type a letter. Results list children from all rooms, parents' names and phone numbers, staff, waitlist families and messages. Picking a staff, waitlist or contact result opens its edit form, including Delete and the Claude account link. `route()` blocks the pages but not this path.
- **Root cause:** `js/search.js:7–41`. The search box, `/` shortcut and `pickResult()` had no role check, and the top bar showed the search box to everyone.
- **Fix:** `canSearch()` (decided and admin) gates the input, shortcut, button and result picking. `body.no-search` hides the box for others (`js/locations.js` `renderTopbar`, `css/search.css`).
- **Regression test:** `test_REGRESSION_teacher_cannot_use_search_to_open_contacts_staff_or_waitlist`.

### 3. High: re-importing a roster moved attendance, contacts and invoices onto the wrong children

- **Steps to reproduce:** import a Markham roster and add contacts for child id 5. Import a newer export where a new child sorts earlier. Child id 5 is now a different child, carrying the first child's parents, attendance history and invoice. The new Richmond Hill import would hit this straight away when replacing the built-in file.
- **Root cause:** `js/setup.js:95` gives ids by row position (`id: kids.length + 1`). Contacts (`contacts/c<id>`), attendance (`kids[<id>]`) and billing lines are keyed by that id.
- **Fix:** `rosterFromCsv(text, rooms, today, prev)` keeps the previous roster's id for a child with the same displayed name and birth month. If a new namesake made the name longer ("Milo W." becomes "Milo Wa."), it falls back to first name plus initial. New children get ids never used before, and future-start plans are remapped.
- **Regression tests:** unit `REGRESSION re-importing keeps each child on the same id…` and `re-import maps future-start plans to the new ids`; e2e `test_TASK1_…` (a contact entered before the import stays with the same child).
- **Residual risk:** two children with the same displayed name and the same birth month could swap ids. A child who leaves could have their id inherited by a namesake born in the same month. Both are very unlikely.

### 4. High: the Richmond Hill roster could only be refreshed by rebuilding a file

This is task 1 above. Root cause: `js/locations.js:50` used `window.RH_DATA` for the static location and never looked for an imported roster. `js/setup.js:6` and `:111` limited roster import to Markham.

### 5. Medium: a child current in two Lillio rows was counted twice

- **Steps to reproduce:** import the real Nov 16 export on or after Nov 23. The child moving from Toddler 2 to Preschool 2 is counted in both rooms, and enrolment is overstated by 1.
- **Root cause:** `js/setup.js:93–97` adds a new child for every current row, even when the same child (same name and date of birth) already has one.
- **Fix:** count the child once, in the room with the later enroll date.
- **Regression tests:** unit `REGRESSION same child current in two rooms…` and `real Nov 16 export: room counts match the date rule…`.

### 6. Medium: the first check-in of the day could be wiped by another room

- **Steps to reproduce:** at opening time, two rooms check in their first child within the same second, before the day's attendance document exists. One check-in disappears.
- **Root cause:** `js/store.js:62`. When `update()` fails because the document is missing, `merge()` calls `set()`, which replaces the whole document. Another device's `set()` a moment later overwrites it (writes are last-writer-wins and there are no transactions).
- **Fix:** after that first `set()`, wait 400–800 ms and read the document again. If our values are missing, re-apply them with `update()`, which merges.
- **Regression test:** `test_REGRESSION_first_checkin_of_the_day_survives_another_device_creating_the_same_day`. The mock database lets another device's `set()` land just after ours.

### 7. Medium: a check-in page left open overnight recorded the next day on yesterday's date

- **Steps to reproduce:** leave #checkin open on a tablet past midnight. The next morning's check-ins are saved under the previous date. The only sign is "(not today)" in the lead text.
- **Root cause:** `js/shared-data.js:6`. `DAY` was set once at load.
- **Fix:** every 30 seconds, and when the tab becomes visible, a page that was showing today moves to the new today. A date the user picked on purpose is kept.
- **Regression tests:** `test_REGRESSION_checkin_page_left_open_overnight_moves_to_the_new_day`, `test_a_date_picked_on_purpose_stays_after_midnight`.

### 8. Medium: "today" and "now" followed the device's time zone instead of Toronto's

- **Steps to reproduce:** use a tablet or Chromebook set to UTC. After 7 pm Eastern, the admin shows tomorrow's date, and check-in times are 5 hours off.
- **Root cause:** `js/shared-data.js:4–5` (`todayISO()`, `nowHM()`) and `js/alerts.js:10` (the 6 pm check) used local device time.
- **Fix:** "today" and "now" come from `Intl.DateTimeFormat` with `America/Toronto`. Date arithmetic is unchanged.
- **Regression test:** `test_REGRESSION_device_set_to_another_time_zone_still_uses_toronto_date_and_time`. Route tests also cover weekends, holidays, month end (Nov 30, 23:30) and the DST change (14 Mar 2027).

### 9. Medium: a teacher's Claude account could not be found when linking staff

- **Steps to reproduce:** add a staff member and open the Claude account list. On claude.ai, `search('')` returns only the viewer and people the page has already resolved, so teachers who were never resolved are missing.
- **Root cause:** `js/identity.js:64` (`peopleList()` only called `search('')`).
- **Fix:** also search the organization by the staff member's name, and merge the results. The form now explains: save the name as it appears on claude.ai, then reopen the record.
- **Regression test:** `test_REGRESSION_staff_linking_finds_an_account_by_name`.
- **Not fixed:** guests from outside the organization may not be searchable at all. See the recommendations.

### 10. Medium: real children whose name contains "test" were silently left out of the roster

- **Steps to reproduce:** import an export with a child whose last name is Testa or Contestabile. The child is missing, with no message.
- **Root cause:** `js/setup.js:88` (`/test/i`) and `tools/make_roster.py`, which filtered on the substring "test".
- **Fix:** match the whole word "Test" only (`\btest\b`), in both places.
- **Regression test:** unit `REGRESSION a real name containing 'test'…`.

### 11. Low: unescaped attendance times; `esc()` did not escape `'`

- **Steps to reproduce:** a Contributor writes a crafted `in` or `out` value straight into the shared database (anyone at Contributor level can write it). Markup in that value is injected into the status pill and Parent sign-in on an admin's screen.
- **Root cause:** `js/attendance.js:13` (`stPill`) and `:60` (sign-in tile) concatenated `rec.in` and `rec.out` without escaping. `js/state.js:13` did not escape `'`, which the platform guidance requires.
- **Fix:** escape those values, and add `'` to `esc()`.
- **Regression tests:** `test_saved_text_is_escaped_everywhere_richmond_hill` and `test_imported_child_names_and_room_names_are_escaped_markham`. These put `<img onerror>`, `<svg onload>`, `<script>` and quotes into every saved field, the CSV names and the room names, then visit every page and every form.

### 12. Low: switching location briefly showed the previous location's records

- **Steps to reproduce:** on the shared database, open Contacts at Richmond Hill and switch to Markham. Until Markham's data arrives, the page shows Richmond Hill's parents. Child ids overlap between locations, so a contact form opened in that moment is prefilled with the other centre's family, and saving copies it.
- **Root cause:** `js/store.js:37` (`rebindStore()` cleared only `D.att` and `D.logs`).
- **Fix:** clear every location collection when the location changes.
- **Regression test:** `test_REGRESSION_switching_location_does_not_show_the_old_locations_records`.

### 13. Low: Classroom actions "Add entry" crashed at a location with no rooms

- **Steps to reproduce:** at Markham before any rooms are added, open Classroom actions and click Add entry. Nothing opens, and a TypeError appears in the console.
- **Root cause:** `js/attendance.js:41–42` (`roomById(ACT_ROOM).name` with no room).
- **Fix:** guard, with a message.
- **Regression test:** `test_every_form_button_opens_without_errors[markham-empty]`.

### 14. Low: on a 390 px phone the location picker was cut off, and Daily summary scrolled sideways

- **Root cause:** on phones the brand text could not shrink, which pushed the location picker and avatar off screen (`css/shell.css:37`). The Daily summary attendance table had no scroll container (`index.html:208`).
- **Fix:** below 520 px the brand shows its logo only. The table now scrolls inside its panel.
- **Regression test:** `test_phone_width_has_no_horizontal_page_scroll_or_clipped_text[rh|mk]`.

### 15. Low (accessibility): no focus ring on date inputs, and Tab left an open form

- **Root cause:** date and time inputs move focus into their inner fields, so `input:focus-visible` (`css/controls.css:7`) never matched. `js/modal.js` had no focus trap, so Tab moved behind the dialog.
- **Fix:** a `:focus-within` ring on date, time and month inputs, and Tab now cycles inside the open form.
- **Regression tests:** `test_keyboard_focus_is_visible_on_buttons[...]` and `test_keyboard_focus_visible_in_modal`.

### 16. Low: empty rooms always appeared under "Attendance not started"

- **Root cause:** `js/alerts.js:8` counted a room with no children as not started.
- **Fix:** only rooms that have children are counted.
- **Regression test:** `test_REGRESSION_empty_room_is_not_reported_as_attendance_not_started`.

### 17. Trivial: `staffNeeded(0)` returned `-0`

- **Root cause:** `js/rules.js:17`. `Math.ceil(-1e-9)` is `-0`.
- **Fix:** `Math.max(0, …)`.
- **Test:** `staff needed: infant 3 to 10…`.

## Found but not fixed

| Issue | Why not fixed | Recommendation |
|---|---|---|
| No database access rules. By default any Contributor (every teacher) can write every shared document: rosters, rooms, staff links, fees, billing. The role checks only change what the screen shows. | Rules are declared at publish time, not in `admin/`. They can only be tested on claude.ai. | Declare `db` rules: `write: "admin"` for `loc/*/setup`, `staff`, `settings`, `billing`, `waitlist`, `contacts`, `messages`; `interact` for `attendance` and `logs`. Then confirm with a Contributor account. |
| The roster file `admin/data/richmond-hill.js` is published with the site, so anyone the artifact is shared with (including the welcome-page users) can fetch every child's first name, initial and birth month. | It is a publishing choice. | Now that Richmond Hill can import its roster on the site, stop publishing the file. The site works without it (tested). |
| Teachers can change attendance for any date with the date picker. | Product decision, not a bug. | If only today should be editable, hide the date for teachers. |
| `tools/make_roster.py` still renumbers children on each rebuild and counts a same-day room move twice. | `tools/` is a fallback now. Only the "test" filter was fixed there. | Prefer the on-site import, or port the `rosterFromCsv` id and duplicate logic. |
| Guests (outside the organization) may not be findable when linking staff. | Depends on platform directory rules. | Add a "Request access" button on the welcome page that saves the viewer's id for an admin to link. |
| Deleting a Markham room leaves its children without a room (hidden from rosters and check-in until a re-import). | Warned in the delete button label. Changing it is a design decision. | Block deleting a room that has children, or offer to move them. |
| Clearing an operating-capacity box sets it to 0. | Saved only in this browser. Low impact. | Ignore empty input. |
| The import needs Lillio's UTF-8 CSV with M/D/YYYY dates. A file re-saved from Excel (Windows-1252, other date formats) imports with garbled accents or no rows. | Lillio's own export is fine. | Mention in Help: upload the file straight from Lillio. |
| Local preview mode (opened outside claude.ai) gives full admin access with browser-only storage. | Intended for previews. | Do not distribute the files outside claude.ai. |
| Old ad-hoc screenshots in `/tmp/t/` (`c1.png`, `c2.png`, `teacher.png`, `m1–m3.png`, `config.png`, `welcome.png`) from an earlier session were made with the real roster and may show children's names. | Not made by this QA run. | Delete them. |

## Test suite

Command: `tests/run.sh` (details in `tests/README.md`).

| Part | Runner | Tests | Result |
|---|---|---|---|
| `tests/unit/rules.test.js` | `node --test` | 7 | 7 pass |
| `tests/unit/engine.test.js` | `node --test` | 16 | 16 pass |
| `tests/unit/csv.test.js` | `node --test` | 20, including one using the real export (counts only, skipped if the file is absent) | 20 pass |
| `tests/e2e/test_routes.py` | pytest + Playwright (Chrome) | 10 | 10 pass |
| `tests/e2e/test_roles.py` | | 9 | 9 pass |
| `tests/e2e/test_checkin.py` | | 11 | 11 pass |
| `tests/e2e/test_setup_and_roster.py` | | 7 | 7 pass |
| `tests/e2e/test_xss.py` | | 2 | 2 pass |
| `tests/e2e/test_layout.py` | | 12 | 12 pass |
| `tests/e2e/test_actions.py` | | 3 | 3 pass |
| **Total** | | **97** | **97 pass, 0 fail** (about 2 minutes) |

The end-to-end tests use a synthetic roster (`tests/fixtures/make_fixtures.py`, made-up names). They use a mock of `window.claude` that follows the documented platform contract: promise-returning user calls, `set` replaces, `update` deep-merges and rejects on a missing document, frozen snapshots, and `use()` resolving after the first script run. They also fix the clock and time zone. No screenshots are kept: the few taken while debugging used synthetic data and were deleted.

## Risks that could not be tested here

- **Real claude.ai database and sharing.** Access rules, Contributor, Editor and Viewer write rejections (`invalid_argument`), realtime latency, `fromCache` snapshots, the 64-subscription limit and the 256 KiB document limit were checked against a mock only. Test after publishing with an owner, an Editor, a Contributor teacher and an unlinked Contributor.
- **Declared capabilities.** `user.id()` returns null unless `capabilities: { user: {} }` is declared. Names and `search()` need the `profile` scope. Without these, no teacher is ever recognized and everyone not an Editor sees the welcome page. Check the published declaration.
- **Concurrency.** The first-write fix assumes the two devices' writes land within the 400–800 ms recheck window. It narrows the race but is not a transaction. Test with two real devices checking in at the same moment.
- **Photo and video uploads** (`assets`), and copying to the clipboard inside the claude.ai frame.
- **Real Lillio exports for Markham**: classroom names and any extra columns. Only Richmond Hill's export was available.
- **Real phones and tablets**: Safari on iPad (the likely check-in device), on-screen keyboards, and the native date picker's focus behaviour. The tests ran in desktop Chrome at phone sizes.
