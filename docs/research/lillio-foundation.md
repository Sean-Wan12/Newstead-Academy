# Lillio foundation research

Prepared 2026-11-23 for the Newstead Academy childcare app (replacement for Lillio, formerly HiMama). Covers the Richmond Hill (Lillio centre 47353) and Markham centres.

## How this was researched, and its limits

- **The live Lillio app could not be browsed today.** Opening `https://app.lillio.com/childcare/centers/47353/dashboard` in the user's built-in browser went to the Lillio login page ("You need to log in or sign up before continuing"). No credentials were entered. App browsing stopped there. The user must sign in again in the Claude desktop app's browser pane before anyone can check the live app.
- Because of that, there are **no "seen in app" facts from today** and **no network-request (endpoint) inventory**. Section E is inferred from forms, reports and help articles, not from API paths.
- Facts marked **"seen in app (2026-11-16 scan)"** come from the earlier read-only scan, recorded in `claude/lillio-scan-and-forecast-tool-notes.md` in this repo.
- Facts marked **"export (2026-11-16)"** come from structural, count-only analysis of the Lillio *Enrollment (csv)* export already on disk (`/mnt/user-data/uploads/9c4dc711-enrollment-47353.csv`) and the roster built from it (`admin/data/richmond-hill.js`). No names or birthdays were copied.
- Public sources were the Lillio help centre (`support.lillio.com`), lillio.com product pages, the App Store listing and HiMama onboarding PDFs. `support.lillio.com` is a JavaScript app that WebFetch could not render and the shell proxy blocks, so its **public** articles were read in a separate tab of the built-in browser. That tab had no Lillio account context and was closed afterwards.
- Help-centre article URLs are shortened below as `HC:<slug>`, meaning `https://support.lillio.com/s/article/<slug>`.

Source tags: **seen in app (2026-11-16 scan)**, **export (2026-11-16)**, **help centre (HC:…)**, **lillio.com (URL)**, **App Store**, **inferred**.

---

## A. Kindergarten 1: 27 or 26?

### What can be established without the live app

| Fact | Value | Source |
|---|---|---|
| Rows in the Nov 16 Enrollment export | 853 (one row per child per classroom enrolment, including past ones) | export (2026-11-16) |
| Columns | First name, Last name, DOB, Age, Classroom, Status, Enroll date, Grad date, Rotation, Schedule | export (2026-11-16) |
| Kindergarten 1 rows (all history) | 109 | export (2026-11-16) |
| KG1 rows with enroll date on or before Nov 16 and no grad date (or a grad date on or after Nov 16) | **27**. This is the number our site shows. | export (2026-11-16) |
| Those 27: rotation | All blank. | export (2026-11-16) |
| Those 27: schedule | All MTWRF. | export (2026-11-16) |
| Those 27: also current in another room | None. Checked: no child has a second open enrolment. | export (2026-11-16) |
| KG1 rows with a grad date on or after Nov 16 | 0. On Nov 16, no KG1 departure was recorded for a future date. | export (2026-11-16) |
| KG1 rows starting after Nov 16 | 0 | export (2026-11-16) |
| Latest KG1 graduations in the export | 11 rows with grad dates between 2026-09-01 and 2026-09-18. None in Oct or Nov. | export (2026-11-16) |
| Status column values (all rooms) | Active: 851, Upcoming: 2. Past enrolments with grad dates are also "Active", so this column is not a per-enrolment status. | export (2026-11-16) |
| KG1 licensed capacity (Ontario licence) | **26** (kindergarten group: 1:13 ratio, max group 26) | `claude/newstead-licence-capacity.md` |
| Same method for Toddler 2 | 16 open enrolments, against a licensed 15. Lillio's projections page counted 166 centre-wide; the export method gives 165. | export (2026-11-16); seen in app (2026-11-16 scan) |

### What Lillio's screens count (help centre)

- **Classroom Roster** (Manage Enrollment → Classroom Rosters → pick room) has tabs **Enrolled / Upcoming / Graduated**. Enrolled means "currently active in the classroom". Columns include schedule, DOB, age, enrolment date and allergies. HC:Classroom-Roster-Overview
- **Classroom (attendance) page** "will only include children scheduled to attend the childcare center that day". HC:director-How-can-I-take-attendance-using-HiMama
- **Graduate Child** marks the child inactive in that room. The child "will not appear on the class roster" and moves to the Graduated tab. HC:How-to-graduate-a-child
- **Deactivate (Not Active)** keeps the child in the class "in an inactive state". The child disappears from the attendance page and from billing, and **no grad date is needed**. HC:How-to-Deactivate-a-Child
- **Enrollment Projections** counts inactive children who have no graduation date as filled spots, and Lillio warns this inflates counts. HC:Enrollment-Projections-FAQ, HC:Enrollment-Projections-Guide-3
- The **Enrollment report** filters on enrolment *start date* within a date range, not on current status. HC:How-to-Pull-an-Enrollment-Report

### Answer to A

**Not verified in the live app.** The session was signed out, so today's KG1 roster count and any KG1 departures since Nov 16 could not be read. The Nov 16 export shows 27 open KG1 enrolments and no departure dated on or after Nov 16. So if Lillio shows 26, it is either a change made after the export or a different count.

What "26" could be, most likely first:

1. **A child made Not Active, or graduated, without a grad date.** That child would still be an open row in the export but would be gone from the Enrolled tab. Our importer (`tools/make_roster.py`) treats "no grad date" as current and ignores status. This would also explain Toddler 2 showing 16 against a cap of 15. (inferred)
2. **A KG1 departure recorded after Nov 16.** It would appear on the Graduated tab with its grad date. (inferred)
3. **The room's Desired Capacity or licensed capacity.** KG1 is licensed for 26, and Lillio has a "Desired Capacity" field per classroom (Logins & Configuration → Classroom Settings) and a centre-wide "Desired Full Capacity". HC:Enrollment-Projections-Guide-1
4. **Today's attendance figure.** The Classroom page and the dashboard's "Total scheduled / Checked in" counts show only children scheduled today, and they change with check-ins and absences. HC:Director-Dashboard-Overview

