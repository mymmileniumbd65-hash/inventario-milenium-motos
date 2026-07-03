# Ajustes varios (Inventario/Movimientos/Reportes/Panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the rotation-calculation bug, remove low-value/duplicated KPI cards from Reportes and Panel general, clean up the "Registrar movimiento" form (dynamic Origen placeholder, remove Destino), add an optional Comentarios field on movements, and add a month/year filter with a sticky filter bar to Movimientos.

**Architecture:** No new modules or architectural layers — this is a series of surgical edits to the existing pure business-logic module (`src/lib/inventory.ts`), the data-access layer (`src/db/queries.ts`), one schema migration (`src/db/schema.ts`), and the existing page/component files for Inventario, Movimientos, Reportes and the Dashboard. Each task ends with either a green `npm test` (for pure-logic changes) or a clean `npx tsc --noEmit` + manual browser check (for UI/DB wiring that can't be unit-tested per this repo's established pattern).

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM + Postgres (Supabase), Vitest.

## Global Constraints

- Todo el texto de interfaz va en español, con el mismo tono/estilo ya usado en el resto de la app.
- `movements` es un ledger inmutable: nunca se editan ni eliminan filas existentes, solo se insertan nuevas (incluida cualquier reversión).
- Un solo almacén: cualquier "destino" autocompletado en el servidor debe ser siempre el literal `"Almacén"`.
- `MovementInput.id` y `MovementInput.reversesMovementId` deben ser **opcionales** — no debe romperse ningún test existente que construya movimientos sin esos dos campos.
- Sin frameworks CSS: seguir usando objetos `style` inline, igual que el resto del código.
- El cambio de esquema de BD (columna `comment`) se genera con `npm run db:generate` y se aplica con `npm run db:push` contra la base de datos real de Supabase (no hay entorno de staging) — **pausar y confirmar con el usuario antes de ejecutar `db:push`**.
- Spec de referencia: `docs/superpowers/specs/2026-07-02-ajustes-varios-design.md`.

---

### Task 1: Fix de la lógica de rotación (excluir movimientos anulados)

**Files:**
- Modify: `src/lib/inventory.ts` (interfaz `MovementInput`, función `computeRotationDays`)
- Modify: `src/lib/inventory.test.ts` (nuevos casos de prueba)
- Modify: `src/db/queries.ts` (`getPartsWithMovements`, líneas ~18-23)
- Modify: `src/app/(app)/inventario/PartDrawer.tsx` (líneas ~47-48)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `MovementInput` con campos opcionales `id?: string` y `reversesMovementId?: string | null`. `computeRotationDays(movements: MovementInput[], now?: Date): number | null` — mismo nombre y firma, comportamiento corregido. Las tareas 2 y 3 dependen de que `PartComputed.rotationDays` ya venga corregido (lo consumen sin cambios propios).

- [ ] **Step 1: Escribir los tests que reproducen el bug y fijan el comportamiento correcto**

Abrir `src/lib/inventory.test.ts` y, dentro del bloque `describe('computeRotationDays', ...)` (después del test `'ignores salida movements older than 90 days'`, antes del cierre `});` de ese describe), agregar:

```ts
  it('excludes a voided salida from the rotation velocity calculation', () => {
    // Same-day ingreso of 8 units, then a salida of 2 that gets voided right away.
    // A voided salida is not real demand, so this must yield null (no rotation data).
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 8, createdAt: now, id: 'in-1' },
        { type: 'salida', qty: -2, createdAt: now, id: 'out-1' },
        { type: 'ajuste', qty: 2, createdAt: now, id: 'adj-1', reversesMovementId: 'out-1' },
      ],
      now
    );
    expect(rotation).toBeNull();
  });

  it('still counts a salida that was never voided', () => {
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 55, createdAt: new Date('2026-04-01'), id: 'in-1' },
        { type: 'salida', qty: -45, createdAt: new Date('2026-06-01'), id: 'out-1' },
      ],
      now
    );
    expect(rotation).toBe(20);
  });
```

- [ ] **Step 2: Correr los tests y verificar que el primero falla**

Run: `npm test -- inventory.test.ts` (o `npx vitest run src/lib/inventory.test.ts`)
Expected: FAIL en `'excludes a voided salida from the rotation velocity calculation'` — hoy devuelve `360`, no `null` (la salida anulada sigue contando).

- [ ] **Step 3: Corregir `MovementInput` y `computeRotationDays` en `src/lib/inventory.ts`**

Reemplazar:

```ts
export interface MovementInput {
  type: MovementType;
  qty: number;
  createdAt: Date;
}
```

por:

```ts
export interface MovementInput {
  type: MovementType;
  qty: number;
  createdAt: Date;
  id?: string;
  reversesMovementId?: string | null;
}
```

