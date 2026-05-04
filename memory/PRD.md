# Boost Growth Staff Portal — PRD

## Original Problem Statement
ABA therapy center staff portal — replace existing Claude/Base44-built portal with a more professional, practical version. Brand colors from boost-growthsa.com (sage / cream / gold).

## Architecture
- Backend: FastAPI + MongoDB + JWT (PyJWT) + bcrypt
- Frontend: React 19 + React Router 7 + Tailwind 3 + Phosphor Icons + Axios
- Auth: admin (email+password) + therapist (PIN keypad)
- Data seeded from Base44 source (THERAPISTS_LIST, CLIENTS_LIST, CLIENT_DETAILS, SC_COLORS)

## What's Been Implemented (May 2026)

### v1 — initial MVP
- ✅ Auth (admin + therapist PIN), JWT cookie + Bearer fallback
- ✅ Schedule, Attendance (file upload), Clients basic, Intake, Requests, Directory, Resources, Admin

### v2 — English + Top Nav
- ✅ Full English UI (LTR), DM Sans + Playfair Display fonts
- ✅ Top navigation sticky with notification bell, mobile drawer
- ✅ Schedule per-therapist blocks (5 days × 10 times), 9 service codes, cell states (normal / cancel_therapist 🩷 / cancel_child 🟡)
- ✅ Right-click context menu, zoom 70-140%, print
- ✅ Requests redesigned: 3-step wizard (Type → Details → Review), reward types, timeline of events
- ✅ Seed: 13 therapists (PIN=0000) + initial 21 clients

### v3 — Base44 Parity
- ✅ Fixed schedule click bug (e.stopPropagation in handler)
- ✅ Schedule view toggle: "Per Therapist" blocks vs "All Therapists" master grid (with day tabs)
- ✅ Per-child color in schedule cells (CHILD_COLORS map matching Base44 SC_COLORS)
- ✅ Attendance rebuilt Base44-style:
  - Log Session form: Status grid (Completed/No Service/Cancelled/No Show), date+start+end (auto-compute hours), multi-select therapists, location dropdown (from client.locations)
  - Client cards with progress bar, Pkg/Used/Remaining, status (🔴 urgent / 🟡 warning / 🟢 ok)
  - Filter pills, search by name/file#
  - History modal as invoice sheet with paginated sessions, edit/delete inline
- ✅ Clients: full info — file_no, color stripe, supervisor, main + co therapists, multi-locations (HS/SS pills), package hours
- ✅ Intake hidden from therapists (admin-only nav + 403 server-side)
- ✅ Re-seeded: 13 therapists + 20 clients with FULL info from Base44 source (file_no, locations, color, main+co)
- ✅ Backend Session model + CRUD endpoints with therapist-filter

### Test Status
- v3 backend: 28/28 pytest pass (100%)
- Frontend admin flows: ~92% verified visually (Schedule toggle, Attendance cards/Log Session, Clients full info, Intake admin-gate)

## Test Credentials
- Admin: `admin@boost-growthsa.com` / `BoostAdmin@2026`
- 13 therapists: PIN `0000`

## Backlog — Prioritized

### P1 (next session)
- SendGrid/Resend email notifications (user said "بعدين أشترك")
- Pre-fill schedule with the historical data from Base44 (SCHED_DATA — 17 weeks Jan-Apr 2026)
- Excel/PDF export of attendance invoice from History modal (currently displays only)
- Excel import for bulk clients/intake upload
- Drag-drop schedule cells across slots
- Cell merging in schedule (admin requested in original message)

### P2
- Reports dashboard (sessions per therapist, cancellation %, attendance %)
- Bulk "copy entire week" for schedule
- Excel preview rendering in sheet viewer
- Therapist-of-the-month widget
- Mobile PWA + push notifications
- Parent-portal share link

### P3 (security/hardening)
- Brute-force lockout on auth endpoints (5 fails)
- Tighten CORS to explicit origins (instead of *)
- Add session-creation guard for therapists (must be assigned to client)
- Role-based privacy on Schedule master-view (therapists currently see other therapists' notes — review with user)

## Tech Notes
- Time slots: '8:00 AM - 9:00 AM' format (10 slots)
- Days: Sunday → Thursday (5 working days, index 0-4)
- Auto re-seed when therapist count or client count mismatches expected
- File uploads: /app/backend/uploads/{sid}{ext}
- MongoDB indexes: users.email (unique), therapists.id, schedule_cells (week_start, therapist_id), notifications.user_id, sessions (client_id, session_date desc)