**To settle it once signed in (read-only):** Manage Enrollment → Classroom Rosters → Kindergarten 1. Count the Enrolled tab, then open the Graduated tab and note any enrolment-end dates on or after 2026-11-16. Then check Logins & Configuration → Classroom Settings → Kindergarten 1 → Desired Capacity.

**For our build:** count a child as enrolled only when the enrolment is active, has started, and has not ended. Import the export's Status where it exists, and flag any room over licensed capacity as a data problem rather than showing it silently.

---

## B. Admin (Director) panel

### B.1 Navigation (left menu)

Seen in app (2026-11-16 scan), with descriptions from the help centre.

| Menu item | Sub-pages | What it does | Source |
|---|---|---|---|
| Selected Center switcher | – | Picks the centre for multi-centre admins. Organization admins can see all centres. | seen in app; HC:How-to-Add-Remove-an-Administrator |
| Dashboard | – | Quick actions, Needs Attention, Live Attendance, Live Classroom Ratio Status, Classroom Activity, Inbox and media previews (see B.2). The Nov 16 scan saw an older layout: date picker, Attendance, Activity, Overview, Recent Messages, Recent Comments, Recent Photos. | HC:Director-Dashboard-Overview; seen in app |
| Manage Enrollment | Registration & Waitlist; Enrollment Projections; Classroom Rosters | Applications, waitlist and registration; capacity projections; per-room rosters | seen in app |
| Classroom | per classroom | Attendance page: check in/out, absent, move room, send report, health screening, parent sign-in | HC:director-How-can-I-take-attendance-using-HiMama |
| Classroom Actions | Add Entry → pick classroom | Adds daily-report entries (section C.3) from the web | HC:director-How-to-add-an-entry-to-the-daily-report |
| Photos & Videos | feed, tags, delete, collage, review delayed media | Media management | HC:Photos-and-Videos-Feed; HC:Setting-up-the-Delayed-Media-Sharing |
| Messaging | Messages tab (Inbox, Archived, Scheduled, Sent); Comments tab | Messages, bulletins, templates, scheduled messages, newsletter | HC:director-Message-Center-Overview |
| Contacts | – | Parent and guardian contacts, resending invitations | seen in app; HC:director-How-can-I-resend-the-invitation-email-to-a-parent |
| Billing & Subsidies | Invoices; Tuition Plans (Smart, Custom Group, Individual); Discounts; Credit ledgers; Subsidies (programs, agreements); Payers; Tax receipts; Transaction reports | Billing (see B.6) | HC:Billing-Getting-Started; HC:Subsidies-Overview |
| Menus & Calendars | up to 6 schedules | Menus and calendars, optionally visible to parents | HC:director-How-to-use-the-Center-Calendar |
| Reports | Center Reports; Classroom Reports | CSV or PDF reports, sent by email | HC:director-Monthly-Center-Reports |
| Parent Sign In | opens the kiosk page in a new tab | Web-only sign-in/out kiosk | HC:How-to-search-the-name-of-the-child-on-the-Parent-Sign-In-page |
| Logins & Configuration | Center Settings; Classroom Settings; Health Screening; Logins; Mobile Push Notifications; Virtual Areas; Add-on Features; User Access & Permissions; Registration Setup | All settings (see B.5) | HC:director-Logins-Configuration |
| Help Center | – | Link to support.lillio.com | seen in app |
| Staff Management / "Staff & Operations" (add-on) | Staff List, Time Log, Ratios, Scheduling | Staff profiles, time cards, ratios, shift schedules. **Not enabled at Newstead.** | HC:director-Staff-Management-Overview; seen in app |

### B.2 Director Dashboard (new layout)

Source: HC:Director-Dashboard-Overview. The article says the layout is still rolling out.

| Block | Contents |
|---|---|
| Quick Actions | Profile search (child or staff), Checklists, Add a child, Add staff, Add a classroom (a request to Lillio) |
| Needs Attention | Alerts ranked by safety and compliance risk, such as expired staff certifications and missing child info. Each clears when its count reaches 0 and links to the fix. |
| Live Attendance Status | Children and staff: Total scheduled, Checked in, Checked out, Absent, Not present. Each person counts once even across rooms. Links: Center Attendance List, Staff Schedules, and a menu with Weekly Ratios Report, 15-Minute Count Report, Staff Roster, Staff Time Log. |
| Live Classroom Ratio Status | Table: Room name; Ratio status (In ratio / Out of ratio); Current vs set ratio; Children / Staff counts. Hidden without the Staff Management add-on. |
| Classroom Activity | Photos & videos shared; Developmental skills logged; Messages received; Messages sent; Daily reports sent (% sent of those started) |
| Inbox & media | Last 5 parent messages; last 3 media comments; carousel of last 10 photos and videos |

### B.3 Manage Enrollment

**Registration & Waitlist.** Counters seen in app (2026-11-16 scan): Applicants, Waitlisted, New, In Progress, Ready to review, Approved, all at 0. Tabs: Applicants, Waitlists, Registrations. Columns: Child name, Date of birth, Classroom, Start date, Created on, Status, Fees. Actions: Share application link, New child.