Reemplazar:

```ts
export function computeRotationDays(movements: MovementInput[], now: Date = new Date()): number | null {
  const windowStart = new Date(now.getTime() - ROTATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const salidaUnits = movements
    .filter((m) => m.type === 'salida' && m.createdAt >= windowStart)
    .reduce((sum, m) => sum + Math.abs(m.qty), 0);
  if (salidaUnits === 0) return null;
  const stock = computeStock(movements);
  const dailyVelocity = salidaUnits / ROTATION_WINDOW_DAYS;
  return Math.round(stock / dailyVelocity);
}
```

por:

```ts
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

- [ ] **Step 4: Correr los tests y verificar que todos pasan**

Run: `npm test`
Expected: PASS (todos los tests, incluidos los 2 nuevos)

- [ ] **Step 5: Propagar `id`/`reversesMovementId` desde `getPartsWithMovements`**

En `src/db/queries.ts`, dentro de `getPartsWithMovements`, reemplazar:

```ts
  for (const m of allMovements) {
    const list = movementsByPart.get(m.partId) ?? [];
    list.push({ type: m.type, qty: m.qty, createdAt: m.createdAt });
    movementsByPart.set(m.partId, list);
  }
```

por:

```ts
  for (const m of allMovements) {
    const list = movementsByPart.get(m.partId) ?? [];
    list.push({ id: m.id, type: m.type, qty: m.qty, createdAt: m.createdAt, reversesMovementId: m.reversesMovementId });
    movementsByPart.set(m.partId, list);
  }
```

- [ ] **Step 6: Propagar `id`/`reversesMovementId` en el recálculo en vivo de `PartDrawer.tsx`**

En `src/app/(app)/inventario/PartDrawer.tsx`, reemplazar:

```ts
  const liveStock = history ? computeStock(history.map((h) => ({ type: h.type, qty: h.qty, createdAt: new Date(h.createdAt) }))) : part.stock;
  const liveRotation = history ? computeRotationDays(history.map((h) => ({ type: h.type, qty: h.qty, createdAt: new Date(h.createdAt) }))) : part.rotationDays;
```

por:

```ts
  const liveStock = history ? computeStock(history.map((h) => ({ id: h.id, type: h.type, qty: h.qty, createdAt: new Date(h.createdAt), reversesMovementId: h.reversesMovementId }))) : part.stock;
  const liveRotation = history ? computeRotationDays(history.map((h) => ({ id: h.id, type: h.type, qty: h.qty, createdAt: new Date(h.createdAt), reversesMovementId: h.reversesMovementId }))) : part.rotationDays;
```

- [ ] **Step 7: Verificar tipos y build**

Run: `npm test && npx tsc --noEmit`
Expected: ambos sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/lib/inventory.ts src/lib/inventory.test.ts src/db/queries.ts "src/app/(app)/inventario/PartDrawer.tsx"
git commit -m "fix(inventario): excluir movimientos anulados del calculo de rotacion"
```

---

### Task 2: Reportes — quitar "SKUs en exceso" y "Cobertura"

**Files:**
- Modify: `src/lib/inventory.ts` (`ReportKpis`, `buildReportKpis`)
- Modify: `src/app/(app)/reportes/page.tsx`

**Interfaces:**
- Consumes: `PartComputed.rotationDays` ya corregido por la Task 1 (sin llamarlo directamente, `buildReportKpis` sigue leyendo `p.rotationDays`).
- Produces: `ReportKpis` sin `excessCount` ni `coverageRatio`. Ningún archivo fuera de este task consume esos dos campos.

- [ ] **Step 1: Confirmar que nada más usa `excessCount`/`coverageRatio`**

Run: `grep -rn "excessCount\|coverageRatio" src`
Expected: solo apariciones dentro de `src/lib/inventory.ts` y `src/app/(app)/reportes/page.tsx`.

- [ ] **Step 2: Quitar los campos de `ReportKpis`/`buildReportKpis` en `src/lib/inventory.ts`**

Reemplazar:

```ts
export interface ReportKpis {
  unitsToReplenish: number; comprasCount: number; excessCount: number;
  slowRotationCount: number; coverageRatio: number | null;
}

export function buildReportKpis(parts: PartComputed[], compras: CompraSugerida[]): ReportKpis {
  const totalAll = parts.reduce((s, p) => s + p.stock, 0);
  const totalMin = parts.reduce((s, p) => s + p.minStock, 0);
  return {
    unitsToReplenish: compras.reduce((s, r) => s + r.sugerido, 0),
    comprasCount: compras.length,
    excessCount: parts.filter((p) => p.status === 'Exceso').length,
    slowRotationCount: parts.filter((p) => p.rotationDays !== null && p.rotationDays >= 60).length,
    coverageRatio: totalMin > 0 ? Math.round((totalAll / totalMin) * 10) / 10 : null,
  };
}
```

