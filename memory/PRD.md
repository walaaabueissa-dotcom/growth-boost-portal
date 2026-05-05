# Boost Growth Staff Portal — PRD

## Original Problem Statement
ABA therapy center staff portal — replace existing Claude/Base44-built portal with a more
professional, practical version. English UI · sage/cream/gold brand · LTR · Top Nav.
Custom dashboards for Admin and Therapist roles.

## Architecture
- Backend: FastAPI + MongoDB + JWT (PyJWT) + bcrypt + openpyxl/pandas
- Frontend: React 19 + React Router 7 + Tailwind 3 + Phosphor Icons + Axios
- Auth: admin (email+password) + therapist (PIN keypad)

## What's Been Implemented

### v1 → v6 (recap)
- Top-nav English LTR, brand logo, login flow, notification bell
- Schedule (Sheet/Per-Therapist/By-Day views) matching Google Sheet layout
- Cell merging (duration), per-child auto colors, right-click context menu
- Cancellation colors (Therapist=Yellow, Client=Pink)
- Attendance (Log Session) + sheet preview, Reports & Analytics
- Real-data seeds: 25 clients, 25 intake records, 5 directory contacts, 5 resources
- Resources role-based split (admin vs therapist), Editable Directory
- Schedule xlsx import, Duplicate Week, Historical loader
- Home KPI fixed (current-week sessions/hours, not cumulative)

### v7 — Feb 2026 (current session) ✅
- **Imported Week 2026-05-10**: 107 schedule cells from user's Google Sheet
  (`'10 May - 14 May'` tab) — exact same colors and content.
- **Vacation/Leaves system (full)**:
  - Backend: `leaves` collection + 6 endpoints (CRUD + `/status` approve flow + `/balance`).
  - Seeded **31 leave records for 2026** from `Vacation schedule.xlsx` ('For 2026' tab).
  - Default annual balance: 30 days/year (overridable per therapist).
  - Therapists submit requests as `pending`; admin approves/rejects → in-app notification fires.
  - New page `/leaves` with admin view (4 stat tiles + 17 balance cards with progress bars
    + filterable leaves table) and therapist view (green hero card showing remaining/used/pending
    + own leaves table).
  - Top-nav link "Leaves" / "My Leaves".
- **Cancel-Notify flow**:
  - New endpoint `POST /api/schedule/cancel-notify` that atomically marks a session as
    cancelled (therapist or client) + sends in-app notification + queues email.
  - Schedule context menu (right-click → "Mark Therapist/Client Cancel") opens new modal
    with "Also send email" checkbox + recipient field (prefilled with therapist email).
  - Confirmation pill explains what will happen.
- **Resend Email Integration (queued)**:
  - Admin page now has "Email Notifications" card with Configured/Not-Configured badge,
    API-key + From-email fields, and a recent-email-activity feed (last 10).
  - When key is missing, emails are queued with status `queued_no_key`. Once Admin pastes
    the Resend API key, emails will actually send (`db.email_queue` gets `sent` or `failed`).
- **Excel export of attendance**:
  - `GET /api/clients/{id}/sessions/export` returns a styled xlsx with totals.
  - "Export Excel" button in Attendance history modal.

### Test Status (v7 — Feb 2026)
- Backend pytest: 13/13 ✅
- Frontend Playwright (admin + therapist): all flows green ✅
- Manual UI verification: Home, Schedule (Sheet/Per/Day), Clients, Intake, Resources,
  Directory, Leaves (admin & therapist), Admin Email Settings — all rendering correctly.

## Test Credentials
See `/app/memory/test_credentials.md`

## Backlog — Prioritized

### P1 (next session)
- Activate Resend (user will subscribe to free 3000 emails/month plan and paste key in Admin).
- Wire WhatsApp/SMS via Twilio if user wants parent-facing notifications.
- Drag-drop schedule cells across slots (cross-day moves).
- Inactive Clients tab + archived view.
- Bulk leave approval (multi-select).

### P2
- Therapist-of-the-month widget on Home (data-driven from Reports).
- Mobile PWA + push notifications.
- Parent-portal share link (read-only weekly schedule + attendance for the parent's child).
- Cancellation-rate analytics per therapist & per client.

### P3 (security/hardening)
- Brute-force lockout on auth endpoints (5 fails / 30 min).
- Tighten CORS to explicit origins.
- Refactor server.py into routers/models/seed (currently ~1300 lines).
- Switch to FastAPI lifespan context (currently `@on_event("startup")`).

## Tech Notes
- Time slots: '8:00 AM - 9:00 AM' format (10 slots, 8am→6pm)
- Days: Sunday → Thursday (5 working days, idx 0-4)
- Auto re-seed via `meta.client_seed_version` (currently v6)
- Leaves seeded only when `db.leaves` empty; admin can edit afterwards
- Email queue: `db.email_queue` documents persisted with status (queued_no_key/sent/failed)
- Resources visibility values: `therapist` / `admin` / `all`
- File uploads: /app/backend/uploads/{id}{ext}

## Files of Reference
- `/app/backend/server.py` (~1320 lines, all endpoints + seeds + startup)
- `/app/backend/leaves_seed.json` (31 leave records for 2026)
- `/app/frontend/src/pages/Leaves.jsx` (NEW)
- `/app/frontend/src/pages/Schedule.jsx` (cancel-notify flow)
- `/app/frontend/src/pages/Admin.jsx` (Email Settings card)
- `/app/frontend/src/pages/Attendance.jsx` (Excel export button)
- `/app/frontend/src/pages/Resources.jsx` (role-grouped CRUD)
- `/app/frontend/src/pages/Directory.jsx` (editable cards)
- `/app/frontend/src/pages/Intake.jsx` (priority + extended fields)
- `/app/frontend/src/pages/Home.jsx` (weekly KPIs)
- `/app/frontend/src/pages/Shell.jsx` (Leaves nav)
