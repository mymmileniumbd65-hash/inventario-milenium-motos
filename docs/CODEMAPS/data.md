<!-- Generated: 2026-07-22 | Files scanned: 5 (schema.ts, client.ts, queries.ts, drizzle/*) | Token estimate: ~550 -->

# Data

Postgres on Supabase. Drizzle ORM (`drizzle-orm/node-postgres` + `pg`).
Schema source of truth: `src/db/schema.ts`. No local `users` table — auth
users live in Supabase's managed `auth` schema.

## Tables

```
groups
  id            uuid PK, default random
  name          text NOT NULL UNIQUE

parts
  id            uuid PK
  sku           text NOT NULL UNIQUE
  description   text NOT NULL
  compat        text NOT NULL default ''
  group_id      uuid NOT NULL → groups.id
  min_stock     int  NOT NULL default 0
  created_at    timestamptz NOT NULL default now()

movements                                    -- IMMUTABLE LEDGER, never edited/deleted
  id                    uuid PK
  part_id               uuid NOT NULL → parts.id
  type                  enum('ingreso','salida','ajuste')
  qty                   int NOT NULL          -- signed
  from_location         text NOT NULL
  to_location           text NOT NULL
  reference_code        text NOT NULL
  comment               text nullable
  user_id               uuid NOT NULL          -- Supabase auth.users.id, no FK
  user_email            text NOT NULL          -- snapshot at write time
  reverses_movement_id  uuid nullable          -- self-reference, no FK
  created_at            timestamptz NOT NULL default now()

  -- unique partial index: at most one reversal per movement
  UNIQUE (reverses_movement_id) WHERE reverses_movement_id IS NOT NULL
```

All three tables: `.enableRLS()` — RLS is enabled but the app connects as
Postgres role `postgres` (BYPASSRLS via the direct/pooled connection), so this
only matters if a future feature uses the anon/authenticated Supabase client
for data (would need explicit policies first — none exist today).

## Derived values (no stored counters)

Everything is computed on read from `movements`, in `src/lib/inventory.ts`:
stock (`computeStock`), status (`statusOf`), rotation days
(`computeRotationDays` — dynamic window, `min(90, days since earliest
movement)`), alerts (`buildAlerts`), purchase suggestions
(`buildComprasSugeridas`), dashboard/report KPIs.

## Migrations (`drizzle/`)

```
0001_*  movements.reverses_movement_id (nullable, added for reversal feature)
0002_dazzling_praxagora.sql   movements.comment (additive, nullable)
0003_fancy_sentinel.sql       .enableRLS() on all three tables
```

Generated with `npm run db:generate`, applied with `npm run db:push`
(`DIRECT_DATABASE_URL`, actually the Transaction pooler string — true direct
IPv6-only connection isn't reachable from this sandbox).

## Connection & TLS

`src/db/client.ts` — pooled `DATABASE_URL`, cert verified against
`src/db/supabase-ca.ts` (pinned Supabase root CA), not `rejectUnauthorized: false`.

## See also

- `backend.md` — queries.ts read functions, server actions that write these tables
- `architecture.md` — RLS/BYPASSRLS reasoning in full