| Registration status | Meaning | Source |
|---|---|---|
| New | Created; family not yet invited | HC:Online-Registration-Waitlist-and-Enrolment-Overview |
| In Progress | Family invited; waiting on forms and fees | same |
| Ready to Review | Family submitted | same |
| Approved | Director approved; family can no longer edit; not yet enrolled | same |
| Enrolled | Child profile created from the registration, pre-filled except the address. Hidden from the dashboard but searchable by status. | same |

Registration setup lives in Logins & Configuration → Registration Setup (HC:How-to-Configure-Online-Registration):
- **Childcare Applicant Form:** show, require or hide each field and section; choose the enrolment options offered; up to 100 custom short-answer questions; shared by a public link.
- **Registration Package**, five tabs:
  - Child Information: show, require or hide fields; up to 100 custom questions.
  - Permissions: Agree/Disagree items.
  - E-Consents: uploaded documents, signed by checkbox.
  - Documents: either a *Form* (download, fill, re-upload) or a *Record Request* (parent uploads their own file); each can be required.
  - Fees: line items on an automatic registration invoice.
- Items cannot be edited, only deleted and re-added. Deletion is permanent.

**Enrollment Projections** (seen in app 2026-11-16; HC:Enrollment-Projections-Guide-1/2/3, HC:Enrollment-Projections-FAQ):
- Filters: classroom, classroom age range, 3-month window, Export (CSV).
- For each month, a table by weekday (Mon–Sun) with columns Morning / Afternoon / Before-After / Unassigned, and Open and Filled counts in each cell. It is an end-of-month snapshot.
- "View child lists" side panel with tabs Waitlisted / Upcoming / Graduating and an age filter. "View detailed month calendar" per classroom, with its own CSV export.
- Requires centre **Licensed Capacity**, centre **Desired Full Capacity** (no higher than licensed), and per-room **Desired Capacity** and **Classroom age range** (preset or custom).
- Children with no rotation are counted as "Unassigned" and are not counted as filled. Inactive children with no grad date stay counted as filled. Filled spots above capacity are highlighted, but there are no notifications.
- At Newstead: licensed and desired capacity are "Unavailable" and every child is Unassigned (seen in app, 2026-11-16 scan).

**Classroom Rosters** (HC:Classroom-Roster-Overview):
- Tabs: Enrolled, Upcoming, Graduated. Search applies within the current tab.
- Columns: child, schedule, DOB, age, enrolment date, allergies.
- Row actions (⋯): Check in/out, Edit profile, View daily reports, Schedule an absence, Graduate.
- Bulk select shows a bottom action bar with a count, used for scheduling absences.

### B.4 Forms and their fields

**Add / Edit Child.** Source: HC:director-How-to-add-a-child; types are inferred.

| Section | Fields | Type, rules |
|---|---|---|
| Essentials | First name, last name, date of birth, gender, profile photo | text, date, select, image |
| Media permission | "Permitted in photos/videos with other children" | checkbox. If unchecked, the child cannot be tagged in group photos and their family does not see Classroom Photos. |
| Enrollment (repeatable: "Enroll in Another Class") | Home classroom, Status (Active / Not Active / Upcoming), Enrollment date, Graduation date, Rotation (optional; e.g. Morning, Afternoon, Before/After, Day), Weekly schedule | select, radio, date, date, select, Mon–Sun checkboxes. All days checked = shown on the attendance list daily; none checked = never shown. |
| Parent/Guardian (at least 1) | Full name, email (required, triggers the app invitation), phone, relationship | text, email, tel, select |
| Emergency contacts (at least 1) | Name, phone, relationship | text, tel, select |
| Home address | Address | Shown in Director view only; hidden from teachers |
| Allergy / Medical note | free text | text |
| Records / Forms | uploads: immunization, contact forms, incident reports, etc. | file |
| Doctor information | doctor details | HC:Where-do-I-add-a-child-s-doctor-s-information |
| Profile note | favourite foods, interests, fears, instructions | text (optional) |

Export values seen: Rotation = blank, "Day" or "Afternoon"; Schedule = weekday letters "MTWRF" (export).

**Add Staff.** Source: HC:director-How-to-add-a-staff-member.
- Name, DOB, contact information, gender, photo.
- Enrolment: home classroom or "No Homeroom" for floating staff, status, start date, rotation, weekly schedule.
- Emergency contacts, home address (director only), records (immunization, ECE degree, incident reports), profile note.
- Certifications with expiry date (e.g. CPR, RECE). Lillio alerts 60 days before expiry.

**Classroom Settings** (per room). Sources: HC:director-Classroom-Settings; HC:Enrollment-Projections-Guide-1; seen in app (2026-11-16 scan).

| Field | Notes |
|---|---|
| Classroom Name | |
| Developmental framework age range (formerly "Age Range") | Infants / Toddlers / Preschool / School-Age. Controls which entry types appear (Fluids only for infants, Homework only for school-age) and the framework skills. |
| Classroom age range | For projections; preset or custom. Newstead has free-form ranges (0 m–1 yr, …, 4–6 yr). |
| Desired Capacity | For projections |
| Student-Staff Ratio | Number; drives out-of-ratio alerts |
| Real-Time Naps & Meals | Checkbox: send Food and Sleep entries to parents immediately, or only with the daily report |
| Display Name | Name shown in messages |
| Login | Classroom username; a "Generate" button suggests one |

There are no fields for licensed age category, licensed capacity per room, maximum group size or mixed-age approval (seen in app, 2026-11-16 scan).

