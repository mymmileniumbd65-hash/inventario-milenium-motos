<!-- Generated: 2026-07-22 | Files scanned: 18 | Token estimate: ~650 -->

# Backend (Next.js Server: pages, actions, API routes)

## Middleware

`src/proxy.ts` → `updateSession()` (`src/lib/supabase/middleware.ts`)
matcher: everything except `_next/static`, `_next/image`, `favicon.ico`, `assets`.
Redirects any unauthenticated request (including `/api/*`) to `/login` before
it reaches a route/handler.

## Pages (server-rendered, read-only via src/db/queries.ts)

```
GET /login              src/app/login/page.tsx + LoginForm.tsx (client)
GET /                   src/app/(app)/page.tsx           — Dashboard (KPIs, alerts preview)
GET /inventario         src/app/(app)/inventario/page.tsx → InventarioView.tsx (client, CRUD modals)
GET /alertas            src/app/(app)/alertas/page.tsx
GET /movimientos        src/app/(app)/movimientos/page.tsx → MovimientosView.tsx (client, filters)
GET /reportes           src/app/(app)/reportes/page.tsx
```

## API Routes

```
GET /api/parts/[id]/movements   src/app/api/parts/[id]/movements/route.ts
```

## Server Actions

`src/app/(app)/actions.ts`
- `signOutAction()` — Supabase sign-out, redirects to `/login`

`src/app/login/actions.ts`
- `authenticate(prevState, formData)` — Supabase email/password sign-in

`src/app/(app)/inventario/actions.ts` (groups)
- `createGroup(formData)` / `updateGroup(id, formData)` / `deleteGroup(id)`
- shared `ActionResult = { error } | { success: true }`
- case-insensitive (`ilike`) dedupe on `groups.name`

`src/app/(app)/inventario/partActions.ts` (parts)
- `createPart(formData)` / `updatePart(id, formData)` / `deletePart(id)`
- case-insensitive dedupe on `parts.sku`

`src/app/(app)/inventario/movementActions.ts` (ledger)
- `createMovement(formData)` — wraps read-stock + insert in `db.transaction()`
  with `SELECT ... FOR UPDATE` on the part row (TOCTOU-safe); computes signed
  qty via pure `resolveSignedQty` (`movementLogic.ts`, no `'use server'`)
- `reverseMovement(id)` — inserts a compensating `ajuste` linked via
  `reverses_movement_id`; guards: auth, no double-void (DB unique index
  backstop, see `data.md`), stock never negative

All 6 catalog CRUD actions + both movement actions call `getUser()` for an
auth check (Supabase Auth), then `revalidatePath()` on success.

## Data-access layer

`src/db/queries.ts` (reads, no `'use server'`)
```
getGroups()
getPartsWithMovements(): PartInput[]              — parts + groups + movements joined in memory
getRecentMovements(limit = 100): MovementRow[]
getMovementsByPartId(partId): MovementRow[]
getMovementsForMonth(year, month): MovementRow[]  — month boundaries computed with
                                                     a fixed UTC-5 (Peru) offset
```

## See also

- `architecture.md` — request flow diagram
- `data.md` — table schema this layer reads/writes
- `frontend.md` — which client components call which actions
