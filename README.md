# Serial Pro

A production-ready **patient serial-number management system for clinics** — mobile-first,
entirely in **English**, built with Next.js App Router + TypeScript, Tailwind CSS 4, Drizzle ORM
and PostgreSQL (Neon in production, built-in PGlite for local development).

Attendants create patient serials per doctor per day; reference entries (no serial number) are kept
in a separate list; every doctor's queue can be sent to the patient via the phone's native SMS app.
Everything is enforced server-side with role-based access control and a full audit trail.

---

## Feature overview

| Area | What you get |
| --- | --- |
| Serials | Server-generated, per **clinic + doctor + date + patient type** (new/old) sequences; search by patient name/mobile and clinic-admin up/down queue reordering. Cancelled numbers are **never reused**. Concurrency-safe allocation via a counter table (`INSERT … ON CONFLICT DO UPDATE … RETURNING`). |
| References | Separate **Reference** section above numbered serials, never consume serial numbers. |
| SMS | Separate per-doctor templates for new and old patients, with variables and sample preview. Appointment dates include the weekday; `{{appointment_date_bangla}}` and `{{serial_number_bangla}}` provide Bengali values. Messages open in the phone's native SMS app (`sms:` link). The app **never claims an SMS was sent**, has no gateway integration, and offers copy-to-clipboard fallback. |
| PWA | Installable from supported browsers with app icons and standalone display. Patient and clinic data are not cached for offline access. |
| Reports | 6 print-friendly reports (date-wise, new patient, old patient, doctor-wise, cancellation, daily summary) with date/doctor/type/status filters. **No CSV export** (spec). |
| RBAC | `super_admin` (clinic operations only — never patient data), `clinic_admin` (own clinic), `attendant` (assigned doctors only). Doctor login is deferred but the schema is ready. |
| Security | bcrypt passwords, DB-backed sessions with expiry + secure cookies, login rate limiting, normalized mobile numbers, IDOR-safe queries, audit log of all sensitive actions. |

---

## Quick start (local)

Requirements: **Node.js ≥ 20**, npm.

```bash
npm install --legacy-peer-deps
cp .env.example .env.local        # optional — works with zero config (local PGlite)
npm run db:migrate                # create schema (safe to run again — IF NOT EXISTS)
npm run db:seed                   # optional fictional demo data (no real patient data)
npm run superadmin                # create the first super admin (interactive, no default password)
npm run dev                       # http://localhost:3000
```

> No `DATABASE_URL`? The app uses a **built-in PGlite dev database** (file-persisted in
> `.pglite-data/`, zero setup). It is for development/demos only — set `DATABASE_URL` for real
> deployments. One PGlite directory can only be opened by one process at a time: **stop `npm run dev`
> before `npm run db:seed` / `npm run db:migrate`**, and vice versa.

On supported browsers, use the browser's **Install app** option to install Serial Pro.
Patient and clinic data requires a live connection and is not cached for offline use.

### Demo credentials (`npm run db:seed`)

All names/numbers are fictional (Rahim, Karim, …; 01711111111-style numbers):

| Username | Password | Role |
| --- | --- | --- |
| `super` | `SuperAdmin123!` | super_admin |
| `admin` | `Admin12345!` | clinic_admin (Demo Medical Centre) |
| `attendant` | `Attendant123!` | attendant (Dr. Kamal Uddin + Dr. Fatema Akter) |
| `attendant2` | `Attendant123!` | attendant (only Dr. Fatema Akter) |
| `admin2` | `Admin12345!` | clinic_admin (second demo clinic, incl. Dr. Selim Mia) |

The seed also creates today's demo serials (new/old sequences, one cancelled patient, one reference)
so the UI and reports have data immediately. **Change or remove these users before any real use.**

---

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js + TypeScript rules, flat config) |
| `npm test` | 31 tests: serial allocation (incl. concurrency), SMS templates, authz, mobile normalization |
| `npm run db:migrate` | Apply SQL migrations (idempotent) |
| `npm run db:seed` | Fictional demo data |
| `npm run superadmin` | Create the first super admin securely (interactive or via `SUPER_ADMIN_*` env) |

Tests run each file in its own process (`scripts/run-tests.mjs`) to stay within small memory
budgets. On a ≈2 GB machine stop `npm run dev` first — Next.js + the test DB otherwise exceed RAM.

---

## Production deployment (Neon + Vercel)

1. **Create a Neon project** and copy the **pooled** connection string (`-pooler` host).
2. **Run migrations** against it (from your machine or CI):
   ```bash
   DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require" npm run db:migrate
   ```
   Migrations are plain SQL in `src/db/migrations/` and idempotent.
3. **Create the first super admin** against the production DB:
   ```bash
   DATABASE_URL="postgresql://…" npm run superadmin
   ```
   There is deliberately **no default super-admin password** — use this command once.
4. **Deploy to Vercel** (framework preset: Next.js):
   - Env vars: `DATABASE_URL` (pooled URL), optional `SESSION_TTL_HOURS`, `COOKIE_SECURE=true`.
   - Sessions live in the database (no filesystem/shared memory), so the app is serverless-safe.
   - `build` script runs `tsc` type-check + Turbopack build.