Other forms (help centre):
- **Schedule absence:** Reason (dropdown, e.g. Vacation, Holiday, Center Closure, Not Scheduled, or a note), start date, end date, notes. Bulk capable. Never overrides a day that already has attendance. HC:How-to-Bulk-Record-an-Absence-or-Center-Closure
- **Menu entry:** meal type, description, visible to parents (checkbox). HC:director-How-to-use-the-Menu
- **New calendar or menu:** type, name, visible on Parent app. Maximum 6. HC:director-How-to-use-the-Center-Calendar
- **Message:** recipients (specific parents, staff, a class, or the whole centre), subject, body, send now or schedule, templates. HC:director-Message-Center-Overview
- **Admin user:** name, email, centres, permissions. HC:How-to-Add-Remove-an-Administrator
- **Staff schedule event:** staff member, classroom, event type (Shift, Break, Prep, Training, Time off paid, Time off unpaid, Other), title, days, start and end, time-off reason (Vacation, Appointment, Center closure, Holiday, Home day, Not scheduled, Sick, Other), colour. HC:Staff-Scheduling-Overview
- **Checklist item sign-off:** completed by (required), notes. HC:How-to-Complete-a-Checklist---Teacher-Classroom

### B.5 Logins & Configuration

Source: HC:director-Logins-Configuration plus the linked articles.

| Section | Setting | Options |
|---|---|---|
| Center Settings | Licensed Capacity; Desired Full Capacity | numbers |
| | Delayed Media Sharing | No Delay / 1 h / 2 h / 3 h. Sending the daily report overrides it. HC:Setting-up-the-Delayed-Media-Sharing |
| | Parent Sign In & Pick Up: identification | No identification / Name or initials (typed) / Electronic signature |
| | Parent Sign-In Code | Checkbox. Each guardian gets a unique 5-digit code; admin can resend it or override. HC:director-Setting-up-the-Parent-Sign-In |
| | Parents can sign child in via app (Contactless Check-In) | checkbox. HC:Setting-up-the-Contactless-Check-In |
| | Safe Pickup | Checkbox: parent marks the child ready for pickup and the room is notified. HC:Setting-up-Safe-Pick-Up |
| | Auto Send Reports | Time dropdown. At that time, unsent reports are sent and anyone still present (children and staff) is checked out. HC:Setting-up-the-Auto-Send-Reports |
| | Parents can report absences | checkbox |
| | Staff can edit time cards | checkbox |
| | Weekend service | checkbox |
| | Overtime threshold | hours per week, default 40 |
| Classroom Settings | see B.4 | |
| Health Screening | Enable; custom questionnaire; Family Health Screening (parents complete it in the app) | HC:How-to-Perform-a-Health-Screening |
| Logins | Admin and classroom logins listed; Reset Password per classroom | HC:director-Classroom-logins-and-passwords |
| Mobile Push Notifications | Per-classroom checkboxes (parent messages, comments, …). Mobile only. | HC:director-Mobile-Push-Notifications |
| Virtual Areas | Named non-classroom locations (playground, lunchroom, field trip). Used by Move Rooms and Name-to-Face. | HC:director-Virtual-Areas |
| Add-on Features | Lists add-ons: Staff Management & Ratios and SMART Billing, both **not enabled** at Newstead | seen in app (2026-11-16 scan) |
| User Access & Permissions | "Go to Staff Access": add, edit or deactivate admins | HC:How-to-Add-Remove-an-Administrator |
| Registration Setup | Applicant form; Registration package | HC:How-to-Configure-Online-Registration |
| Curriculum | Enable Lillio Curriculum (Funshine) per classroom; purchase | HC:How-to-Enable-HiMama-Curriculum |
| Developmental framework | Set by Lillio staff at account setup | HC:How-to-record-Developmental-Observations |

### B.6 Billing & Subsidies

| Area | Details | Source |
|---|---|---|
| Tuition plans | **Smart** (one per age group; switches automatically when a child graduates to a new age group), **Custom Group**, **Individual** (fixed rate only) | HC:director-Setting-Up-Tuition-Plans |
| Plan fields | Age range (Smart); frequency (Weekly / Biweekly / Twice per month (1st–14th, 15th–end) / Monthly); first billing period; invoice generation relative to period start or end; due date offset; fee type: Flat Rate (rate, tax %, invoice note), Tiered by Enrollment (rate for 1–5 days/week, optional half days), Daily Rate (per day, billed on days attended) | HC:director-Setting-Up-a-SMART-Tuition-Plan |
| Invoice statuses | Ready, Sent, Pending, Paid, Overdue, Cancelled, Failed, Retry, Partial, Refunded | HC:director-All-about-invoices |
| Invoice actions | Send/Resend, Edit (total locked once sent), Add partial payment, Mark as paid, Cancel; manual invoices; refunds | same |
| Other | Discounts; Credit ledger; Payers page; split billing / bundled payments; tax receipts (generate, edit, publish); transaction reconciliation report; enforced autopay; failed-ACH handling | HC:Billing-Getting-Started; Lillio Payments help section |
| Subsidies | Subsidy Programs; per-child Subsidy Agreements with expiry tracking; record, edit or delete subsidy payments; handle the difference (bill, refund, write off, balance, move overage to credit ledger); Subsidy Payments report | HC:Subsidies-Overview |
| Payments | Lillio Payments portal: ACH and card, autopay, disputes, withdrawals, returns, its own users and access templates | Lillio Payments help section; get.lillio.com/billing-and-payments |

### B.7 Reports

