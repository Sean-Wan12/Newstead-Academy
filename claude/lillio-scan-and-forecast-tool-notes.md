# Lillio scan and forecast-tool notes

Scanned 2026-11-16, read-only, in Newstead Academy Childcare's Lillio admin (app.lillio.com). Viewed at a narrow window width, so layout impressions are of Lillio's small-screen layout. Not opened: child profiles, classroom rosters, billing, messaging threads.

## Goal

Build a standalone enrollment capacity forecasting tool for Ontario licensed child care, tested on Newstead. Not a full Lillio remake. It should look and navigate better than Lillio.

## Newstead's setup in Lillio

- 8 classrooms: Toddler 1, 2, 3; Preschool 1, 2, 3; Kindergarten 1, 2. No infant room.
- About 166 children enrolled (167 from January 2027 per Lillio's projection page).
- Toddler 1 shows 15 children, which equals Ontario's maximum toddler group size.
- Age ranges configured in Lillio: 0 m-1 yr, 0 m-1 yr 6 m, 1 yr 6 m-2 yr 6 m, 2 yr 6 m-4 yr 6 m, 2 yr 6 m-5 yr, 4 yr-6 yr. These are free-form labels, not Ontario's licensed categories.
- Add-ons not enabled: "Staff Management & Ratios" and "SMART Billing".

## Lillio's navigation (left menu)

Dashboard; Manage Enrollment (Registration & Waitlist, Enrollment Projections, Classroom Rosters); Classroom; Classroom Actions; Photos & Videos; Messaging; Contacts; Billing & Subsidies; Menus & Calendars; Reports; Parent Sign In; Logins & Configuration; Help Center.

Dashboard sections: date picker, Attendance, Activity, Overview, Recent Messages, Recent Comments, Recent Photos.

## Lillio's Enrollment Projections page (the feature we are replacing)

What it is:
- An end-of-month snapshot of open and filled spots.
- Filters: classroom, classroom age range, 3-month date window (Nov 2026-Jan 2027 shown), Export.
- Per month, a table by weekday (Mon-Sun) with columns Morning, Afternoon, Before/After, Unassigned; each cell shows Open and Filled.
- "View child lists" panel with tabs Waitlisted, Upcoming, Graduating, and an age filter.
- "View detailed month calendar" link per classroom.

How it is failing at Newstead:
- "Licensed capacity: Unavailable" and "Desired full capacity: Unavailable".
- Every Open/Filled cell is blank. All 166 children are counted as "Unassigned" because none has a rotation (weekly schedule) set.
- It depends on manually maintained rosters, graduation dates and schedules.
- Nothing seen on the page computes age eligibility, Ontario ratios, group maximums, mixed-age limits, or cascading room moves. (Lillio's help article on this would not load, so this is from the page itself.)

## Registration & Waitlist page

- Counters: Applicants, Waitlisted, New, In Progress, Ready to review, Approved. All are 0, so Newstead's waitlist is not kept in Lillio.
- Tabs: Applicants, Waitlists, Registrations.
- Table columns: Child name, Date of birth, Classroom, Start date, Created on, Status, Fees.
- Actions: Share application link, New child.

## Data we can pull out of Lillio (Reports page)

- **Enrollment (csv):** each child's DOB, age, class, status, enroll date, grad date, rotation, schedule. This is the import file for our tool.
- **Active Enrollment:** DOB, enroll date, grad date, rotation, schedule for active children.
- **Child Profile (csv):** classroom, DOB, permissions, contacts, address, allergies (more than we need).
- Staff List, Staff Time Log, Staff Attendance (csv) for the later staffing phase.

## Classroom setup fields in Lillio

Classroom name, classroom age range, desired capacity, display name, login, developmental framework age (Infants, Toddlers, Preschool, School-Age). There is no field for licensed age category, licensed capacity per room, ratio, maximum group size, or mixed-age approval.

## What our tool must do differently

1. Work from date of birth alone. No rotations or graduation dates required to get a first forecast.
2. Store each room's licensed age category, licensed capacity, operating capacity and mixed-age approval.
3. Apply O. Reg. 137/15 Schedule 1 from a versioned rule table (toddler 18-30 months, 1:5, max 15; preschool 30 months-6 years, 1:8, max 24; kindergarten 44 months-7 years, 1:13, max 26).
4. Compute transition windows per child and cascade moves from the oldest rooms down, month by month, 12-24 months ahead.
5. Show one grid: rooms down the side, months across, open spaces in each cell. Clicking a cell lists the birthdays, moves, starts and withdrawals behind the number.
6. Keep the waitlist in the same tool and match it to projected openings.

## Design notes (where Lillio feels dated)

- 13 top-level menu items with nested submenus; the forecast is two levels deep.
- Projections are split into one table per month by weekday and time of day, so there is no single view across months or rooms.
- Dense tables, small grey text, a warning banner instead of a guided fix.
- Empty states say "Unavailable" without a way to fix it in place.

Direction for ours: one home screen that is the forecast grid, at most 4-5 nav items (Forecast, Children, Rooms, Waitlist, Scenarios), inline setup prompts, colour-coded cells, and a side panel that explains each number.

## Open questions for Newstead

- Licensed capacity and licensed age category for each of the 8 rooms (from the licence).
- Which rooms have director-approved mixed-age grouping.
- Where the current waitlist lives (Excel?) and its columns.
- How kindergarten rooms relate to school entry in September.
