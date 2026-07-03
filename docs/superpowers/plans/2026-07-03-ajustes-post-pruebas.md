# Ajustes post-pruebas (rotación dinámica, selector mes/año, fix sticky) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rotation-days calculation use a dynamic window for SKUs with less than 90 days of real movement history, replace the Movimientos page's ‹ month-label › navigator with two `<select>` dropdowns (month + year), and fix a visual gap in the sticky filter bar that shows through during scroll.

**Architecture:** No new modules. Task 1 changes one pure function in the existing business-logic module (`src/lib/inventory.ts`). Tasks 2 and 3 are sequential edits to the same client component (`src/app/(app)/movimientos/MovimientosView.tsx`) plus a small prop addition in its server page (`src/app/(app)/movimientos/page.tsx`).

**Tech Stack:** Next.js App Router, TypeScript, Vitest.

## Global Constraints

- UI text stays in Spanish, matching the existing tone.
- No CSS framework — inline `style` objects, same as the rest of the codebase.
- For SKUs with ≥ 90 days of real movement history, rotation results must be byte-identical to today's fixed-90-day behavior (no regression).
- The month/year selector must not change what gets queried or how (`getMovementsForMonth(year, month)` stays as-is) — only the picker UI changes.
- The sticky-bar fix must not change the initial (unscrolled) visual position of the month/year controls or the filter pills.
- Spec de referencia: `docs/superpowers/specs/2026-07-03-ajustes-post-pruebas-design.md`.

---

### Task 1: Rotación — ventana dinámica para SKUs con poco historial

**Files:**
- Modify: `src/lib/inventory.ts` (`computeRotationDays`, lines 35-49)
- Modify: `src/lib/inventory.test.ts` (new tests inside the existing `describe('computeRotationDays', ...)` block)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `computeRotationDays(movements: MovementInput[], now?: Date): number | null` — same name and signature as today, corrected internal behavior. Tasks 2 and 3 don't touch this function.

- [ ] **Step 1: Write the new tests (dynamic window + long-history regression + empty-array guard)**