5. Log in as the super admin → create clinics. Each clinic creation shows the generated clinic-admin
   username + one-time temporary password (also shown once at creation for attendants).

Security defaults: bcrypt password hashing, `httpOnly`+`SameSite=Lax` cookies (`Secure` in
production), 7-day session expiry with sliding renewal, in-memory login rate limiting (per
username+IP), parameterized SQL everywhere, safe generic errors, `audit_logs` for every sensitive
action.

---

## Serial rules (the core logic)

- Serial numbers are allocated **server-side only** in `src/lib/serials.ts` — client input can never
  set the next number.
- Separate sequences per **clinic + doctor + date + patient type** (`new`/`old`): new-patient 1 and
  old-patient 1 can both exist for the same doctor/date.
- **References have no serial number** and never consume one; they render in their own
  **Reference** section above the numbered list.
- **Cancelled serials are never reused** — the appointment keeps its number in history and the
  counter simply moves on.
- Concurrency-safe: the allocation counter is updated with
  `INSERT … ON CONFLICT (clinic, doctor, date, type) DO UPDATE SET value = value + 1 RETURNING`
  inside the appointment transaction (tested with concurrent allocations).
- Manual serial-number changes require a valid positive integer, are atomic, validate uniqueness and
  leave an audit-log entry (`change_serial_number`).
- Dates default to the clinic timezone (default `Asia/Dhaka`).

## SMS behavior (important)

- Templates are **per doctor**, stored in the database, with a clinic-wide default. Variables:
  `{{patient_name}}`, `{{patient_mobile}}`, `{{patient_address}}`, `{{patient_type}}`,
  `{{serial_number}}`, `{{appointment_date}}`, `{{doctor_name}}`, `{{clinic_name}}`,
  `{{reference_details}}`. Unknown variables are shown as plain text in the preview; empty optional
  values render as a friendly "Not applicable".
- "Send SMS" opens the device's **native SMS app** with the rendered message via a URL-encoded
  `sms:` link. The UI always states that the user must press Send in their SMS app — **the app never
  claims an SMS was sent** and never pretends one was delivered. If `sms:` is unsupported (desktop),
  the message is copied to the clipboard with a hint to paste it into an SMS app.
- The SMS dialog never opens automatically after editing; no SMS is triggered on cancellation.

## Reports

`/reports?report=datewise|new|old|doctor|cancellation|summary` with `date/from/to/doctorId/
patientType/status` filters. Mobile card layout, desktop table layout, print stylesheet
(`window.print()`), empty states. Spec explicitly excludes CSV export.

## RBAC matrix

| Route / action | super_admin | clinic_admin | attendant |
| --- | --- | --- | --- |
| Login | ✓ | ✓ | ✓ |
| `/serials` (assigned doctors) | ✗ | ✓ (clinic doctors) | ✓ (assigned only) |
| `/serials/new`, create/edit/cancel serials | ✗ | ✓ | ✓ (assigned only) |
| `/reports` | ✗ | ✓ (clinic) | ✓ (own scope) |
| `/settings`, `/settings/password` | ✓ (own) | ✓ | ✓ (own) |
| `/settings/sms-templates` (spec §8: "only for authorized roles") | ✗ (no clinic scope) | ✓ | ✗ |
| `/clinic`, doctors, users, clinic settings | ✗ | ✓ (own clinic) | ✗ |
| `/super-admin`, clinics, clinic status/password reset | ✓ | ✗ | ✗ |

All checks run server-side in `src/lib/rbac.ts` + server actions with clinic scoping on every query
(cross-clinic and unassigned-doctor access return 404-style not-found, covered by tests).

## Project structure

```
src/
  app/                 # App Router routes (all server-enforced)
    actions/           # "use server" actions (auth, serials, clinics, doctors, staff)
    (app)/             # authenticated shell (side nav / mobile bottom nav)
  components/          # UI (serials, reports, admin forms, settings, shell)
  db/                  # Drizzle schema + SQL migrations + migrate.ts
  lib/                 # auth, rbac, serials, sms, reports, validation, audit…
scripts/               # migrate, seed, create-super-admin, make-session (dev only)
tests/                 # vitest suites (allocation/concurrency, sms, authz, mobile)
```

## Honest notes & limitations

- **No SMS gateway** — by design. The hand-off to the native `sms:` link is the delivery mechanism.
- **Doctor login is deferred** (schema `users.role` supports `doctor`); doctors are managed by
  clinic admins but cannot log in yet.
- Login rate limiting is **per-process** (in-memory). For multi-instance production deployments put
  a shared limiter (e.g. Upstash) in front — noted in `src/lib/rate-limit.ts`.
- `.pglite-data/` is a dev-only database; it is git-ignored and must not be used in production.
- Super-admin pages intentionally show **no patient names or mobile numbers** — only operational
  counts (clinic/doctor/user stats).
- The UI is fully in English. The clinic timezone still defaults to `Asia/Dhaka`.