| Group | Report | Format | Source |
|---|---|---|---|
| Center (monthly) | Active Enrollment (name, DOB, classroom, enrol date, future grad date, rotation, schedule) | CSV | HC:director-Monthly-Center-Reports |
| | Enrollment (filter: start-date range, centre or classroom) | CSV, emailed | HC:How-to-Pull-an-Enrollment-Report |
| | Health; Monthly Attendance Summary (hours and days); Monthly Attendance (every check-in/out, absences, signatures); Sleep Check; Food; Toilet Check | PDF, emailed | HC:director-Monthly-Center-Reports |
| | Child Profile (name, age, gender, contacts, emergency contacts, allergies, notes); Temperature Check | CSV / PDF | same |
| | Allergies/Medical Notes; Birthdays; Contacts; Immunization Record; Meal Count; Child Attendance (CSV); Staff List; Staff Time Log; Staff Attendance (CSV) | various | Director guides index; seen in app (2026-11-16 scan) |
| Classroom (weekly) | Name to Face; Weekly Attendance (hours, in/out, room moves, absences); Health; Sleep Check | PDF / screen | HC:director-Weekly-Classroom-Reports |
| Staff (add-on) | Weekly Ratios; 15-Minute Count; Staff Roster; Staff Time Log | – | HC:Director-Dashboard-Overview |
| Billing | Transaction reports; Subsidy Payments; Transaction Reconciliation; tax receipts | – | billing articles |
| Per child | Child's attendance report; Development Evidence report | screen / print | HC:How-to-view-an-individual-attendance-report; HC:How-to-record-Developmental-Observations |

---

## C. Teacher side

### C.1 How a teacher signs in

- **One shared login per classroom.** Each classroom has a single username and password, and every staff member in that room uses it. There are no per-teacher accounts and no staff PIN. Only admins reset classroom passwords. HC:director-Logins-Configuration; HC:director-Classroom-logins-and-passwords; app.lillio.com/launch-plan
- Logins come in two types: **administrator** (personal, by email) and **classroom** (shared, by username). app.lillio.com/launch-plan
- **Devices:** one tablet per room is recommended (iOS or Android; Amazon Fire is not supported). The same "Lillio" app (App Store id1098305044, by Hi Mama Inc.) serves directors, teachers and parents, and there is a web app too. The login screen asks for classroom, username and password. lillio.com/faq; App Store; HiMama Teachers Guide PDF
- **Who did what:** individual staff are identified only by tapping their own profile under "Staff" on the Classroom Dashboard to clock in and out. That requires the Staff Management add-on and staff profiles. Entries are recorded against the classroom; Lillio asks teachers to type their initials in the notes of Name-to-Face checks. HC:teacher-How-to-clock-in-and-out; HC:director-How-to-do-Name-to-Face-tracking
- **Floating Staff classroom** (comes with Staff Management): a login for floaters, kitchen staff and supply staff to clock in, with no access to child data. HC:What-is-the-Floating-Staff-room
- **Visibility:** a classroom login sees its own room. Health screening notes that teachers "may not have permission to see all children across the entire center" unless an admin enables it. Classroom toggling is possible offline "if classroom access has been enabled". HC:How-to-Perform-a-Health-Screening; HC:Offline-Attendance-Overview

### C.2 Teacher app layout

From the help centre (HC:Classroom-Roster-Overview, HC:How-to-Edit-a-Daily-Report-Teacher, HC:How-to-Add-Photos-to-the-Classroom-Journal-Teacher, HC:How-to-Complete-a-Checklist---Teacher-Classroom, HC:How-to-search-the-name-of-the-child-on-the-Parent-Sign-In-page) and the Teachers Guide PDF:
- **Home / Classroom Dashboard:** children with Check In / Check Out / Absent / Move room / Send Report; a "Staff" section to clock in and out; a Checklists button; an Open Screening button when health screening is on; an out-of-ratio alert; the "+" Entries menu; an offline mode banner.
- **Bottom navigation:** Daily reports (the Edit Reports dashboard); Messages (envelope icon).
- **More menu:** Enrollment (the classroom roster); Classroom Journal (bulk photos); Weekly Planner; Parent Sign In (web only); and others.
- Teachers can add a child, schedule absences, graduate a child and enrol them in a new class, check in unscheduled or graduated children, and pull weekly attendance reports. HC:director-How-to-add-a-child; HC:How-to-graduate-a-child; HC:How-to-Pull-a-Weekly-Attendance-Report-Teachers

### C.3 Daily entry types

Lillio says there are "15 report entry options". The help centre lists the types below. Every entry follows the same steps: open the Entries menu ("+" in the teacher app, or Classroom Actions → Add Entry on the web) → choose a type → select children ("Select All" available) → fill fields → optionally attach a photo, video or collage → Create Entry. Most entries have a time that defaults to now, with "5 / 10 / 15 / 30 min ago" shortcuts. Source: HC:director-How-to-add-an-entry-to-the-daily-report and HC:teacher-How-to-add-an-entry-to-the-daily-report.