por:

```ts
export interface ReportKpis {
  unitsToReplenish: number; comprasCount: number; slowRotationCount: number;
}

export function buildReportKpis(parts: PartComputed[], compras: CompraSugerida[]): ReportKpis {
  return {
    unitsToReplenish: compras.reduce((s, r) => s + r.sugerido, 0),
    comprasCount: compras.length,
    slowRotationCount: parts.filter((p) => p.rotationDays !== null && p.rotationDays >= 60).length,
  };
}
```

- [ ] **Step 3: Quitar las 2 tarjetas de `src/app/(app)/reportes/page.tsx`**

Reemplazar:

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          <ReportKpiCard label="Unidades a reponer" value={String(reportKpis.unitsToReplenish)} sub={`${reportKpis.comprasCount} SKUs bajo mínimo`} />
          <ReportKpiCard label="SKUs en exceso" value={String(reportKpis.excessCount)} sub="candidatos a pausar compra" />
          <ReportKpiCard label="Rotación lenta" value={String(reportKpis.slowRotationCount)} sub="SKUs ≥ 60 días de cobertura" />
          <ReportKpiCard label="Cobertura" value={reportKpis.coverageRatio !== null ? `${reportKpis.coverageRatio}×` : '—'} sub="stock total vs mínimos" />
        </div>
```

por:

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 20 }}>
          <ReportKpiCard label="Unidades a reponer" value={String(reportKpis.unitsToReplenish)} sub={`${reportKpis.comprasCount} SKUs bajo mínimo`} />
          <ReportKpiCard label="Rotación lenta" value={String(reportKpis.slowRotationCount)} sub="SKUs ≥ 60 días de cobertura" />
        </div>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (servidor + curl)**

Run: `npm run dev` (en segundo plano) y luego `curl` a `/reportes` con una cookie de sesión válida (patrón ya usado en el proyecto — ver `docs/FLUJO-DESARROLLO.md`).
Expected: el HTML ya no contiene "SKUs en exceso" ni "Cobertura"; sí contiene "Unidades a reponer" y "Rotación lenta".

- [ ] **Step 6: Commit**

```bash
git add src/lib/inventory.ts "src/app/(app)/reportes/page.tsx"
git commit -m "feat(reportes): quitar tarjetas SKUs en exceso y Cobertura"
```

---

### Task 3: Panel general — quitar KPIs poco útiles y la duplicación de rotación

**Files:**
- Modify: `src/lib/inventory.ts` (`DashboardKpis`, `buildDashboardKpis`)
- Modify: `src/lib/inventory.test.ts` (actualizar el test de `buildDashboardKpis`)
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `DashboardKpis` sin `totalUnits`, `inStockSkus`, `avgRotationDays`. Ningún otro archivo del proyecto los consume tras este task.

- [ ] **Step 1: Confirmar que nada más usa los campos que se van a quitar**

Run: `grep -rn "totalUnits\|inStockSkus\|avgRotationDays" src`
Expected: solo apariciones en `src/lib/inventory.ts`, `src/lib/inventory.test.ts` y `src/app/(app)/page.tsx`.

- [ ] **Step 2: Actualizar el test existente en `src/lib/inventory.test.ts`**

Reemplazar:

```ts
describe('buildDashboardKpis', () => {
  it('summarizes totals, alerts and average rotation', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', movements: [{ type: 'ingreso', qty: 55, createdAt: new Date('2026-04-01') }, { type: 'salida', qty: -45, createdAt: new Date('2026-06-01') }] }),
        part({ id: 'b', sku: 'B', movements: [] }),
      ],
      now
    );
    const alerts = buildAlerts(parts);
    const kpis = buildDashboardKpis(parts, 2, alerts, 3);
    expect(kpis.totalUnits).toBe(10);
    expect(kpis.totalSkus).toBe(2);
    expect(kpis.totalGroups).toBe(2);
    expect(kpis.criticalAlerts).toBe(1);
    expect(kpis.avgRotationDays).toBe(20);
    expect(kpis.movementsLast7Days).toBe(3);
  });
});
```

por:

```ts
describe('buildDashboardKpis', () => {
  it('summarizes totals and alerts', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', movements: [{ type: 'ingreso', qty: 55, createdAt: new Date('2026-04-01') }, { type: 'salida', qty: -45, createdAt: new Date('2026-06-01') }] }),
        part({ id: 'b', sku: 'B', movements: [] }),
      ],
      now
    );
    const alerts = buildAlerts(parts);
    const kpis = buildDashboardKpis(parts, 2, alerts, 3);
    expect(kpis.totalSkus).toBe(2);
    expect(kpis.totalGroups).toBe(2);
    expect(kpis.criticalAlerts).toBe(1);
    expect(kpis.movementsLast7Days).toBe(3);
  });
});
```

- [ ] **Step 3: Quitar los campos de `DashboardKpis`/`buildDashboardKpis` en `src/lib/inventory.ts`**

Reemplazar:

```ts
export interface DashboardKpis {
  totalUnits: number; totalSkus: number; inStockSkus: number; totalGroups: number;
  activeAlerts: number; criticalAlerts: number; highAlerts: number;
  avgRotationDays: number | null; movementsLast7Days: number;
}

