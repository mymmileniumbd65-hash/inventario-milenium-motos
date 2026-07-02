# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state of this repository

Next.js has been scaffolded and the project is being built task-by-task from the implementation plan (Tasks 1-17 of 18 complete as of this writing; only Task 18 — Vercel deploy — remains). All core pages are live and protected behind Supabase Auth login: dashboard (`/`), Inventario (CRUD + movement registration + drawer), Alertas, Movimientos, Reportes. Task 17's end-to-end smoke test passed every business-logic assertion (verified via curl/API techniques, no browser available in this sandbox — see the note above and `.superpowers/sdd/progress.md`).

**Task 18 is paused pending the user's own manual browser test.** No Claude session in this project has had access to a real browser — all UI verification so far has been via `curl`/API-level checks (see the note below). The user asked to run `npm run dev` and click through the app themselves in a real browser before approving the Vercel deploy. **Do not proceed with Task 18 (git remote/push, Vercel import, env vars, or deploy) until the user gives explicit approval after their manual test.** Login: `admin@mileniummotos.pe` / `***REDACTED***`. Note: a leftover "Amortiguadores" group with a test part `AMO-TEST` (2 movements) exists from Task 17's smoke test — it can't be deleted through the app by design (integrity guards), this is expected.

Do not freehand new features from the spec alone — continue executing the plan below, task by task, via `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

- `docs/superpowers/specs/2026-06-30-inventario-repuestos-design.md` — the approved spec: what the app does, its scope, data model, and business rules.
- `docs/superpowers/plans/2026-06-30-inventario-repuestos.md` — the approved, task-by-task implementation plan (file paths, exact code, commands, commit points). This is the source of truth for *how* to build the rest of the app.
- `.superpowers/sdd/progress.md` — the execution ledger: which tasks are complete, their commit ranges, and every Minor finding deferred from task reviews (read this before resuming work — it lists what the final whole-branch review still needs to triage).
- `docs/FLUJO-DE-TRABAJO.md` — operational workflow (in Spanish): how a warehouse user works the app day-to-day (groups → parts → movements → alerts → reports) and the business rules the system enforces.
- `docs/FLUJO-DESARROLLO.md` — development workflow (in Spanish): environment setup, commands, repo map, the SDD task-by-task process, the browserless verification pattern, git conventions, the post-audit security checklist, and Vercel deploy.
- `prototype-extract/` — a Claude Design export of the original UI prototype (reference only, not runnable code — uses a proprietary `<x-dc>`/`sc-if`/`sc-for` DSL). Use it only to confirm exact colors, copy, layout, and the original business-logic formulas already translated into `src/lib/inventory.ts`.
- `prototype-extract/screenshots/` show a different, out-of-scope design (motorcycle-unit tracking) — not part of this app, see the spec's "Contexto" section.

## Commands

- `npm run dev` — start the dev server (Turbopack).
- `npm run build` — production build.
- `npm run lint` — ESLint.
- `npm test` — run the Vitest suite once (`src/lib/inventory.ts` and its business-logic tests live here; more test files land as later tasks add them).
- `npx vitest run <path>` — run a single test file.
- `npm run db:generate` — generate a Drizzle migration from `src/db/schema.ts` into `drizzle/`.
- `npm run db:push` — push the schema to the database (uses `DIRECT_DATABASE_URL`).
- `npm run db:seed` — run `src/db/seed.ts` (sample catalog + admin account). **Not safely re-runnable**: `groups.name`/`parts.sku` are unique, so a second run fails on the first insert rather than duplicating rows — clear the tables first if you need a fresh reseed.

### Environment

Copy `.env.example` to `.env.local` and fill in real Supabase values (Project URL, anon key, service_role key, and the two Postgres connection strings). Two things to know:
- **`DIRECT_DATABASE_URL` here is set to the Transaction pooler string, not a true direct connection.** Supabase's actual direct-connection host (`db.<ref>.supabase.co`) is IPv6-only, which this environment can't reach without the paid IPv4 add-on. The pooler works fine for DDL (verified). If a future Supabase project *does* have IPv4 direct access available, the true direct connection string is preferable for migrations — but don't assume it works without checking.
- `db:seed`'s npm script explicitly passes `--env-file=.env.local` because `tsx`/`drizzle-kit` don't auto-load it the way Next.js does. If you add more standalone DB scripts, they'll need the same treatment (or run them via `node --env-file=.env.local ...`).

## What the app is (per the spec)

A spare-parts inventory system for Milenium Motos: stock tracked by group → SKU, with live-computed stock/status/rotation/alerts (never stored counters — always derived from the `movements` table), a CRUD for groups/parts, movement registration (ingreso/salida/ajuste), and dashboard/alerts/movements/reports views. Single warehouse, single user role, no PO generation yet. Full details, including the exact derived-value formulas, are in the spec.

## Architecture

- Next.js (App Router, TypeScript), to be deployed on Vercel (Task 18).
- Postgres on Supabase; Drizzle ORM (`drizzle-orm/node-postgres` + `pg`) for the app's own tables — `src/db/schema.ts` defines `groups`, `parts`, `movements`. **No local `users` table.**
- **Auth is Supabase Auth**, not a custom table — session cookies via `@supabase/ssr`, refreshed in global middleware (`src/middleware.ts` / `src/lib/supabase/middleware.ts`, Task 7). The middleware redirects *any* unauthenticated request (including `/api/*`) to `/login` before it reaches a route handler — so API routes' own `if (!user) return 401` checks are currently unreachable via a direct unauthenticated request; this is a known, deliberately-deferred architectural note (see `.superpowers/sdd/progress.md`, Task 13). `movements.user_id`/`user_email` reference the Supabase Auth user id/email directly (no FK — `auth.users` lives in Supabase's managed schema, outside this app's migrations).
- All derived business values (stock, status, rotation, alerts, KPIs, purchase suggestions, group/report breakdowns) live in one pure, unit-tested module, `src/lib/inventory.ts` — this is the module with the most business logic and the most test coverage. Keep new derived calculations there rather than scattering them across pages. It has no I/O and no framework imports; the data-access layer (`src/db/queries.ts`, Task 6) is what feeds it real rows.
- No CSS framework — inline `style` objects matching the prototype's own approach, on purpose.
- Server actions live beside the pages that use them under `src/app/(app)/inventario/`: `actions.ts` (groups), `partActions.ts` (parts), `movementActions.ts` (movements, imports the pure `resolveSignedQty` from the sibling `movementLogic.ts` — kept in a separate file with no `'use server'` directive because Next.js requires every export of a `'use server'`-scope file to be async).
- No interactive browser is available in this sandbox for manual UI verification. The established pattern for verifying pages/flows: `npm run dev` in the background, then `curl`-based checks — for fully server-rendered pages (Dashboard, Alertas, Movimientos, Reportes) this is a complete functional test; for pages with client-only modals/forms (Inventario's CRUD modals), curl can only verify the initial server-rendered HTML and the underlying server actions individually — the actual click-through interaction needs a human or a browser-capable agent. Login itself IS curl-verifiable end-to-end by extracting the live `$ACTION_REF`/`$ACTION_KEY` fields from the server-rendered `/login` HTML and POSTing them, since that form is always server-rendered (not conditionally mounted). The same trick works for any *other* server-rendered form on an authenticated page (e.g. the sidebar's "Salir" sign-out form) — extract its action encoding from that page's own HTML rather than assuming login's ids are reusable elsewhere.
- **`'use server'` functions cannot be called directly from a standalone Node/tsx script** — this cost real time to discover (see Task 17 in `.superpowers/sdd/progress.md`) and isn't obvious from the code. Both `cookies()` (used by `createClient()`) and `revalidatePath()` throw `Invariant: static generation store missing` outside a real Next.js request/response cycle. This means *every* action in `src/app/(app)/inventario/{actions,partActions,movementActions}.ts` — not just the ones that read the session — needs a real HTTP request to exercise, even `createGroup`/`createPart` which don't call `createClient()` themselves (they still call `revalidatePath`). If you need to smoke-test these without a browser, build a temporary authenticated API route that calls them server-side and hit it with `curl` + a real session cookie — don't try invoking them directly via `tsx`. (If you do this, don't name the route folder with a leading underscore, e.g. `_test` — Next.js treats `_`-prefixed folders as "private" and excludes them from routing entirely, so the route 404s silently.)
