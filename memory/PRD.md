# Boost Growth Staff Portal — PRD

## Original Problem Statement
ABA therapy center staff portal — replace existing Claude/Base44-built portal with a more
professional, practical version. English UI · sage/cream/gold brand · LTR · Top Nav.
Custom dashboards for Admin and Therapist roles.

## Architecture
- Backend: FastAPI + MongoDB + JWT (PyJWT) + bcrypt
- Frontend: React 19 + React Router 7 + Tailwind 3 + Phosphor Icons + Axios
- Auth: admin (email+password) + therapist (PIN keypad)
- Real data sourced from `Clients' Info.xlsx`, `Waiting_List_v4.xlsx`,
  `Therapists' Schedule.xlsx`

## What's Been Implemented

### v1 → v4 (recap)
- Auth, Schedule, Attendance, Clients, Intake, Requests, Directory, Resources, Admin
- Top nav, English LTR, Notification bell, mobile drawer
- Cell merging (duration), per-child auto colors, right-click context menu, zoom, print
- Reports & Analytics dashboard
- Clients/Intake CSV import, Historical schedule loader
- Cancellation colors (Therapist=Yellow, Client=Pink)
- Brand logo integrated in Login + Home + Top nav + Attendance Sheet
- Schedule xlsx import (4748 cells), Duplicate Week, Sheet Preview

### v6 — Feb 2026 (current session) ✅
- **Real client data seeded**: 25 unique clients parsed from `Clients' Info.xlsx`,
  with accurate **multi-service multi-location** data (e.g., Saleh #009 = SS + 2× HS,
  Salman #038 = SS + HS, Abdulrahman #068 = HS + SS).
- **2 new therapists**: Ms. Asma, Ms. Jenan (real coverage from spreadsheet).
- **Real intake data**: 25 records (12 Pre-Intake + 13 Post-Intake) seeded from
  `Waiting_List_v4.xlsx` with new fields: service, district, age, time_pref/language,
  diagnosis, priority.
- **Schedule "Sheet" view (default)** matching the Google Sheets layout exactly:
  `# | Therapist (rowSpan=5) | Day | 10 time-slot columns`. Plus existing Per-Therapist
  and By-Day views as alternatives.
- **Resources page** rebuilt: backend `resources` collection with visibility filter
  (therapist / admin / all). Admin sees grouped sections; therapists see only filtered
  resources. Full admin CRUD.
- **Directory editable**: PUT endpoint added; cards have edit pencil + role badges.
  Seeded 5 internal contacts (Genan, Boost Growth, Walaa, Maha, Fahdah).
- **Home KPI fixed**: Shows current-week scheduled hours/sessions instead of
  cumulative schedule cells.
- Backend tests: 17/17 pytest passing.

### Test Status (Feb 2026)
- Backend: 17/17 pytest pass (100%)
- Frontend: All 7 admin flows verified via Playwright self-test (Home, Schedule
  Sheet/Per-Therapist/By-Day, Clients, Intake, Resources grouped, Directory)

## Test Credentials
See `/app/memory/test_credentials.md`

## Backlog — Prioritized

### P1 (next session)
- SendGrid/Resend email notifications (user said "بعدين أشترك" — defer)
- WhatsApp via Twilio (user requested for a future iteration)
- Excel/PDF export of attendance invoice (currently print-only)
- Drag-drop schedule cells across slots
- Pre-fill schedule with historical data from Base44 (SCHED_DATA — 17 weeks Jan-Apr 2026)
- Therapist resources Drive link — verify exact URL with user
- Clients: editable package_hours per child (currently default 24)
- Inactive Clients tab + archived view

### P2
- Therapist-of-the-month widget
- Mobile PWA + push notifications
- Parent-portal share link
- Sessions per therapist analytics, cancellation %

### P3 (security/hardening)
- Brute-force lockout on auth endpoints (5 fails)
- Tighten CORS to explicit origins
- Refactor server.py into routers/models/seed (currently 1198 lines)
- Switch from `@app.on_event("startup")` to FastAPI lifespan context

## Tech Notes
- Time slots: '8:00 AM - 9:00 AM' format (10 slots, 8am→6pm)
- Days: Sunday → Thursday (5 working days, index 0-4)
- Auto re-seed via meta version bump (`client_seed_version=6`)
- File uploads: /app/backend/uploads/{sid}{ext}
- MongoDB indexes: users.email (unique), therapists.id, schedule_cells (week_start,
  therapist_id), notifications.user_id, sessions (client_id, session_date desc)
- Resources visibility: `therapist` | `admin` | `all`