export function buildDashboardKpis(
  parts: PartComputed[], groupCount: number, alerts: Alert[], movementsLast7Days: number
): DashboardKpis {
  const totalUnits = parts.reduce((s, p) => s + p.stock, 0);
  const rotating = parts.filter((p): p is PartComputed & { rotationDays: number } => p.stock > 0 && p.rotationDays !== null);
  const avgRotationDays = rotating.length > 0
    ? Math.round(rotating.reduce((s, p) => s + p.rotationDays, 0) / rotating.length)
    : null;
  return {
    totalUnits, totalSkus: parts.length, inStockSkus: parts.filter((p) => p.stock > 0).length,
    totalGroups: groupCount, activeAlerts: alerts.length,
    criticalAlerts: alerts.filter((a) => a.sev === 'Crítica').length,
    highAlerts: alerts.filter((a) => a.sev === 'Alta').length,
    avgRotationDays, movementsLast7Days,
  };
}
```

por:

```ts
export interface DashboardKpis {
  totalSkus: number; totalGroups: number;
  activeAlerts: number; criticalAlerts: number; highAlerts: number;
  movementsLast7Days: number;
}

export function buildDashboardKpis(
  parts: PartComputed[], groupCount: number, alerts: Alert[], movementsLast7Days: number
): DashboardKpis {
  return {
    totalSkus: parts.length, totalGroups: groupCount, activeAlerts: alerts.length,
    criticalAlerts: alerts.filter((a) => a.sev === 'Crítica').length,
    highAlerts: alerts.filter((a) => a.sev === 'Alta').length,
    movementsLast7Days,
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Quitar las tarjetas y el bloque duplicado en `src/app/(app)/page.tsx`**

Reemplazar:

```tsx
  const slowest = parts
    .filter((p) => p.stock > 0 && p.rotationDays !== null)
    .sort((a, b) => (b.rotationDays ?? 0) - (a.rotationDays ?? 0))
    .slice(0, 5);

  return (
```

por:

```tsx
  return (
```

Reemplazar:

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          <KpiCard label="Unidades en stock" value={String(kpis.totalUnits)} sub={`${kpis.totalSkus} SKUs · ${kpis.inStockSkus} con stock`} dotColor="#1F56D6" />
          <KpiCard label="Grupos" value={String(kpis.totalGroups)} sub={`${kpis.totalSkus} SKUs clasificados`} dotColor="#1b7a47" />
          <KpiCard label="Alertas activas" value={String(kpis.activeAlerts)} sub={`${kpis.criticalAlerts} críticas · ${kpis.highAlerts} altas`} dotColor="#E23B3B" />
          <KpiCard label="Rotación promedio" value={kpis.avgRotationDays !== null ? `${kpis.avgRotationDays} d` : '—'} sub="meta ≤ 30 días" dotColor="#e8870f" />
          <KpiCard label="Movimientos (7d)" value={String(kpis.movementsLast7Days)} sub="ingresos, salidas y ajustes" dotColor="#5b6472" />
        </div>
```

por:

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <KpiCard label="Grupos" value={String(kpis.totalGroups)} sub={`${kpis.totalSkus} SKUs clasificados`} dotColor="#1b7a47" />
          <KpiCard label="Alertas activas" value={String(kpis.activeAlerts)} sub={`${kpis.criticalAlerts} críticas · ${kpis.highAlerts} altas`} dotColor="#E23B3B" />
          <KpiCard label="Movimientos (7d)" value={String(kpis.movementsLast7Days)} sub="ingresos, salidas y ajustes" dotColor="#5b6472" />
        </div>
```

Reemplazar:

```tsx
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Rotación más lenta</div>
              {slowest.map((p) => (
                <div key={p.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.description}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5, fontWeight: 600 }}>{p.rotationDays} d</span>
                  </div>
                </div>
              ))}
              {slowest.length === 0 && <div style={{ fontSize: 13, color: '#8a93a3' }}>Sin datos de rotación todavía.</div>}
              <div style={{ fontSize: 11.5, color: '#8a93a3', marginTop: 2 }}>Días de cobertura estimados a partir de las salidas de los últimos 90 días.</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Stock por grupo</div>
```

por:

```tsx
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Stock por grupo</div>
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (confirma que no queda ninguna referencia colgante a `slowest`, `totalUnits`, `inStockSkus` o `avgRotationDays`).

- [ ] **Step 7: Verificación manual (servidor + curl)**

Run: `npm run dev` (en segundo plano) y `curl` a `/` con cookie de sesión.
Expected: el HTML ya no contiene "Unidades en stock", "Rotación promedio" ni "Rotación más lenta"; sí contiene "Grupos", "Alertas activas", "Movimientos (7d)" y "Stock por grupo".

- [ ] **Step 8: Commit**

```bash
git add src/lib/inventory.ts src/lib/inventory.test.ts "src/app/(app)/page.tsx"
git commit -m "feat(panel): quitar KPIs poco utiles y la rotacion mas lenta duplicada"
```

---

### Task 4: Registrar movimiento — Origen dinámico y quitar Destino

**Files:**
- Modify: `src/app/(app)/inventario/MovementFormModal.tsx`
- Modify: `src/app/(app)/inventario/movementActions.ts` (`createMovement`)

**Interfaces:**
- Consumes: nada nuevo de tareas anteriores.
- Produces: el formulario deja de enviar `toLocation`; `createMovement` sigue aceptando el mismo `FormData` de siempre pero ya no requiere ese campo. Sin cambios de esquema.

- [ ] **Step 1: Placeholder dinámico de Origen y quitar el campo Destino en `MovementFormModal.tsx`**

Reemplazar el archivo completo `src/app/(app)/inventario/MovementFormModal.tsx` por:

```tsx
'use client';

import { useActionState, useEffect, useState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { createMovement } from './movementActions';
import type { ActionResult } from './actions';
import PartCombobox from './PartCombobox';

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return createMovement(formData);
}

const ORIGEN_PLACEHOLDER: Record<string, string> = {
  ingreso: 'Proveedor',
  salida: 'Cliente',
  ajuste: 'Proveedor o Cliente',
};

export default function MovementFormModal({ parts, onClose, onSuccess }: { parts: PartComputed[]; onClose: () => void; onSuccess: () => void }) {
  const [result, formAction, isPending] = useActionState(action, null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [type, setType] = useState('ingreso');

  useEffect(() => {
    if (result && 'success' in result) onSuccess();
  }, [result, onSuccess]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!new FormData(e.currentTarget).get('partId')) {
            e.preventDefault();
            setLocalError('Selecciona un repuesto de la lista');
          } else {
            setLocalError(null);
          }
        }}
        style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440 }}
      >
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>Registrar movimiento</div>

        <Field label="Repuesto">
          <PartCombobox parts={parts} name="partId" />
        </Field>
        <Field label="Tipo">
          <select name="type" required style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ingreso">Ingreso</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </Field>
        <Field label="Cantidad">
          <input name="qty" type="number" required style={inputStyle} placeholder="Ej. 10 (usa negativo solo para ajustes)" />
        </Field>
        <Field label="Origen">
          <input name="fromLocation" required style={inputStyle} placeholder={ORIGEN_PLACEHOLDER[type]} />
        </Field>
        <Field label="Código de referencia">
          <input name="referenceCode" required style={inputStyle} placeholder="OC-1234" />
        </Field>

        {localError && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {localError}
          </div>
        )}
        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 };