In `src/lib/inventory.test.ts`, inside `describe('computeRotationDays', ...)`, insert these 3 tests right after the existing `'still counts a salida that was never voided'` test (after its closing `});` at line 92, before the describe block's own closing `});` at line 93):

```ts
  it('uses a dynamic window for a SKU with less than 90 days of real history', () => {
    // Ingreso of 8 units yesterday, salida of 5 today. With the old fixed 90-day
    // window this diluted to an absurdly high rotation number; with a ~1-day real
    // window it reflects the actual recent velocity: 5 units/day, stock 3 -> ~1 day.
    const recentNow = new Date('2026-07-03T12:00:00Z');
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 8, createdAt: new Date('2026-07-02T12:00:00Z'), id: 'in-1' },
        { type: 'salida', qty: -5, createdAt: new Date('2026-07-03T09:00:00Z'), id: 'out-1' },
      ],
      recentNow
    );
    expect(rotation).toBe(1);
  });

  it('caps the window at 90 days for a SKU with a long history (regression)', () => {
    // Earliest movement is way more than 90 days before "now" -> the window must
    // still cap at 90 days, giving the exact same result as the fixed-window formula.
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 55, createdAt: new Date('2025-01-01'), id: 'in-1' },
        { type: 'salida', qty: -45, createdAt: new Date('2026-06-01'), id: 'out-1' },
      ],
      now
    );
    expect(rotation).toBe(20);
  });

  it('returns null for a part with no movements at all', () => {
    expect(computeRotationDays([], now)).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: FAIL on `'uses a dynamic window for a SKU with less than 90 days of real history'` — with the current fixed-90-day formula this returns a much larger number, not `1`. The other 2 new tests should already PASS (they're regression/guard checks the current code happens to satisfy), which is fine — only the first one needs to flip from fail to pass.

- [ ] **Step 3: Implement the dynamic window in `computeRotationDays`**

In `src/lib/inventory.ts`, replace:

```ts
const ROTATION_WINDOW_DAYS = 90;

export function computeRotationDays(movements: MovementInput[], now: Date = new Date()): number | null {
  const windowStart = new Date(now.getTime() - ROTATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const voidedIds = new Set(
    movements.map((m) => m.reversesMovementId).filter((x): x is string => x != null)
  );
  const salidaUnits = movements
    .filter((m) => m.type === 'salida' && m.createdAt >= windowStart && !(m.id !== undefined && voidedIds.has(m.id)))
    .reduce((sum, m) => sum + Math.abs(m.qty), 0);
  if (salidaUnits === 0) return null;
  const stock = computeStock(movements);
  const dailyVelocity = salidaUnits / ROTATION_WINDOW_DAYS;
  return Math.round(stock / dailyVelocity);
}
```

by:

```ts
const ROTATION_WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeRotationDays(movements: MovementInput[], now: Date = new Date()): number | null {
  if (movements.length === 0) return null;
  const earliestMovementDate = new Date(Math.min(...movements.map((m) => m.createdAt.getTime())));
  const daysSinceEarliest = (now.getTime() - earliestMovementDate.getTime()) / MS_PER_DAY;
  const windowDays = Math.min(ROTATION_WINDOW_DAYS, Math.max(1, daysSinceEarliest));
  const windowStart = new Date(now.getTime() - windowDays * MS_PER_DAY);
  const voidedIds = new Set(
    movements.map((m) => m.reversesMovementId).filter((x): x is string => x != null)
  );
  const salidaUnits = movements
    .filter((m) => m.type === 'salida' && m.createdAt >= windowStart && !(m.id !== undefined && voidedIds.has(m.id)))
    .reduce((sum, m) => sum + Math.abs(m.qty), 0);
  if (salidaUnits === 0) return null;
  const stock = computeStock(movements);
  const dailyVelocity = salidaUnits / windowDays;
  return Math.round(stock / dailyVelocity);
}
```

- [ ] **Step 4: Run all tests and verify everything passes**

Run: `npm test`
Expected: PASS — all tests including the 5 pre-existing `computeRotationDays` tests (unaffected: 3 of them have an "earliest movement" that is either exactly 90 days before `now` or far more than 90 days before `now`, so `windowDays` still resolves to 90 in those cases — verified by hand while writing this plan) and the 3 new ones.

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/inventory.ts src/lib/inventory.test.ts
git commit -m "fix(inventario): ventana dinamica de rotacion para SKUs con poco historial"
```

---

### Task 2: Movimientos — selector de mes/año con 2 dropdowns

**Files:**
- Modify: `src/app/(app)/movimientos/page.tsx` (pass a new `currentYear` prop)
- Modify: `src/app/(app)/movimientos/MovimientosView.tsx` (replace the ‹ month-label › navigator with 2 `<select>`s)

**Interfaces:**
- Consumes: `MovimientosView`'s existing `{ movements, year, month }` props (from Task 6 of the prior plan).
- Produces: `MovimientosView` now takes a 4th prop, `currentYear: number`. Task 3 (the sticky-bar fix) edits the same file and must preserve this prop and the new `<select>` markup as-is — it only touches the wrapping `<div>`'s `style` object.

- [ ] **Step 1: Pass `currentYear` from the server page**

In `src/app/(app)/movimientos/page.tsx`, replace:

```tsx
  const [movements, partsInput] = await Promise.all([
    getMovementsForMonth(year, month),
    getPartsWithMovements(),
  ]);
  const alertCount = buildAlerts(computeParts(partsInput)).length;

  return (
    <>
      <Header title="Trazabilidad de movimientos" subtitle="Ingresos, salidas y ajustes" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <MovimientosView movements={movements} year={year} month={month} />
      </main>
    </>
  );
}
```

by:

```tsx
  const [movements, partsInput] = await Promise.all([
    getMovementsForMonth(year, month),
    getPartsWithMovements(),
  ]);
  const alertCount = buildAlerts(computeParts(partsInput)).length;

  return (
    <>
      <Header title="Trazabilidad de movimientos" subtitle="Ingresos, salidas y ajustes" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <MovimientosView movements={movements} year={year} month={month} currentYear={now.getFullYear()} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Replace the month navigator with 2 selects in `MovimientosView.tsx`**

Replace the entire file `src/app/(app)/movimientos/MovimientosView.tsx` with:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MovementRow } from '@/db/queries';
import { reverseMovement } from '../inventario/movementActions';

const TYPE_COLORS: Record<string, [string, string, string]> = {
  ingreso: ['#e7f6ee', '#1b7a47', '#1f9d57'],
  salida: ['#fbf3d6', '#8a6a12', '#d4a813'],
  ajuste: ['#fde8e8', '#c0322f', '#E23B3B'],
};

const FILTERS = ['Todos', 'ingreso', 'salida', 'ajuste'] as const;
const FILTER_LABELS: Record<string, string> = { Todos: 'Todos', ingreso: 'Ingreso', salida: 'Salida', ajuste: 'Ajuste' };

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function MovimientosView({
  movements, year, month, currentYear,
}: {
  movements: MovementRow[]; year: number; month: number; currentYear: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todos');
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voidedIds = useMemo(
    () => new Set(movements.map((m) => m.reversesMovementId).filter((x): x is string => x !== null)),
    [movements]
  );

  const filtered = useMemo(
    () => (filter === 'Todos' ? movements : movements.filter((m) => m.type === filter)),
    [movements, filter]
  );

  function goToDate(newYear: number, newMonth: number) {
    router.push(`/movimientos?year=${newYear}&month=${newMonth}`);
  }

  async function handleReverse(m: MovementRow) {
    if (!confirm(`¿Anular este movimiento (${m.qty >= 0 ? '+' : '−'}${Math.abs(m.qty)} u. · ${m.partDescription})? Se registrará un movimiento inverso; el original queda en el historial.`)) return;
    setError(null);
    setReversingId(m.id);
    const result = await reverseMovement(m.id);
    setReversingId(null);
    if ('error' in result) { setError(result.error); return; }
    router.refresh();
  }

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', paddingTop: 4, paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <select
            value={month}
            onChange={(e) => goToDate(year, Number(e.target.value))}
            style={selectStyle}
            aria-label="Mes"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => goToDate(Number(e.target.value), month)}
            style={selectStyle}
            aria-label="Año"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              style={{
                padding: '8px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? '#1F56D6' : '#fff', color: filter === f ? '#fff' : '#5b6472',
                border: filter === f ? '1px solid #1F56D6' : '1px solid #e3e6ec',
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div style={{ marginBottom: 14, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
          {error}
        </div>
      )}
      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '8px 24px 18px' }}>
        {filtered.map((m) => {
          const colors = TYPE_COLORS[m.type];
          const isVoided = voidedIds.has(m.id);
          const isReversal = m.reversesMovementId !== null;
          const canReverse = !isVoided && !isReversal;
          return (
            <div key={m.id} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f3f4f7', opacity: isVoided ? 0.55 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: colors[0], color: colors[1] }}>
                    {FILTER_LABELS[m.type]}
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, textDecoration: isVoided ? 'line-through' : 'none' }}>
                    <span style={{ color: m.qty >= 0 ? '#1b7a47' : '#c0322f' }}>{m.qty >= 0 ? '+' : '−'}{Math.abs(m.qty)} u.</span> {m.partDescription}
                  </span>
                  {isVoided && <span style={{ fontSize: 11, fontWeight: 700, color: '#c0322f' }}>ANULADO</span>}
                  {isReversal && <span style={{ fontSize: 11, fontWeight: 700, color: '#8a6a12' }}>ANULACIÓN</span>}
                </div>
                <div style={{ fontSize: 13, color: '#5b6472', marginTop: 6 }}>
                  {m.fromLocation} → <b style={{ color: '#1b2230' }}>{m.toLocation}</b>{' '}
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, background: '#f1f3f6', padding: '2px 8px', borderRadius: 6 }}>{m.referenceCode}</span>
                </div>
                {m.comment && (
                  <div style={{ fontSize: 12.5, color: '#8a93a3', fontStyle: 'italic', marginTop: 4 }}>{m.comment}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flex: 'none', fontSize: 12 }}>
                <div style={{ fontWeight: 700 }}>{new Date(m.createdAt).toLocaleString('es-PE')}</div>
                <div style={{ color: '#8a93a3', marginTop: 2 }}>por {m.userEmail}</div>
              </div>
              {canReverse ? (
                <button
                  onClick={() => handleReverse(m)} disabled={reversingId === m.id}
                  style={{ flex: 'none', padding: '7px 13px', borderRadius: 8, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 12, color: '#5b6472', cursor: reversingId === m.id ? 'default' : 'pointer' }}
                >
                  {reversingId === m.id ? '…' : 'Anular'}
                </button>
              ) : (
                <span style={{ flex: 'none', width: 66 }} />
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>Sin movimientos para este filtro.</div>}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5, background: '#fff', cursor: 'pointer' };
```

Note what changed vs. the prior version: `shiftMonth`, `goToMonth`, `monthLabel`, the two ‹ › `<button>`s, and the unused `navButtonStyle` constant are all gone, replaced by `MONTH_NAMES`, the two `<select>`s, `goToDate`, and `selectStyle`. The sticky wrapper's own `style` is untouched here — Task 3 changes only that.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors (confirms no leftover reference to `shiftMonth`, `monthLabel`, `goToMonth`, or `navButtonStyle`).

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS (this task has no new unit tests — it's a pure UI swap with no business logic — the existing 32 tests from Task 1 must still be green).

- [ ] **Step 5: Verification with server + curl**

Run: `npm run dev` (in background) and `curl` against `/movimientos` with a valid session cookie.
Expected: the initial server-rendered HTML includes two `<select>` elements (`aria-label="Mes"` and `aria-label="Año"`) instead of the old `‹`/`›` buttons, with `Junio`/`2026` (or whatever the current year/month resolve to) as the selected `<option>`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/movimientos/page.tsx" "src/app/(app)/movimientos/MovimientosView.tsx"
git commit -m "feat(movimientos): selector de mes/ano con 2 dropdowns"
```

---

### Task 3: Movimientos — corregir el hueco de la barra sticky

**Files:**
- Modify: `src/app/(app)/movimientos/MovimientosView.tsx` (only the sticky wrapper's `style` object)

**Interfaces:**
- Consumes: the file as left by Task 2 (the 2-select navigator, `selectStyle`, everything else unchanged).
- Produces: no interface change — this task only edits inline CSS.

- [ ] **Step 1: Extend the sticky wrapper to the edges of `<main>`**

In `src/app/(app)/movimientos/MovimientosView.tsx`, replace:

```tsx
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', paddingTop: 4, paddingBottom: 14 }}>
```

by:

```tsx
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', margin: '-26px -28px 0', padding: '30px 28px 14px' }}>
```

This cancels out `<main>`'s own `padding: '26px 28px 40px'` on the top/left/right sides (via the negative margin, so the sticky div's background spans edge-to-edge with no reserved padding strip left uncovered above it) and re-adds the same total spacing internally (`30px` top = the original `26px` main padding + `4px` this div's own old `paddingTop`; `28px` left/right = the original main side padding; `14px` bottom, unchanged). The visual position of the month/year selects and the filter pills does not move.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: PASS (no test covers inline CSS; the existing suite must stay green as a regression check).

- [ ] **Step 4: Manual verification**

This is a pure visual/CSS fix with no server-renderable signal `curl` can check (the gap only appears while scrolling, a client-side interaction). Ask the user to confirm in the browser: scrolling the Movimientos list down no longer reveals a movement row peeking through above the sticky month/filter bar, and the initial (unscrolled) position of the selects and filter pills looks the same as before this task.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/movimientos/MovimientosView.tsx"
git commit -m "fix(movimientos): corregir hueco de la barra fija al hacer scroll"
```

---

## Verificación final

Tras completar las 3 tareas:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: los tres comandos sin errores. Luego, pedir al usuario una pasada manual en el navegador: revisar la rotación de un SKU con poco historial (debe verse un número bajo y creíble, no inflado), navegar el selector de mes/año con los dos dropdowns, y confirmar que el hueco de scroll ya no aparece.
