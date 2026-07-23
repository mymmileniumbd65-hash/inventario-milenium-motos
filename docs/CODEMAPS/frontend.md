<!-- Generated: 2026-07-22 | Files scanned: 20 | Token estimate: ~600 -->

# Frontend

## Page tree

```
src/app/
├─ layout.tsx (root)            — next/font/google (Manrope, mono), error.tsx, not-found.tsx
├─ login/
│  ├─ page.tsx (server)         — renders LoginForm, curl-verifiable end-to-end
│  └─ LoginForm.tsx (client)
└─ (app)/                        — authenticated group, shares layout.tsx (Sidebar + Header)
   ├─ layout.tsx                 — Sidebar.tsx, Header.tsx, Crown.tsx logo, sign-out form
   ├─ page.tsx                   — Dashboard: KpiCard.tsx grid, alerts preview
   ├─ inventario/
   │  ├─ page.tsx (server)       — fetches via queries.ts, passes to InventarioView
   │  ├─ InventarioView.tsx (client) — sticky toolbar (search/group filter/Grupos/+Repuesto/+Registrar ingreso)
   │  ├─ PartDrawer.tsx           — part detail + movement history + reversal UI
   │  ├─ PartFormModal.tsx / GroupManagerModal.tsx / MovementFormModal.tsx
   │  ├─ PartCombobox.tsx
   │  └─ Modal.tsx / FormField.tsx — shared dialog primitives (Escape/backdrop-close,
   │                                  role="dialog"/aria-modal, pending-disable Cancelar)
   ├─ alertas/page.tsx            — fully server-rendered
   ├─ movimientos/
   │  ├─ page.tsx (server)        — month/year clamped server-side to dropdown range
   │  └─ MovimientosView.tsx (client) — sticky Todos/Ingreso/Salida/Ajuste filter bar,
   │                                     month+year <select> dropdowns
   └─ reportes/page.tsx           — fully server-rendered
```

## Shared components (`src/components/`)

`Crown.tsx` (logo mark) · `Header.tsx` · `Sidebar.tsx` (nav + icons + user block)
· `KpiCard.tsx`

## Client/server split pattern

- Pages under `(app)/**` are server components that call `src/db/queries.ts`
  directly, then hand plain data down to a client component (`*View.tsx`) that
  owns interactivity (modals, filters, forms).
- Client components call server actions directly (`import { createPart } from
  './partActions'`), not via `fetch`.
- No client-side data-fetching library (no TanStack Query/SWR) — everything is
  server-fetched + `revalidatePath()` after a mutation.

## Styling

No CSS framework. Inline `style` objects everywhere, matching
`prototype-extract/` (reference-only Claude Design export, not runnable).
Fonts via `next/font/google`, referenced as CSS vars `--font-manrope` /
`--font-mono`.

## Verification note

No browser available in this sandbox. Fully server-rendered pages (Dashboard,
Alertas, Movimientos, Reportes, `/login`) are curl-verifiable end-to-end by
extracting the server action's `$ACTION_REF`/`$ACTION_KEY` from the rendered
HTML. Client-only modals/forms (Inventario CRUD) need a human or
browser-capable agent for the actual click-through.

## See also

- `backend.md` — the server actions these components call
- `architecture.md` — overall request flow