```

- [ ] **Step 2: Quitar `toLocation` de `createMovement` en `movementActions.ts`**

Reemplazar:

```ts
  const partId = (formData.get('partId') as string | null)?.trim();
  const type = formData.get('type') as string | null;
  const qtyRaw = formData.get('qty') as string | null;
  const fromLocation = (formData.get('fromLocation') as string | null)?.trim();
  const toLocation = (formData.get('toLocation') as string | null)?.trim();
  const referenceCode = (formData.get('referenceCode') as string | null)?.trim();

  if (!partId || !type || !qtyRaw || !fromLocation || !toLocation || !referenceCode) {
    return { error: 'Todos los campos son obligatorios.' };
  }
```

por:

```ts
  const partId = (formData.get('partId') as string | null)?.trim();
  const type = formData.get('type') as string | null;
  const qtyRaw = formData.get('qty') as string | null;
  const fromLocation = (formData.get('fromLocation') as string | null)?.trim();
  const referenceCode = (formData.get('referenceCode') as string | null)?.trim();

  if (!partId || !type || !qtyRaw || !fromLocation || !referenceCode) {
    return { error: 'Todos los campos son obligatorios.' };
  }
```

Reemplazar:

```ts
  await db.insert(movements).values({
    partId, type, qty: resolved.qty, fromLocation, toLocation, referenceCode,
    userId: user.id, userEmail: user.email ?? 'desconocido',
  });
