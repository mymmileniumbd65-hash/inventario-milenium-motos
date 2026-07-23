<!-- Generated: 2026-07-22 | Files scanned: 41 (src/**/*.ts, *.tsx) | Token estimate: ~550 -->

# Architecture

Single Next.js App Router app (TypeScript), no separate backend service.

```
Browser
  │  cookies (Supabase session)
  ▼
src/proxy.ts (Next.js "proxy"/middleware convention)
  │  refreshes session via src/lib/supabase/middleware.ts
  │  redirects ANY unauthenticated request (incl. /api/*) → /login
  ▼
App Router pages (src/app/**) ── server-rendered, read via src/db/queries.ts
  │
  ├─ Server Actions (src/app/(app)/inventario/{actions,partActions,movementActions}.ts)
  │     → Drizzle ORM (src/db/client.ts, pg) → Postgres (Supabase), role `postgres` (BYPASSRLS)
  │
  └─ src/lib/inventory.ts — pure business-logic module (stock/status/rotation/
        alerts/KPIs), no I/O, fed by queries.ts, unit-tested in inventory.test.ts
```

## Deployment

- Vercel project `milenium-motos/milenium-inventario-repuestos`, Git-linked to
  `mymmileniumbd65-hash/inventario-milenium-motos`. Push to `master` → Production
  auto-deploy. `vercel.json` `ignoreCommand` skips builds for every other branch
  (Preview deployments are intentionally disabled).
- Database: Supabase Postgres. App connects via pooled `DATABASE_URL`
  (`drizzle-orm/node-postgres`), TLS pinned to Supabase's root CA
  (`src/db/supabase-ca.ts`). RLS is enabled on `groups`/`parts`/`movements`
  (declared in `schema.ts` via `.enableRLS()`) but irrelevant to the app itself,
  since it never uses PostgREST/anon or authenticated Supabase roles for data.
- Auth: Supabase Auth (session cookies via `@supabase/ssr`), not a local table.

## Key architectural notes

- Movements are an **immutable ledger** — never edited/deleted. `reverseMovement`
  inserts a compensating `ajuste` row (see `data.md`).
- `'use server'` action files cannot be invoked from a standalone script — both
  `cookies()` and `revalidatePath()` require a real Next.js request cycle.
- No CSS framework; inline `style` objects throughout, matching the original
  prototype (`prototype-extract/`, reference-only, not runnable).

## See also

- `backend.md` — routes, server actions, data-access mapping
- `frontend.md` — page tree and component hierarchy
- `data.md` — schema, movement ledger semantics, migrations
- `dependencies.md` — external services and third-party packages
