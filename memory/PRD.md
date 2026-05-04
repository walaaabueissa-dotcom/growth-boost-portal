# Boost Growth Staff Portal — PRD

## Original Problem Statement
User has an existing portal at https://boostgrowth-portal.netlify.app (built with Claude/Base44) and wants a more professional, practical version. Brand colors from boost-growthsa.com — sage green / cream / mustard. Built from scratch in Emergent.

User then requested (iteration 2):
- Switch entire UI to English (LTR)
- Top navigation instead of sidebar
- Schedule layout matching specific Google Sheets (per-therapist blocks with 5 day rows × 10 time columns)
- Pink (Therapist Cancellation) & Yellow (Client Cancellation) states with right-click toggle
- Fancy multi-step Requests form with type / date range / reward type / priority / notes / timeline
- Default PIN 0000 for all therapists
- Real seed data (15 therapists, 21 clients from the actual schedule sheet)

## Architecture
- Backend: FastAPI + MongoDB + Motor + JWT (PyJWT) + bcrypt
- Frontend: React 19 + React Router 7 + Tailwind 3 + Phosphor Icons + Axios
- Auth: dual mode — admin (email+password) and therapist (PIN keypad)
- Notifications: in-app DB-backed; polled every 30s; bell with unread badge

## Implemented (May 2026)
- ✅ Auth (admin + therapist PIN) with JWT in cookie + Authorization Bearer fallback
- ✅ Top navigation shell (English, LTR) with notification bell
- ✅ Home dashboard with hero banner + 4 stat tiles + quick links
- ✅ Schedule: per-therapist blocks, 5 days × 10 times, click-to-add cell modal, right-click context menu (edit/duplicate/cancel-states/notify/delete), zoom 70-140%, print
- ✅ Service codes: SS / HS / OS / Meeting / Supervision / Observation / AVC / Leave / Break
- ✅ Cell states: normal / cancel_therapist (pink) / cancel_child (yellow) with auto-notification
- ✅ Attendance: per-client invoice-style sheet viewer with multi-page Excel upload + prev/next navigation + Gregorian dates + searchable therapist dropdown
- ✅ Clients: CRUD with service_type field, parent info, therapist assignment
- ✅ Intake: Pre/Post tabs with status workflow, intake date, age
- ✅ Requests: 3-step wizard (type → details → review) with date ranges, reward types, priorities, timeline of events, admin status updates with auto-notification
- ✅ Directory: contacts CRUD
- ✅ Resources: Drive folder cards
- ✅ Admin panel: therapist CRUD with color picker + PIN reset
- ✅ Seeded data: 1 admin + 15 therapists (PIN=0000) + 21 clients
- ✅ Animations: stagger entrance, page-fade transitions, hover lifts, modal pop-in
- ✅ Tested: 22/22 backend pytest pass, frontend ~95% (all primary flows verified)

## Test Credentials
- Admin: `admin@boost-growthsa.com` / `BoostAdmin@2026`
- 15 therapists, all PIN: `0000`

## Backlog (P1 / P2)
- P1: Email notifications via SendGrid/Resend (user will subscribe later)
- P1: Excel import for clients & intake (admin upload CSV)
- P1: Drag-and-drop schedule cells between time slots
- P2: In-line Excel preview rendering inside the sheet viewer
- P2: Bulk schedule operations (copy entire week)
- P2: Reports dashboard (sessions per therapist, attendance %, request resolution time)
- P2: Mobile PWA with push notifications
- P2: Parent-portal share link (read-only progress)
- P3: Brute-force lockout / 2FA hardening
- P3: Tighten CORS to explicit origins

## Tech Notes
- MongoDB indexes on users.email (unique), therapists.id, schedule_cells (week_start+therapist_id), notifications.user_id
- File uploads stored at /app/backend/uploads/{sid}{ext}
- Time slots are exact strings "8:00 AM - 9:00 AM" matching the official sheet