```

por:

```ts
  await db.insert(movements).values({
    partId, type, qty: resolved.qty, fromLocation, toLocation: 'Almacén', referenceCode,
    userId: user.id, userEmail: user.email ?? 'desconocido',
  });
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Correr los tests existentes (no deben verse afectados)**

Run: `npm test`
Expected: PASS (los tests de `movementActions.test.ts` prueban `resolveSignedQty`, que no cambió).

- [ ] **Step 5: Verificación manual**

Este cambio es un formulario client-side dentro de un modal — según el patrón ya establecido en el proyecto (`CLAUDE.md`), no es verificable end-to-end con `curl`. Pide al usuario que abra "Registrar movimiento" en el navegador y confirme: (a) el placeholder de "Origen" cambia entre Ingreso/Salida/Ajuste, (b) ya no aparece el campo "Destino", (c) el movimiento se registra correctamente.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inventario/MovementFormModal.tsx" "src/app/(app)/inventario/movementActions.ts"
git commit -m "feat(inventario): placeholder dinamico de Origen y quitar campo Destino"
```

---

### Task 5: Campo opcional "Comentarios" en movimientos

**Files:**
- Modify: `src/db/schema.ts` (tabla `movements`)
- Create: `drizzle/0002_<nombre-generado>.sql` (migración generada por `drizzle-kit`)
- Modify: `src/db/queries.ts` (`MovementRow`, `getRecentMovements`, `getMovementsByPartId`)
- Modify: `src/app/(app)/inventario/MovementFormModal.tsx` (campo Comentarios)
- Modify: `src/app/(app)/inventario/movementActions.ts` (`createMovement` persiste el comentario)
- Modify: `src/app/(app)/movimientos/MovimientosView.tsx` (mostrar comentario)
- Modify: `src/app/(app)/inventario/PartDrawer.tsx` (mostrar comentario)

**Interfaces:**
- Consumes: `MovementFormModal.tsx` y `movementActions.ts` tal como quedaron tras la Task 4.
- Produces: `MovementRow.comment: string | null`. La Task 6 reutiliza esta misma forma de `MovementRow` (incluido `comment`) en la nueva `getMovementsForMonth`.

- [ ] **Step 1: Agregar la columna `comment` en `src/db/schema.ts`**

Reemplazar:

```ts
  referenceCode: text('reference_code').notNull(),
  // Supabase Auth user id (auth.users.id) — no FK, since that table lives in Supabase's own "auth" schema.
  userId: uuid('user_id').notNull(),
```

por:

```ts
  referenceCode: text('reference_code').notNull(),
  comment: text('comment'),
  // Supabase Auth user id (auth.users.id) — no FK, since that table lives in Supabase's own "auth" schema.
  userId: uuid('user_id').notNull(),
```

- [ ] **Step 2: Generar la migración**

Run: `npm run db:generate`
Expected: crea un nuevo archivo `drizzle/0002_<algo>.sql` con el contenido `ALTER TABLE "movements" ADD COLUMN "comment" text;` (verificar abriendo el archivo generado).

- [ ] **Step 3: Aplicar la migración a la base de datos real — PAUSAR Y CONFIRMAR CON EL USUARIO ANTES DE ESTE PASO**

Esto modifica la base de datos de Supabase en uso (no hay entorno de staging). Confirmar explícitamente con el usuario antes de ejecutar.

Run: `npm run db:push`
Expected: confirma que agregó la columna `comment` a `movements` sin errores.

- [ ] **Step 4: Agregar `comment` a `MovementRow` y a las queries en `src/db/queries.ts`**

Reemplazar:

```ts
export interface MovementRow {
  id: string; type: 'ingreso' | 'salida' | 'ajuste'; qty: number;
  fromLocation: string; toLocation: string; referenceCode: string; createdAt: Date;
  userEmail: string; partSku: string; partDescription: string;
  reversesMovementId: string | null;
}

export async function getRecentMovements(limit = 100): Promise<MovementRow[]> {
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
      reversesMovementId: movements.reversesMovementId,
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .orderBy(desc(movements.createdAt))
    .limit(limit);
}

export async function getMovementsByPartId(partId: string): Promise<MovementRow[]> {
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
      reversesMovementId: movements.reversesMovementId,
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .where(eq(movements.partId, partId))
    .orderBy(desc(movements.createdAt));
}
```

por:

```ts
export interface MovementRow {
  id: string; type: 'ingreso' | 'salida' | 'ajuste'; qty: number;
  fromLocation: string; toLocation: string; referenceCode: string; createdAt: Date;
  userEmail: string; partSku: string; partDescription: string;
  reversesMovementId: string | null; comment: string | null;
}

