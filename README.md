# Lecture Attendance System

A web-based lecture attendance system where lecturers display a rotating QR code at the start of class, and students scan it with their phones to mark themselves present. Built as a final-year undergraduate project.

---

## Stack

| Layer        | Choice                                | Why                                                                 |
|--------------|---------------------------------------|---------------------------------------------------------------------|
| Framework    | Next.js 15 (App Router) + TypeScript  | Single codebase for UI + API; server components keep state simple.  |
| Database     | SQLite via Prisma ORM                 | Zero setup, file-inspectable for the demo; swap to Postgres later.  |
| Auth         | Auth.js v5 (NextAuth) — credentials   | JWT sessions, role baked into the token; no OAuth dependency.       |
| QR rendering | `qrcode` (server-side data URL)       | Standard library; no canvas hacks.                                  |
| QR scanning  | `html5-qrcode` (browser camera)       | No native app required — works on any modern phone browser.         |
| Token sign   | `jose` (HS256 JWT)                    | Audited library; per-session secret stops cross-session replay.     |
| Styling      | Tailwind CSS                          | Utility-first; minimal CSS files to defend.                         |

---

## Roles

- **Admin** — manages users (lecturers & students), creates courses, assigns lecturers, enrolls students.
- **Lecturer** — views their own courses, starts a class session, shows the live-rotating QR on a projector, sees who's present in real time, exports the attendance list as CSV.
- **Student** — sees their enrolled courses with attendance percentage, scans the lecturer's QR with their phone camera, views their session-by-session history.

Each role has its own URL prefix (`/admin`, `/lecturer`, `/student`) and middleware enforces that only the right role can hit each prefix.

---

## Setup

Prerequisites: **Node.js 18+** and **npm**.

```bash
# 1. Install dependencies (runs `prisma generate` automatically via postinstall)
npm install

# 2. Create the SQLite database and apply the schema
npm run db:push

# 3. Seed demo users, courses, and enrollments
npm run db:seed

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000>.

### Demo credentials (password for every account: `password123`)

| Role     | Email                          | Notes                          |
|----------|--------------------------------|--------------------------------|
| Admin    | `admin@uni.edu`                | Full system access             |
| Lecturer | `adebayo@uni.edu`              | Teaches CSC401, CSC403          |
| Lecturer | `ibrahim@uni.edu`              | Teaches CSC411                  |
| Student  | `csc.2021.001@uni.edu`         | Chinonso Eze                    |
| Student  | `csc.2021.002@uni.edu`         | Fatima Bello                    |
| Student  | …through `csc.2021.006@uni.edu`| Six students total              |

### Useful scripts

- `npm run dev` — start dev server on `http://localhost:3000`
- `npm run dev:https` — same but with HTTPS, needed for phone-camera scanning over LAN
- `npm run db:studio` — open Prisma Studio (browse DB in a web UI)
- `npm run db:reset` — wipe DB and reseed

---

## Demo flow (for viva)

1. Sign in as a **lecturer** (e.g. `adebayo@uni.edu`).
2. Open a course (e.g. CSC401) and click **Start new session**. The rotating QR appears on screen.
3. On a phone (connected to the same Wi-Fi as the laptop):
   - Open the laptop's LAN address in the browser (e.g. `https://192.168.1.10:3000`).
   - Sign in as a **student** (e.g. `csc.2021.001@uni.edu`).
   - Open **Scan QR**, allow camera, point at the lecturer's screen.
4. The student sees "Marked present" within a second. The lecturer's screen adds the student to the live list (within ~3 seconds, the polling interval).
5. End the session from the lecturer screen. Show CSV export. Show the student now sees this session marked "Present" in their history.

**Demonstrate the anti-spoof story:**
- Show that scanning the same QR twice returns "Already marked present" — the DB unique constraint kicked in.
- Sign in as a *different* student who is **not enrolled** in the course, try to scan: "You are not enrolled in this course."
- Take a screenshot of the QR, wait ~15 seconds, try to scan the screenshot: "That code has expired."

---

## Architecture — what to say in the viva

### Why server-rendered (Next.js App Router) and not a separate SPA + REST API?

A single Next.js application has fewer moving parts to reason about — there's no client/server state synchronization problem because pages are rendered on the server with fresh DB data. Where interactivity is genuinely needed (the live QR display, the camera scanner), I use small client components. This keeps the codebase small enough to be defensible end-to-end.

### Why per-session secrets for the QR token signing?

Tokens are signed with a 256-bit random secret stored on the `Session` row (`Session.secret`). This means:
- A leaked or replayed token from session A cannot be verified against session B's secret.
- When the lecturer ends a session, no revocation list is needed — the `active=false` check in the attendance endpoint rejects further marks without any cryptographic bookkeeping.

