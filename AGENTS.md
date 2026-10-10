# Serial Pro — Agent Guide

Read this guide before changing application code. Use [README.md](./README.md) for the full
feature description, setup, deployment, and role matrix; this file maps those concepts to the code
and highlights invariants that are easy to break.

## Project at a glance

- Mobile-first clinic serial and appointment management app.
- Next.js App Router, React, TypeScript, Tailwind CSS 4, Drizzle ORM, PostgreSQL.
- Production database: Neon/PostgreSQL. Local development and tests use PGlite.
- The interface is in English; patient messages support the configured SMS template variables and
  Bengali date/serial values.

## Where to make changes

| Area | Main files |
| --- | --- |
| Routes and page composition | `src/app/` |
| Authenticated layout and navigation | `src/app/(app)/layout.tsx`, `src/components/shell/` |
| Server actions and mutation entry points | `src/app/actions/` |
| Serial business rules, scoped queries, and counters | `src/lib/serials.ts` |
| Authentication, session, and role access | `src/lib/auth.ts`, `src/lib/rbac.ts` |
| Reports | `src/lib/reports.ts`, `src/components/reports/` |
| SMS/WhatsApp message rendering and links | `src/lib/sms.ts`, `src/components/serials/` |
| Shared database schema | `src/db/schema.ts` |
| Database migrations | `src/db/migrations/` |
| Shared UI and theme primitives | `src/components/ui/`, `src/app/globals.css` |
| Tests and in-memory fixtures | `tests/` |

Pages are server components by default. Put interactive behavior in focused client components and
keep persistence and permission checks on the server. Server actions live under `src/app/actions/`;
reusable business rules belong in `src/lib/`.

## Domain rules — preserve these

- Serial allocation is server-side and concurrency-safe. Sequences are separate by clinic, doctor,
  date, and patient type (`new`/`old`). Do not accept a client-supplied next serial number.
- Reference entries have no serial number and never consume one. Keep their green visual treatment
  consistent across serial cards, badges, reports, and summary accents.
- Appointment statuses are `active`, `cancelled`, and `completed`. Cancelled and completed entries
  remain in history; their serial numbers are never reused. Cancelled serials appear after the
  other entries on the serial list.
- Only active entries can be edited, cancelled, completed, have their serial number changed, or be
  reordered. Enforce this in the business layer as well as hiding unavailable UI controls.
- Every sensitive mutation should write an audit record in the same database transaction.
- Dates use the clinic timezone (default `Asia/Dhaka`).

## Security and data boundaries

- Treat all client input as untrusted. Validate mutations with schemas in `src/lib/validation.ts`.
- Check role, clinic scope, and assigned-doctor scope server-side. Client-side visibility is not
  authorization; follow `src/lib/rbac.ts` and existing actor-scoped service patterns.
- Keep super-admin views free of patient names, phone numbers, and other patient-level data.
- Never read, print, copy, or commit secrets from `.env.local` or production data. Use fictional
  fixtures in tests.
- Use parameterized Drizzle queries; avoid raw SQL unless necessary for existing transaction or
  concurrency patterns.

## Database changes

- Keep `src/db/schema.ts` and SQL migrations in `src/db/migrations/` synchronized.
- Add a new, lexically numbered migration for schema changes; do not edit an already applied
  migration. Separate statements with `--> statement-breakpoint` when a migration has multiple
  statements.
- The migration runner applies each file transactionally and records its filename. Production
  migrations are run explicitly with `npm run db:migrate`; PGlite development/tests apply them
  automatically.
- If a migration changes a database enum, update the Drizzle enum definition and validate the
  migration against the test database.
- PGlite data is local-only. Only one process can open the same PGlite directory at a time; stop
  the dev server before running seed or migration commands against that directory.

## UI and implementation conventions

- Preserve the clean, compact, touch-friendly mobile layout and existing teal/healthcare theme.
- Use the existing shared UI components, icons, Tailwind utilities, validation, and error patterns
  before introducing new abstractions or dependencies.
- Keep list rows compact; put secondary details and actions in the existing expandable area.
- Surface mutation failures to the user; do not silently swallow errors or report success when a
  database operation failed.
- Update relevant tests and README documentation when behavior or setup changes.

## Verification

Use the smallest relevant checks, then expand as needed:

```sh
npx vitest run tests/<relevant-test>.test.ts
npm run typecheck
npm run lint
npm run build
npm test
```

`npm test` runs the test files in separate processes. On memory-constrained machines, stop the
development server before running the full suite. Do not claim a check passed unless it was run.