export async function getRecentMovements(limit = 100): Promise<MovementRow[]> {
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
      reversesMovementId: movements.reversesMovementId, comment: movements.comment,
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .orderBy(desc(movements.createdAt))
    .limit(limit);
}

export async function getMovementsByPartId(partId: string): Promise<MovementRow[]> {
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
      reversesMovementId: movements.reversesMovementId, comment: movements.comment,
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .where(eq(movements.partId, partId))
    .orderBy(desc(movements.createdAt));
}
```

- [ ] **Step 5: Agregar el campo "Comentarios" al formulario en `MovementFormModal.tsx`**

Reemplazar:

```tsx
        <Field label="Código de referencia">
          <input name="referenceCode" required style={inputStyle} placeholder="OC-1234" />
        </Field>

        {localError && (
```

por:

```tsx
        <Field label="Código de referencia">
          <input name="referenceCode" required style={inputStyle} placeholder="OC-1234" />
        </Field>
        <Field label="Comentarios (opcional)">
          <textarea name="comment" style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="Detalles adicionales sobre este movimiento…" />
        </Field>

        {localError && (
```

- [ ] **Step 6: Persistir el comentario en `createMovement` (`movementActions.ts`)**

Reemplazar:

```ts
  const fromLocation = (formData.get('fromLocation') as string | null)?.trim();
  const referenceCode = (formData.get('referenceCode') as string | null)?.trim();

  if (!partId || !type || !qtyRaw || !fromLocation || !referenceCode) {
    return { error: 'Todos los campos son obligatorios.' };
  }
```

por:

```ts
  const fromLocation = (formData.get('fromLocation') as string | null)?.trim();
  const referenceCode = (formData.get('referenceCode') as string | null)?.trim();
  const commentRaw = (formData.get('comment') as string | null)?.trim();

  if (!partId || !type || !qtyRaw || !fromLocation || !referenceCode) {
    return { error: 'Todos los campos son obligatorios.' };
  }
```

Reemplazar:

```ts
  await db.insert(movements).values({
    partId, type, qty: resolved.qty, fromLocation, toLocation: 'Almacén', referenceCode,
    userId: user.id, userEmail: user.email ?? 'desconocido',
  });
```

por:

```ts
  await db.insert(movements).values({
    partId, type, qty: resolved.qty, fromLocation, toLocation: 'Almacén', referenceCode,
    comment: commentRaw && commentRaw.length > 0 ? commentRaw : null,
    userId: user.id, userEmail: user.email ?? 'desconocido',
  });
```

- [ ] **Step 7: Mostrar el comentario en `MovimientosView.tsx`**

Reemplazar:

```tsx
                <div style={{ fontSize: 13, color: '#5b6472', marginTop: 6 }}>
                  {m.fromLocation} → <b style={{ color: '#1b2230' }}>{m.toLocation}</b>{' '}
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, background: '#f1f3f6', padding: '2px 8px', borderRadius: 6 }}>{m.referenceCode}</span>
                </div>
```

por:

```tsx
                <div style={{ fontSize: 13, color: '#5b6472', marginTop: 6 }}>
                  {m.fromLocation} → <b style={{ color: '#1b2230' }}>{m.toLocation}</b>{' '}
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, background: '#f1f3f6', padding: '2px 8px', borderRadius: 6 }}>{m.referenceCode}</span>
                </div>
                {m.comment && (
                  <div style={{ fontSize: 12.5, color: '#8a93a3', fontStyle: 'italic', marginTop: 4 }}>{m.comment}</div>
                )}