### Why polling and not WebSockets / SSE for the live attendance list?

Polling every 3 seconds is more than sufficient for a feature where 3-second freshness is fine, and it requires no extra infrastructure (no socket server, no Redis pub/sub). The principle here is "match the mechanism to the requirement" — the project doesn't need sub-second updates, so it doesn't pay the complexity cost of supporting them.

### Why SQLite, not Postgres / MySQL?

For a demoable academic project SQLite gives:
- Zero install / config — examiners can clone and run.
- A file (`dev.db`) the examiner can open in any SQLite viewer to inspect data.
- The same SQL semantics for the unique constraints we rely on.

The Prisma schema is database-agnostic; switching to Postgres is a one-line change in `schema.prisma` and `DATABASE_URL`.

### Where the security boundaries live

| Concern                            | Defense                                                        |
|------------------------------------|----------------------------------------------------------------|
| Unauthenticated access             | `src/middleware.ts` redirects to `/login`                      |
| Wrong-role access (student → /admin)| Middleware enforces role-prefix routing                        |
| Forged QR tokens                   | HS256 signature with per-session secret (`src/lib/qr-token.ts`)|
| Expired QR tokens                  | 12-second TTL embedded in JWT, verified by `jose`              |
| Replay / cross-session reuse       | Per-session secret + `active` flag check                       |
| Marking attendance twice           | DB unique constraint `(sessionId, studentId)` on `Attendance`  |
| Marking for someone else           | Attendance endpoint requires authenticated `STUDENT` session   |
| Marking in a course you're not in  | Enrollment check before insert                                 |
| Audit trail                        | `Attendance.ipAddress` recorded for forensic review            |

---

## Data model

```
User (id, email, passwordHash, name, role, matricNumber?, staffId?)
  └─ role ∈ { ADMIN, LECTURER, STUDENT }

Course (id, code, title, lecturerId)
  └─ lecturer ─→ User (1)
  └─ enrollments ─→ many (Enrollment)
  └─ sessions ─→ many (Session)

Enrollment (studentId, courseId)            ← M:N join

Session (id, courseId, secret, startedAt, endedAt, active)
  └─ secret = 256-bit base64url, signs QR tokens for THIS session only

Attendance (id, sessionId, studentId, markedAt, ipAddress)
  └─ UNIQUE(sessionId, studentId)            ← the one-scan-per-session rule
```

---

## Phone-based scanning during a local demo

The browser camera API requires HTTPS (or `localhost`). When a phone connects to the laptop over Wi-Fi, the URL is `http://192.168.x.x:3000`, which **is not** localhost, so the camera will be blocked.

Two ways to fix this for the demo:

1. **Recommended**: `npm run dev:https` — Next.js generates a self-signed cert. On the phone, accept the certificate warning once.
2. Alternatively, route the connection through ngrok (`ngrok http 3000`) and have the phone open the ngrok URL.

Both approaches are documented for the viva; the choice between them is purely practical.

---

## Future work (mention in the report's Future Work section)

- **Geolocation check** — verify the student's GPS coordinates fall within the lecture hall's bounding box before accepting the scan. Caveat: indoor GPS is unreliable; better to use Wi-Fi BSSID matching where deployable.
- **Device fingerprinting** — bind each student account to one device on first login, preventing one phone from being shared between multiple accounts.
- **Push notifications** — alert students when their attendance drops below the institution's minimum threshold (e.g. 75%).
- **Bulk CSV import** — bulk enroll an entire cohort instead of one student at a time.
- **PostgreSQL deployment** — for production scale; trivial swap via `schema.prisma` and `DATABASE_URL`.

---

## Project layout

```
prisma/
  schema.prisma          ← data model
  seed.ts                ← demo dataset
src/
  app/
    page.tsx             ← public landing
    login/page.tsx       ← sign-in form
    admin/...            ← admin pages (server-rendered + server actions)
    lecturer/...         ← lecturer pages incl. live session
    student/...          ← student pages incl. scanner
    api/
      auth/[...nextauth] ← Auth.js handler
      sessions/[id]/
        token            ← GET fresh rotating JWT
        attendees        ← GET live attendance list (polled)
      attendance         ← POST mark attendance (the core endpoint)
  lib/
    db.ts                ← shared Prisma client
    auth.ts              ← Auth.js server config
    qr-token.ts          ← sign / verify rotating JWTs
  middleware.ts          ← route-level role enforcement
  auth.config.ts         ← edge-safe Auth.js config (used by middleware)
  components/
    AppShell.tsx         ← shared top bar / nav for all logged-in pages
```