| Entry | Fields | Parents see? | Restrictions | Source |
|---|---|---|---|---|
| Check In (single or batch) | time; optional health screening first; parent signature on the kiosk or app | Starts the daily report | – | HC:teacher-How-to-check-in-out-the-children-in-batch |
| Absent | reason (menu) or note | Attendance | – | HC:director-How-can-I-take-attendance-using-HiMama |
| Activity | Import from Weekly Planner, or description; developmental tags (domain → skill → up to 3 indicators, repeatable); media; photo title | Yes | – | HC:teacher-Adding-an-Activity-entry |
| Health | status: fine / sick / injured; one or more observation options; notes | **No, internal only** | – | HC:teacher-Adding-a-Health-entry |
| Temperature | time; normal or feverish; temperature; notes | Yes | – | HC:director-Adding-a-Temperature-Check-entry |
| Fluids | time; fluid type; amount (fl oz); notes | Yes, real time if enabled | Infant rooms only | HC:teacher-Adding-a-Fluids-entry |
| Food | meal (dropdown, e.g. Breakfast or Lunch); quantity (All / Most / Some / None / N/A); what was eaten (typed, or Import from Menu); media | Yes, real time if enabled | – | HC:teacher-Adding-a-Food-entry; HC:How-to-Edit-a-Daily-Report-Teacher |
| Sleep | start time; end time (same as start while sleeping, edited on waking); notes | Yes, real time if enabled | – | HC:teacher-Adding-a-Sleep-entry |
| Sleep Check | Sleep Check checkbox; check time; notes; children tapped as checked | Yes (on the report) | Needs an open Sleep entry; typically every 15/30/60 min | HC:teacher-Adding-a-Sleep-Check-entry |
| Toilet | time; event type (several allowed: potty, diaper change, underwear change, accident…); toilet options; notes | Yes | – | HC:teacher-Adding-a-Toilet-entry |
| Mood | mood term; level (e.g. "Extremely" happy); note; media; developmental tags | Yes | – | HC:teacher-Adding-a-Mood-entry |
| Supplies | supply type(s); notes | Yes, shown at the top of the report | – | HC:teacher-Adding-a-Supply-entry |
| Notes | type: general update / important notice / medication given / incident (fight, accident); note; media | Yes | Medication and incidents have **no dedicated forms**; they are Notes | HC:teacher-Adding-a-Note-entry |
| Homework | details | Yes | School-age rooms only | HC:teacher-How-to-add-an-entry-to-the-daily-report |
| Name-to-Face | children tapped as seen; time; notes (teacher initials); virtual areas allowed | **No, internal** | – | HC:director-How-to-do-Name-to-Face-tracking |
| Move Rooms | time; destination (classroom or virtual area); notes. A single child can also be moved from the attendance page (status "Moved"). | Attendance reports | – | HC:director-Adding-a-Move-Room-entry; HC:director-How-to-move-children-between-classrooms |
| Check Out (single or batch) | time; parent signature or initials if required | Ends the day | – | HC:director-How-to-add-an-entry-to-the-daily-report |
| Photos / Classroom Journal | up to 10 photos or videos, caption; children without group-photo permission are excluded | Yes, real time unless delayed | – | HC:How-to-Add-Photos-to-the-Classroom-Journal-Teacher |
| Health Screening | questionnaire answers; screening notes; pass / fail; temperature (optional) | Recorded at check-in; child shows "Screened" | Must be enabled | HC:How-to-Perform-a-Health-Screening |
| Developmental Observation | domain, skill, indicators, media | Activity tags: yes; Development Evidence report: internal | – | HC:How-to-record-Developmental-Observations |
| Staff clock in / break / end day | time card; note if edits are allowed | No | Staff Management add-on | HC:teacher-How-to-clock-in-and-out |
| Checklist items | completed by, notes; cannot be undone; resets daily, weekly or monthly | No | Mobile only | HC:How-to-Complete-a-Checklist---Teacher-Classroom |

The detailed dropdown lists (health observations, mood terms, toilet options, supply types, absence reasons, fluid types) are **not published** in the help centre. They need a signed-in look at the forms (Classroom Actions → Add Entry → each type, then Cancel).

### C.4 How entries reach parents

- **Report lifecycle:** a daily report is created at check-in and fills in real time. Parents can view it mid-day, but it is "not finalized". HC:Introduction-to-the-parent-portal; lillio.com/faq
- **Sending:** after check-out, the teacher taps Send Report → OK, and the report goes by email and the Parent app to every guardian on the profile. With 4 or more children checked out, "send all" sends all of them. Children can check in and out several times a day, so send only after the last check-out. HC:director-How-to-send-Daily-Reports
- **Auto-Send Reports:** at a time set by the centre, all unsent reports go out and anyone still checked in is checked out. HC:Setting-up-the-Auto-Send-Reports
- **Real time:** photos and videos arrive immediately unless Delayed Media Sharing is set. Food, Sleep and Fluids arrive immediately if the room has Real-Time Naps & Meals on. Supply and messaging notifications are immediate. HC:director-Classroom-Settings; lillio.com/blog/10-time-saving-features-with-lillio-daily-reports
- **Editing:** teachers can edit **today's** report only, per entry or in bulk (bulk is for meals only). Directors can edit past reports and add backdated entries. HC:How-to-Edit-a-Daily-Report-Teacher; HC:How-to-Add-Backdated-Entries-for-Children---Director
- **Offline:** check in/out, mark absent and check back in work offline, one action per child, and sync when the device reconnects. Move rooms, send report and viewing profiles are unavailable offline. HC:Offline-Attendance-Overview

---

## D. Parent side (public information)

