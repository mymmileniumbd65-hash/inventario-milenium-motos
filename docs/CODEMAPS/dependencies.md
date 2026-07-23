<!-- Generated: 2026-07-22 | Files scanned: package.json + vercel.json | Token estimate: ~350 -->

# Dependencies

## External services

- **Supabase** — Postgres (data) + Supabase Auth (session cookies via
  `@supabase/ssr`). One project, no separate staging DB — Vercel Preview
  (when enabled) and Production point at the same live database.
- **Vercel** — hosting/deploy. Git-linked to
  `mymmileniumbd65-hash/inventario-milenium-motos`; `master` → Production
  auto-deploy. `vercel.json` `ignoreCommand` disables builds on all other
  branches (no Preview deployments).

## Runtime dependencies (`package.json`)

```
@supabase/ssr          ^0.12.0   session cookie handling in middleware/server
@supabase/supabase-js  ^2.110.0  Supabase Auth client
drizzle-orm            ^0.45.2   ORM (node-postgres driver)
next                   16.2.9    App Router, "proxy" middleware convention
pg                     ^8.22.0   Postgres driver (direct connection, role postgres)
react / react-dom      19.2.4
```

## Dev dependencies

```
drizzle-kit   ^0.31.10   migration generate/push
vitest        ^4.1.9     unit tests (src/lib/inventory.ts, movementActions, partSearch)
eslint 9 / eslint-config-next
typescript ^5
tsx           ^4.22.4    runs seed.ts with --env-file
@types/*      node, pg, react, react-dom
```

## Overrides

`postcss >=8.5.10` — pinned to close a transitive XSS-in-CSS-stringify vuln
pulled in via `next`. `npm audit --production` is clean as of the last
full audit (2026-07-03).

## Notably absent

No CSS framework, no client data-fetching library (TanStack Query/SWR), no
E2E framework installed yet (Playwright is the documented default per
`rules/typescript/testing.md` but not yet added to `package.json`), no test
mocking library — `vitest` runs pure-function tests directly.

## See also

- `architecture.md` — how these pieces fit together
- `data.md` — schema these ORM/driver packages operate on
