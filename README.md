# Newstead Academy Admin

An admin site for Newstead Academy's two licensed child care centres in Ontario: **Richmond Hill** and **Markham**. It covers what Lillio does (attendance, waitlist, contacts, billing, menus, messages, photos) plus a **24-month capacity forecast** built on Ontario's licensing rules, and **classroom check-in** for teachers.

All capacity and ratio maths is rules-based (O. Reg. 137/15, Schedule 1 and section 8), not AI estimates.

## Locations

Pick the location in the top bar. Each one has its own rooms, roster, forecast settings and saved records (attendance, waitlist, contacts, billing, calendar, staff).

| | Richmond Hill | Markham |
|---|---|---|
| Licensee | Newstead Education Group Corp. | Newstead Academy Child Care Markham Corp. |
| Address | 13085 Yonge St, Units 12 and 22 | 120 South Town Centre Blvd |
| Age groups | Toddler, preschool, kindergarten, school age | Infant, toddler, preschool |
| Rooms | From the licence, in `admin/js/locations.js` | Entered on the site under **Classrooms** |
| Roster | `admin/data/richmond-hill.js`, built with `tools/make_roster.py` | Imported on the site under **Classroom rosters** |

## Who sees what

| Person | claude.ai share level | What they see |
|---|---|---|
| Owner, supervisor | Owner or Editor | Every page, both locations |
| Teacher | Contributor, linked to a staff record | Their main room's check-in only |
| Anyone else it's shared with | Any | A welcome page until a supervisor links them |

Teachers are linked in **Logins and configuration → Staff directory**: choose their main room and their Claude account. The page decides what each person sees; anyone the site is shared with can still read its saved data, so share it only with staff.

## Files

```
admin/
  index.html          page markup, loads the styles and scripts below in order
  css/                styles, one file per area (shell, tables, forecast, check-in, ...)
  js/rules.js         Ontario age groups, ratios and group sizes
  js/engine.js        the forecast: moves children between rooms month by month
  js/locations.js     the two locations and switching between them
  js/store.js         saved data (shared database on claude.ai, this browser otherwise)
  js/identity.js      who is signed in: admin, teacher or not set up
  js/setup.js         Markham's rooms and roster import
  js/checkin.js       classroom check-in
  js/*.js             one file per page (dashboard, waitlist, billing, ...)
  data/               rosters, git-ignored
tools/
  make_roster.py      Lillio Enrollment (csv) -> admin/data/richmond-hill.js
  check_forecast.js   prints the forecast table in the terminal
```

## Children's data stays out of git

`admin/data/*.js` and any `.csv` are git-ignored. They hold initials and birth months, which are still personal records. Build the roster locally and publish it with the site:

```
python3 tools/make_roster.py path/to/enrollment.csv
node tools/check_forecast.js rh
```

Note: commits before November 2026 included the Richmond Hill roster inside `admin/index.html`. This repository is public, so consider making it private.