```

- [ ] **Step 8: Mostrar el comentario en `PartDrawer.tsx`**

Reemplazar:

```tsx
                <div style={{ flex: 1, fontSize: 12.5, color: '#5b6472' }}>
                  {h.fromLocation} → {h.toLocation} · {h.referenceCode}
                  {isVoided && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#c0322f' }}>ANULADO</span>}
                  {isReversal && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#8a6a12' }}>ANULACIÓN</span>}
                </div>
```

por:

```tsx
                <div style={{ flex: 1, fontSize: 12.5, color: '#5b6472' }}>
                  {h.fromLocation} → {h.toLocation} · {h.referenceCode}
                  {isVoided && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#c0322f' }}>ANULADO</span>}
                  {isReversal && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#8a6a12' }}>ANULACIÓN</span>}
                  {h.comment && (
                    <div style={{ fontSize: 12, color: '#8a93a3', fontStyle: 'italic', marginTop: 3 }}>{h.comment}</div>
                  )}
                </div>
```

- [ ] **Step 9: Verificar tipos y tests**

Run: `npm test && npx tsc --noEmit`
Expected: ambos sin errores.

- [ ] **Step 10: Verificación manual**

Pide al usuario que en el navegador: (a) registre un movimiento con un comentario y confirme que aparece en Movimientos y en el drawer del repuesto, (b) registre uno sin comentario y confirme que no se muestra nada extra.

- [ ] **Step 11: Commit**

```bash
git add src/db/schema.ts drizzle/ src/db/queries.ts "src/app/(app)/inventario/MovementFormModal.tsx" "src/app/(app)/inventario/movementActions.ts" "src/app/(app)/movimientos/MovimientosView.tsx" "src/app/(app)/inventario/PartDrawer.tsx"
git commit -m "feat(movimientos): agregar campo opcional Comentarios"
```

---

### Task 6: Movimientos — filtro por mes/año y barra de filtros fija

**Files:**
- Modify: `src/db/queries.ts` (nueva función `getMovementsForMonth`)
- Modify: `src/app/(app)/movimientos/page.tsx`
- Modify: `src/app/(app)/movimientos/MovimientosView.tsx`

**Interfaces:**
- Consumes: `MovementRow` (con `comment`) tal como quedó tras la Task 5.
- Produces: `getMovementsForMonth(year: number, month: number): Promise<MovementRow[]>`. `MovimientosView` gana las props `year: number` y `month: number` (antes solo recibía `movements`).

- [ ] **Step 1: Agregar `getMovementsForMonth` en `src/db/queries.ts`**

Reemplazar el import de drizzle-orm:

```ts
import { eq, desc } from 'drizzle-orm';
```

por:

```ts
import { eq, desc, and, gte, lt } from 'drizzle-orm';
```

Agregar, al final del archivo, después de `getMovementsByPartId`:

```ts

export async function getMovementsForMonth(year: number, month: number): Promise<MovementRow[]> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
      reversesMovementId: movements.reversesMovementId, comment: movements.comment,
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .where(and(gte(movements.createdAt, start), lt(movements.createdAt, end)))
    .orderBy(desc(movements.createdAt));
}
```

- [ ] **Step 2: Leer `year`/`month` de la URL y usar la nueva query en `src/app/(app)/movimientos/page.tsx`**

Reemplazar el archivo completo por:

```tsx
import Header from '@/components/Header';
import { getMovementsForMonth, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import MovimientosView from './MovimientosView';

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

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

- [ ] **Step 3: Agregar el selector de mes/año y la barra de filtros fija en `MovimientosView.tsx`**

Reemplazar el archivo completo `src/app/(app)/movimientos/MovimientosView.tsx` por:

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

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function MovimientosView({ movements, year, month }: { movements: MovementRow[]; year: number; month: number }) {
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

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  function goToMonth(delta: number) {
    const { year: y, month: m } = shiftMonth(year, month, delta);
    router.push(`/movimientos?year=${y}&month=${m}`);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={() => goToMonth(-1)} style={navButtonStyle} aria-label="Mes anterior">‹</button>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize', minWidth: 150, textAlign: 'center' }}>{monthLabel}</div>
          <button onClick={() => goToMonth(1)} style={navButtonStyle} aria-label="Mes siguiente">›</button>
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

const navButtonStyle: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid #e3e6ec', background: '#fff', fontSize: 16, cursor: 'pointer', color: '#5b6472' };
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación con servidor + curl**

Run: `npm run dev` (en segundo plano) y `curl` a `/movimientos` y a `/movimientos?year=2026&month=6` con cookie de sesión.
Expected: la página por defecto solo trae movimientos del mes/año actuales; con `?year=2026&month=6` trae solo los de junio 2026. El HTML incluye el rótulo del mes (p. ej. "julio de 2026").

- [ ] **Step 6: Verificación manual en navegador**

Pide al usuario que confirme: (a) al hacer scroll hacia abajo en una lista larga, la barra "Todos/Ingreso/Salida/Ajuste" (y el selector de mes) se mantiene visible arriba; (b) las flechas ‹ › navegan correctamente entre meses, incluyendo el cambio de año (p. ej. de enero a diciembre del año anterior).

- [ ] **Step 7: Commit**

```bash
git add src/db/queries.ts "src/app/(app)/movimientos/page.tsx" "src/app/(app)/movimientos/MovimientosView.tsx"
git commit -m "feat(movimientos): filtro por mes/ano y barra de filtros fija"
```

---

## Verificación final

Tras completar las 6 tareas:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: los tres comandos sin errores. Luego, pedir al usuario una pasada manual en el navegador cubriendo los 6 cambios (registrar ingreso/salida con y sin comentario, anular un movimiento el mismo día y verificar que la rotación no se infla, navegar meses en Movimientos, revisar Reportes y Panel general).