| Feature | Details | Source |
|---|---|---|
| Account | The centre adds the guardian's email, which sends a welcome email to set a password. Crew members (extended family) are invited by the parent only. | HC:set-up-HiMama-login |
| Feed | Latest photos and videos; View Report for today's report | HC:Introduction-to-the-parent-portal |
| Check-in / pickup | If enabled: Check In from the app, Mark Absent (with details), Pickup request (Safe Pickup), with initials or signature as the centre requires | HC:How-to-check-your-child-in; HC:How-to-mark-your-child-as-absent; HC:How-to-submit-a-pick-up-request-for-your-child |
| Kiosk sign-in | Web page at the centre; parent enters a 5-digit code (if required), finds the child, Check In/Out, initials or signature. Web only. | HC:How-to-search-the-name-of-the-child-on-the-Parent-Sign-In-page |
| Health screening | Parent completes the questionnaire in the app if Family Health Screening is on | HC:How-to-Perform-a-Health-Screening-Parent |
| Messages | Message the centre (the director is always CC'd); like and comment on media | HC:Introduction-to-the-parent-portal |
| Schedule | Lessons, activities and meals from the Weekly Planner and Menus | same |
| Headlines, albums, favourites, downloads | Media organised by month; private albums; Photo Plus paid add-on ($2.99) | same; App Store |
| Daily reports history | Past reports | same |
| Milestones, private journal entries | Parent-only entries shared with the crew, not with the centre | same |
| Crew | Invite, remove, permissions (admin access, private photos) | HC:How-to-change-the-Crew-permission |
| Manage Children | Update the child profile and photo | HC:Introduction-to-the-parent-portal |
| Billing | View invoices; pay by ACH or card; autopay; billing contact; refunds; tax receipts | Parent guides index |
| Registration | Submit an application from a link; complete the registration package (forms, consents, fees) | HC:How-to-Register-Your-Child-Online |
| Settings | Push notifications, fewer emails, password, email, language (EN / FR / ES) | Parent guides index; App Store |

---

## E. Data model (inferred)

| Entity | Key fields | Relationships | Basis |
|---|---|---|---|
| Organization | name | has Centers and Org admins | HC:How-to-Add-Remove-an-Administrator |
| Center | name, licensed capacity, desired full capacity, settings (sign-in identification, sign-in code, contactless, safe pickup, auto-send time, delayed media, absences by parents, staff time-card edits, weekends, overtime threshold), developmental framework | has Classrooms, Virtual Areas, Menus/Calendars, Health questionnaire, Registration config | B.5 |
| Classroom | name, display name, framework age group, classroom age range, desired capacity, student-staff ratio, real-time naps & meals, login username/password, push-notification prefs, curriculum enabled | belongs to Center; has Enrollments, Staff (homeroom), Daily entries | B.4 |
| Virtual Area | name | belongs to Center; target of Move Rooms | HC:director-Virtual-Areas |
| Age Range | label, min/max (preset or custom) | shared across centres; used by Classroom and Smart plans | HC:Enrollment-Projections-Guide-1 |
| Child | first/last name, DOB, gender, photo, group-photo permission, address, allergy/medical note, doctor, profile note, documents | has Enrollments, Guardians, Emergency contacts, Daily reports, Attendance, Media, Invoices, Subsidy agreements | B.4 |
| Enrollment | child, classroom, status (Active / Not Active / Upcoming / Graduated), enroll date, graduation date, rotation (Morning / Afternoon / Before-After / Day / none), weekly schedule (days) | many per child, one per room stint; drives attendance lists, projections and Smart billing | export; HC:How-to-graduate-a-child |
| Guardian / Contact | name, email, phone, relationship, sign-in code, billing contact flag, app account | many-to-many with Child; emergency contacts are separate | B.4 |
| Crew member | name, email, permissions (admin, private photos) | linked by Guardian to Child | HC:How-to-change-the-Crew-permission |
| User / Login | type (org admin, centre admin, classroom, parent, crew), email or username, permissions (Billing & payments; Child & classroom data), centres | admin↔Centers; classroom login↔Classroom | HC:How-to-Add-Remove-an-Administrator |
| Staff | name, DOB, contact, gender, photo, homeroom (or none), status, start date, schedule, emergency contacts, address, documents, certifications (type, file, expiry) | has Time cards, Schedule events | HC:director-How-to-add-a-staff-member |
| Time card | staff, clock in, breaks, clock out, note, room moves | belongs to Staff | HC:director-Staff-Management-Overview |
| Schedule event | staff, classroom, type, title, start/end, time-off reason, paid flag, colour; week templates | belongs to Staff | HC:Staff-Scheduling-Overview |
| Attendance record | child, classroom, check-in time, check-out time (several per day), signer identification or signature, absence reason, health screening result, offline flag | belongs to Child; feeds reports and billing | C.3 |
| Absence | child, reason, start/end, notes; bulk or centre closure | belongs to Child | HC:How-to-Bulk-Record-an-Absence-or-Center-Closure |
| Daily report | child, date, status (open / sent), sent at, sent by (manual or auto) | has Entries | C.4 |
| Entry | type (see C.3), time(s), children (many), type-specific fields, notes, media, developmental tags, visible-to-parents flag | many-to-many with Children; belongs to Classroom | C.3 |
| Developmental tag | framework → domain → skill → indicator (up to 3) | linked to Activity and Mood entries; builds the Development Evidence report | HC:How-to-record-Developmental-Observations |
| Media | file, type, title or caption, children tagged, classroom, delayed-until, likes and comments | linked to Entries, Albums | HC:How-to-Add-Photos-to-the-Classroom-Journal-Teacher |
| Health screening | questionnaire (questions), response (answers, notes, pass/fail, temperature), by staff or parent | belongs to Child and Attendance | HC:How-to-Perform-a-Health-Screening |
| Checklist | title, items, schedule (daily / weekly / monthly), classroom; completion (item, completed by, notes, time) | belongs to Center / Classroom | HC:How-to-Complete-a-Checklist---Teacher-Classroom |
| Message / Thread | sender, recipients (parents, staff, class, centre), CC teacher, subject, body, scheduled-at, archived, flag S/P/T | belongs to Center | HC:director-Message-Center-Overview |
| Message template | name, body | belongs to Center | same |
| Menu / Calendar | type, name, visible to parents (maximum 6) | has Menu entries (date, meal type, description, visible) and Calendar entries | B.4 |
| Weekly plan | weekly routine (experiences), activities (custom, library, curriculum theme), shareable with families | belongs to Classroom; Activity entries import from it | HC:Weekly-Planner-Overview |
| Tuition plan | type (Smart / Group / Individual), age range, frequency, first period, invoice timing, due offset, fee type and rates, tax %, note | has Children | B.6 |
| Invoice | child, payer, items, total, status, sent at, due date, payments, refunds | belongs to Child and Payer | B.6 |
| Discount, Credit ledger, Payer, Payment, Refund, Tax receipt | – | billing support | B.6 |
| Subsidy program; Subsidy agreement; Subsidy payment | program name; agreement (child, program, dates, expiry); payment amount and date; differences | Child ↔ Program | HC:Subsidies-Overview |
| Applicant / Registration | child info, guardians, desired start, classroom, status (New / In Progress / Ready to Review / Approved / Enrolled / Cancelled), waitlisted flag, documents, consents, permissions, fees, custom answers, priority | becomes Child and Enrollment on enrol | B.3 |
| Report request | type, filters (dates, centre, classroom), format, emailed to admin | – | B.7 |

**API endpoints:** not captured, because the session was signed out. Repeat `read_network_requests` (paths and methods only) once the user signs in again.

---

## F. Roles and permissions

| Role | How they sign in | Can do | Cannot do | Source |
|---|---|---|---|---|
| Organization admin | personal email login | Everything across all centres; add, edit or remove admins; set centre admins' permissions | Adding another org admin needs Lillio support | HC:How-to-Add-Remove-an-Administrator |
| Centre admin (director) | personal email login | Selected centres only; permission toggles: **Billing & payments** (invoices, plans, subsidies, tax receipts, payers, ledgers, discounts) and **Child & classroom data** (profiles, classroom actions, entries, media, menus, projections, rosters, contacts, reports); manage classroom logins | Cannot add or remove admins | same |
| Classroom (teacher) | shared classroom username and password | Attendance, check-in/out, absences, all entry types, edit today's reports, send reports, messages to parents, class bulletins, photos, Weekly Planner, checklists, health screening, add a child, graduate or enrol, roster, weekly attendance report, Parent Sign-In kiosk, clock in/out (add-on) | Edit past reports; settings; billing; home address (hidden); other rooms unless classroom access is enabled; Development Evidence is internal | Sections C.1–C.4 |
| Floating staff | Floating Staff classroom login | Clock in/out; be moved between rooms for ratios | See children or add entries | HC:What-is-the-Floating-Staff-room |
| Parent / guardian | personal email login (and a 5-digit kiosk code) | View reports and media; message (director CC'd); check-in, absence and pickup if enabled; health screening; pay invoices; manage crew; update the child profile | Add daily entries (only private ones) | Section D |
| Crew | personal login, invited by a parent | See updates and photos at the level the parent grants | – | HC:How-to-change-the-Crew-permission |

---

## G. Pain points our version should fix

1. **Shared classroom logins.** Lillio cannot tell which teacher recorded an entry, and passwords must be reset when staff leave. Use per-staff accounts or a per-staff PIN on a shared room device, and stamp every entry with the staff member. (HC:director-Logins-Configuration; inferred)
2. **The meaning of "enrolled" is unclear.** Graduated, Not Active, Upcoming and "no grad date" interact in ways that inflate projections (Lillio's own FAQ admits it). The Status column in the export is not per enrolment, which is why our count is 27 against 26 and Toddler 2 is 16 against 15. Use one explicit enrolment state with start and end dates, and validate it against licensed capacity. (Section A)
3. **Projections depend on rotations.** Children without a rotation fall into "Unassigned" and are not counted as filled, so every Newstead cell is blank. Our forecast should work from date of birth and enrolment alone. (seen in app, 2026-11-16 scan)
4. **No licensing fields.** Lillio has no licensed age category, room capacity, maximum group size or mixed-age approval; its "age range" labels are free text. (seen in app, 2026-11-16 scan)
5. **Too many levels and 13 top-level items.** Rosters and projections sit two levels deep, and settings for one feature are scattered (capacity in Center Settings, desired capacity in Classroom Settings, ratios in Classroom Settings, add-ons elsewhere). (seen in app; HC:Enrollment-Projections-Guide-1)
6. **Empty states without a fix.** "Licensed capacity: Unavailable" has no inline way to set it. (seen in app, 2026-11-16 scan)
7. **Incidents and medication are free-text Notes.** Ontario needs structured serious-occurrence, incident and medication-administration records with parent acknowledgement. (HC:teacher-Adding-a-Note-entry; inferred)
8. **Reports arrive by email as CSV or PDF**, not on screen. Offer on-screen tables with filters plus export. (HC:How-to-Pull-an-Enrollment-Report)
9. **Remembering to send reports.** This needs manual taps or an auto-send that also force-checks-out everyone, which can falsify attendance times. Send automatically at check-out, and flag children still checked in rather than checking them out. (HC:Setting-up-the-Auto-Send-Reports)
10. **Teachers can edit only today's report**, and bulk edit works for meals only. (HC:How-to-Edit-a-Daily-Report-Teacher)
11. **Limits:** 6 menus and calendars; Parent Sign-In is web only; checklist items cannot be undone; registration items cannot be edited. (various HC)
12. **Ratios and staff features sit behind a paid add-on** and are hidden without it, though ratio compliance is a licensing basic. (HC:Director-Dashboard-Overview)
13. **Multi-entry days** (several check-ins) can make reports go out before the final check-out. (HC:director-How-can-I-take-attendance-using-HiMama)
14. **Dense tables, small grey text, warning banners instead of guided fixes.** (seen in app, 2026-11-16 scan)

---

## Not verified / still to do once the user signs in again

- Today's KG1 Enrolled-tab count, its Graduated tab since 2026-11-16, and KG1's Desired Capacity value (question A).
- Markham's centre id, rooms and settings.
- Exact dropdown options in each entry form (health observations, mood terms, toilet options, supply types, meal list, absence reasons, fluid types). Open Classroom Actions → Add Entry → each type, then Cancel.
- Contacts page columns and the Billing dashboard layout at Newstead.
- The list of reports actually shown on Newstead's Reports page (the help centre lists more than may be enabled).
- The network endpoint inventory (`read_network_requests`, paths and methods only).
- Whether "classroom access" (teachers seeing other rooms) is turned on at Newstead.
