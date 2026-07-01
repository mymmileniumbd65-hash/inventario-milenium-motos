# Inventario de Repuestos (Milenium Motos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Claude-Design prototype of the "Milenium Motos" spare-parts inventory app into a fully functional Next.js web app with real auth, persistence, and business logic, deployed on Vercel with a Supabase Postgres database.

**Architecture:** Next.js (App Router, TypeScript) with server components fetching data through a thin Drizzle ORM data-access layer over Supabase Postgres (`groups`, `parts`, `movements` tables). All derived numbers (stock, status, rotation, alerts, KPIs) are computed by a pure, unit-tested business-logic module (`src/lib/inventory.ts`) from raw `parts` + `movements` rows — nothing is cached or double-written. Authentication is handled entirely by **Supabase Auth** (not a custom users table, not Auth.js): sessions are managed via `@supabase/ssr` cookies, refreshed in Next.js middleware. There is no self-registration, only one shared role; accounts are created via the Supabase Admin API.

**Tech Stack:** Next.js 15 (App Router, React 19), TypeScript, Drizzle ORM + `pg` (node-postgres) against Supabase Postgres, `@supabase/supabase-js` + `@supabase/ssr` for auth, Vitest for unit tests. No CSS framework — inline style objects, matching the prototype's own approach.

## Global Constraints

- Single warehouse/location, single user role — no multi-tenant or permission logic (per spec).
- Stock is **never** stored as a counter column; it is always `SUM(movements.qty)` for a part.
- Rotation (días de cobertura) = `stock_actual / (unidades de salida en los últimos 90 días / 90)`; if no salidas in that window, rotation is `null` and the UI shows "—".
- No PO generation ("Generar orden de compra" / "Generar OC" buttons render but do nothing) — explicitly out of scope for this plan.
- Authentication is 100% Supabase Auth — there is no local `users` table, no password hashing in application code, no Auth.js.
- No self-service account registration — accounts are created via the Supabase Admin API (used by the seed script).
- Every task ends with a git commit.
- All user-facing text stays in Spanish, matching the prototype's copy.

---

## Before Task 1 (manual, by the user)

This plan assumes a Supabase project already exists. Gather these before starting:

1. In the Supabase dashboard, go to **Settings → Data API** and copy the **Project URL** and the **`anon` public key** — these become `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. In **Settings → API Keys**, copy the **`service_role` secret key** — this becomes `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to the browser; used only by the seed script to create accounts).
3. In **Settings → Database → Connection string**, copy the **Transaction pooler** string (port `6543`) — this becomes `DATABASE_URL`.
4. In the same section, copy the **Direct connection** string (port `5432`) — this becomes `DIRECT_DATABASE_URL` (used only by `drizzle-kit` for migrations).

Keep all four handy for Task 1.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `.env.local` (untracked)
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder, replaced in Task 9)

**Interfaces:**
- Produces: a runnable Next.js dev server (`npm run dev`), TypeScript path alias `@/*` → `src/*`, `npm test` wired to Vitest.

- [ ] **Step 1: Scaffold Next.js**

Run:
```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind --use-npm --turbopack
```
When prompted about the directory not being empty, confirm — the existing files (`docs/`, `prototype-extract/`, the `.zip`) don't collide with anything Next.js creates.

- [ ] **Step 2: Install runtime and dev dependencies**

Run:
```bash
npm install drizzle-orm pg @supabase/supabase-js @supabase/ssr
npm install -D drizzle-kit @types/pg vitest tsx
```

- [ ] **Step 3: Add `.gitignore` entries**

Append to `.gitignore` (created by create-next-app) if not already present:
```
.env
.env.local
```

- [ ] **Step 4: Create `.env.example`**

```
# Supabase project (Settings -> Data API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase project (Settings -> API Keys) — server-only, used by the seed script
SUPABASE_SERVICE_ROLE_KEY=

# Pooled connection (used by the app at runtime) — Supabase "Transaction pooler", port 6543
DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres

# Direct connection (used only by drizzle-kit for migrations) — port 5432
DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres
```

- [ ] **Step 5: Create `.env.local` with real values (not committed)**

Copy `.env.example` to `.env.local` and fill in the real values gathered in "Before Task 1".

- [ ] **Step 6: Add scripts to `package.json`**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run",
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:seed": "tsx src/db/seed.ts"
```

- [ ] **Step 7: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 8: Verify the dev server runs**

Run: `npm run dev` (then stop it with Ctrl+C — this is just a smoke check)
Expected: server starts on `http://localhost:3000` with no errors.

- [ ] **Step 9: Commit**

```bash
git init
git config user.email "enriquechaname1@gmail.com"
git config user.name "Enrique"
git add -A
git commit -m "chore: scaffold Next.js project with Drizzle, Supabase and Vitest"
```

---

### Task 2: Business logic module — stock, status, rotation

**Files:**
- Create: `src/lib/inventory.ts`
- Test: `src/lib/inventory.test.ts`

**Interfaces:**
- Produces: `MovementInput`, `PartInput`, `PartComputed`, `PartStatus`, `computeStock()`, `statusOf()`, `computeRotationDays()`, `computeParts()` — consumed by Task 4 (data-access layer) and every page/report task.

- [ ] **Step 1: Write failing tests for `computeStock` and `statusOf`**

Create `src/lib/inventory.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeStock, statusOf } from './inventory';

describe('computeStock', () => {
  it('sums positive and negative movement quantities', () => {
    const stock = computeStock([
      { type: 'ingreso', qty: 10, createdAt: new Date('2026-01-01') },
      { type: 'salida', qty: -3, createdAt: new Date('2026-01-02') },
      { type: 'ajuste', qty: -1, createdAt: new Date('2026-01-03') },
    ]);
    expect(stock).toBe(6);
  });

  it('returns 0 for a part with no movements', () => {
    expect(computeStock([])).toBe(0);
  });
});

describe('statusOf', () => {
  it('is Agotado when stock is 0', () => {
    expect(statusOf(0, 5)).toBe('Agotado');
  });
  it('is Stock bajo when stock is below the minimum', () => {
    expect(statusOf(3, 5)).toBe('Stock bajo');
  });
  it('is Exceso when stock is at least 4x the minimum', () => {
    expect(statusOf(20, 5)).toBe('Exceso');
  });
  it('is Disponible otherwise', () => {
    expect(statusOf(8, 5)).toBe('Disponible');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: FAIL — `Cannot find module './inventory'` (file doesn't exist yet).

- [ ] **Step 3: Implement `computeStock` and `statusOf`**

Create `src/lib/inventory.ts`:
```ts
export type MovementType = 'ingreso' | 'salida' | 'ajuste';

export interface MovementInput {
  type: MovementType;
  qty: number;
  createdAt: Date;
}

export interface PartInput {
  id: string;
  sku: string;
  description: string;
  compat: string;
  groupId: string;
  groupName: string;
  minStock: number;
  movements: MovementInput[];
}

export type PartStatus = 'Disponible' | 'Stock bajo' | 'Agotado' | 'Exceso';

export function computeStock(movements: MovementInput[]): number {
  return movements.reduce((sum, m) => sum + m.qty, 0);
}

export function statusOf(stock: number, minStock: number): PartStatus {
  if (stock === 0) return 'Agotado';
  if (stock < minStock) return 'Stock bajo';
  if (minStock > 0 && stock >= minStock * 4) return 'Exceso';
  return 'Disponible';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Write failing tests for `computeRotationDays`**

Append to `src/lib/inventory.test.ts`:
```ts
import { computeRotationDays } from './inventory';

describe('computeRotationDays', () => {
  const now = new Date('2026-06-30T00:00:00Z');

  it('returns null when there are no salida movements in the last 90 days', () => {
    const rotation = computeRotationDays(
      [{ type: 'ingreso', qty: 10, createdAt: new Date('2026-06-01') }],
      now
    );
    expect(rotation).toBeNull();
  });

  it('computes days of coverage from trailing 90-day sell-through velocity', () => {
    // 10 units in stock, 45 units sold over the last 90 days -> velocity 0.5/day -> 20 days of coverage
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 55, createdAt: new Date('2026-04-01') },
        { type: 'salida', qty: -45, createdAt: new Date('2026-06-01') },
      ],
      now
    );
    expect(rotation).toBe(20);
  });

  it('ignores salida movements older than 90 days', () => {
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 10, createdAt: new Date('2025-01-01') },
        { type: 'salida', qty: -5, createdAt: new Date('2025-01-15') },
      ],
      now
    );
    expect(rotation).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: FAIL — `computeRotationDays is not a function`

- [ ] **Step 7: Implement `computeRotationDays` and `computeParts`**

Append to `src/lib/inventory.ts`:
```ts
const ROTATION_WINDOW_DAYS = 90;

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

export interface PartComputed extends PartInput {
  stock: number;
  status: PartStatus;
  rotationDays: number | null;
}

export function computeParts(parts: PartInput[], now: Date = new Date()): PartComputed[] {
  return parts.map((p) => {
    const stock = computeStock(p.movements);
    return {
      ...p,
      stock,
      status: statusOf(stock, p.minStock),
      rotationDays: computeRotationDays(p.movements, now),
    };
  });
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/inventory.ts src/lib/inventory.test.ts
git commit -m "feat: add stock, status and rotation calculations"
```

---

### Task 3: Business logic module — alerts, KPIs, reports

**Files:**
- Modify: `src/lib/inventory.ts`
- Modify: `src/lib/inventory.test.ts`

**Interfaces:**
- Consumes: `PartComputed`, `computeParts` from Task 2.
- Produces: `Alert`, `AlertSeverity`, `buildAlerts()`, `buildComprasSugeridas()`, `GroupBar`, `buildGroupBars()`, `DashboardKpis`, `buildDashboardKpis()`, `ReportKpis`, `buildReportKpis()` — consumed by Tasks 9, 13, 14, 15, 16 (dashboard, inventory, alerts, movements, reports pages).

- [ ] **Step 1: Write failing tests for `buildAlerts`**

Append to `src/lib/inventory.test.ts`:
```ts
import { computeParts, buildAlerts } from './inventory';
import type { PartInput } from './inventory';

const now = new Date('2026-06-30T00:00:00Z');

function part(overrides: Partial<PartInput>): PartInput {
  return {
    id: 'id-1', sku: 'SKU-1', description: 'Repuesto de prueba', compat: 'Universal',
    groupId: 'g1', groupName: 'Grupo 1', minStock: 5, movements: [],
    ...overrides,
  };
}

describe('buildAlerts', () => {
  it('flags a part with 0 stock as Crítica / Agotado', () => {
    const parts = computeParts([part({ movements: [] })], now);
    const alerts = buildAlerts(parts);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ sev: 'Crítica', tipo: 'Agotado', sku: 'SKU-1' });
  });

  it('flags a part below minimum as Alta / Stock bajo', () => {
    const parts = computeParts(
      [part({ movements: [{ type: 'ingreso', qty: 3, createdAt: now }] })],
      now
    );
    const alerts = buildAlerts(parts);
    expect(alerts[0]).toMatchObject({ sev: 'Alta', tipo: 'Stock bajo' });
  });

  it('flags 4x-minimum stock as Media / Exceso de stock', () => {
    const parts = computeParts(
      [part({ movements: [{ type: 'ingreso', qty: 20, createdAt: now }] })],
      now
    );
    const alerts = buildAlerts(parts);
    expect(alerts.some((a) => a.tipo === 'Exceso de stock' && a.sev === 'Media')).toBe(true);
  });

  it('sorts alerts by severity: Crítica, Alta, Media', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', movements: [{ type: 'ingreso', qty: 20, createdAt: now }] }), // Exceso -> Media
        part({ id: 'b', sku: 'B', movements: [] }), // Agotado -> Crítica
        part({ id: 'c', sku: 'C', movements: [{ type: 'ingreso', qty: 2, createdAt: now }] }), // Stock bajo -> Alta
      ],
      now
    );
    const alerts = buildAlerts(parts);
    expect(alerts.map((a) => a.sev)).toEqual(['Crítica', 'Alta', 'Media']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: FAIL — `buildAlerts is not a function`

- [ ] **Step 3: Implement `buildAlerts`**

Append to `src/lib/inventory.ts`:
```ts
export type AlertSeverity = 'Crítica' | 'Alta' | 'Media';

export interface Alert {
  sev: AlertSeverity;
  tipo: string;
  sku: string;
  desc: string;
  groupName: string;
  detail: string;
  accion: string;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { Crítica: 0, Alta: 1, Media: 2 };

export function buildAlerts(parts: PartComputed[]): Alert[] {
  const alerts: Alert[] = [];
  for (const p of parts) {
    if (p.stock === 0) {
      alerts.push({
        sev: 'Crítica', tipo: 'Agotado', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: '0 unidades en stock', accion: `reponer ${p.minStock * 2} u.`,
      });
    } else if (p.stock < p.minStock) {
      alerts.push({
        sev: 'Alta', tipo: 'Stock bajo', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: `${p.stock} u. · mínimo ${p.minStock} u.`, accion: `reponer ${p.minStock * 2 - p.stock} u.`,
      });
    }
    if (p.stock > 0 && p.rotationDays !== null && p.rotationDays >= 60) {
      alerts.push({
        sev: 'Media', tipo: 'Baja rotación', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: `${p.rotationDays} días de cobertura estimados`, accion: 'promoción / descuento',
      });
    }
    if (p.minStock > 0 && p.stock >= p.minStock * 4) {
      alerts.push({
        sev: 'Media', tipo: 'Exceso de stock', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: `${p.stock} u. · ${(p.stock / p.minStock).toFixed(1)}× el mínimo`, accion: 'pausar compra',
      });
    }
  }
  return alerts.sort((a, b) => SEVERITY_ORDER[a.sev] - SEVERITY_ORDER[b.sev]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for `buildComprasSugeridas`, `buildGroupBars`, `buildDashboardKpis`**

Append to `src/lib/inventory.test.ts`:
```ts
import { buildComprasSugeridas, buildGroupBars, buildDashboardKpis } from './inventory';

describe('buildComprasSugeridas', () => {
  it('includes only Agotado and Stock bajo parts, sorted by priority', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', movements: [] }), // Agotado
        part({ id: 'b', sku: 'B', movements: [{ type: 'ingreso', qty: 3, createdAt: now }] }), // Stock bajo
        part({ id: 'c', sku: 'C', movements: [{ type: 'ingreso', qty: 20, createdAt: now }] }), // Disponible/Exceso
      ],
      now
    );
    const rows = buildComprasSugeridas(parts);
    expect(rows.map((r) => r.sku)).toEqual(['A', 'B']);
    expect(rows[0].prio).toBe('Crítica');
    expect(rows[0].sugerido).toBe(10); // min 5 * 2 - 0
  });
});

describe('buildGroupBars', () => {
  it('computes unit count and percentage share per group', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', groupId: 'g1', groupName: 'Grupo 1', movements: [{ type: 'ingreso', qty: 10, createdAt: now }] }),
        part({ id: 'b', sku: 'B', groupId: 'g2', groupName: 'Grupo 2', movements: [{ type: 'ingreso', qty: 30, createdAt: now }] }),
      ],
      now
    );
    const bars = buildGroupBars(parts, [{ id: 'g1', name: 'Grupo 1' }, { id: 'g2', name: 'Grupo 2' }]);
    expect(bars.find((b) => b.id === 'g1')).toMatchObject({ count: 10, skuCount: 1, pct: 25 });
    expect(bars.find((b) => b.id === 'g2')).toMatchObject({ count: 30, skuCount: 1, pct: 75 });
  });
});

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

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: FAIL — missing functions

- [ ] **Step 7: Implement `buildComprasSugeridas`, `buildGroupBars`, `buildDashboardKpis`, `buildReportKpis`**

Append to `src/lib/inventory.ts`:
```ts
export interface CompraSugerida {
  sku: string; desc: string; groupName: string;
  actual: number; min: number; sugerido: number; prio: AlertSeverity;
}

export function buildComprasSugeridas(parts: PartComputed[]): CompraSugerida[] {
  return parts
    .filter((p) => p.status === 'Agotado' || p.status === 'Stock bajo')
    .map((p) => ({
      sku: p.sku, desc: p.description, groupName: p.groupName,
      actual: p.stock, min: p.minStock,
      sugerido: Math.max(p.minStock * 2 - p.stock, p.minStock),
      prio: (p.stock === 0 ? 'Crítica' : 'Alta') as AlertSeverity,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.prio] - SEVERITY_ORDER[b.prio]);
}

export interface GroupBar { id: string; name: string; count: number; skuCount: number; pct: number; }

export function buildGroupBars(parts: PartComputed[], groups: { id: string; name: string }[]): GroupBar[] {
  const totalAll = parts.reduce((s, p) => s + p.stock, 0);
  return groups.map((g) => {
    const groupParts = parts.filter((p) => p.groupId === g.id);
    const count = groupParts.reduce((s, p) => s + p.stock, 0);
    return {
      id: g.id, name: g.name, count, skuCount: groupParts.length,
      pct: totalAll > 0 ? Math.round((count / totalAll) * 100) : 0,
    };
  });
}

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

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 9: Commit**

```bash
git add src/lib/inventory.ts src/lib/inventory.test.ts
git commit -m "feat: add alerts, KPIs and report calculations"
```

---

### Task 4: Database schema and client

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`

**Interfaces:**
- Produces: Drizzle table objects `groups`, `parts`, `movements`; exported `db` client — consumed by Task 5 (seed), Task 6 (queries), all server actions. Note there is no `users` table — identity comes from Supabase Auth (Task 7).

- [ ] **Step 1: Define the schema**

Create `src/db/schema.ts`:
```ts
import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const movementTypeEnum = pgEnum('movement_type', ['ingreso', 'salida', 'ajuste']);

export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
});

export const parts = pgTable('parts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: text('sku').notNull().unique(),
  description: text('description').notNull(),
  compat: text('compat').notNull().default(''),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  minStock: integer('min_stock').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const movements = pgTable('movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  partId: uuid('part_id').notNull().references(() => parts.id),
  type: movementTypeEnum('type').notNull(),
  qty: integer('qty').notNull(),
  fromLocation: text('from_location').notNull(),
  toLocation: text('to_location').notNull(),
  referenceCode: text('reference_code').notNull(),
  // Supabase Auth user id (auth.users.id) — no FK, since that table lives in Supabase's own "auth" schema.
  userId: uuid('user_id').notNull(),
  // Snapshot of the acting user's email at the time of the movement, so the timeline
  // and drawer history don't need to query the auth schema to display "por quién".
  userEmail: text('user_email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Create the DB client**

Create `src/db/client.ts`:
```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 3: Create the Drizzle config**

Create `drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL! },
});
```

- [ ] **Step 4: Generate and push the migration**

Run:
```bash
npm run db:generate
npm run db:push
```
Expected: `drizzle-kit` reports the `groups`, `parts`, `movements` tables created in the Supabase database with no errors. If it fails with a connection error, double check `DIRECT_DATABASE_URL` in `.env.local` uses the port-`5432` direct connection string, not the pooled one.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/client.ts drizzle.config.ts drizzle/
git commit -m "feat: add database schema and Drizzle client"
```

---

### Task 5: Seed script (sample catalog + admin account via Supabase Auth)

**Files:**
- Create: `src/db/seed.ts`

**Interfaces:**
- Consumes: `db`, schema tables (Task 4); `@supabase/supabase-js` admin client (service role key).
- Produces: a runnable `npm run db:seed` that populates the sample catalog and creates one admin account in Supabase Auth — consumed manually before Task 8 (login) can be tested end-to-end.

- [ ] **Step 1: Write the seed data and script**

Create `src/db/seed.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import { db } from './client';
import { groups, parts, movements } from './schema';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = 'admin@mileniummotos.pe';
const ADMIN_PASSWORD = '***REDACTED***';

const CATALOG: { id: string; name: string; skus: { sku: string; desc: string; compat: string; min: number; initialStock: number }[] }[] = [
  { id: 'PAR', name: 'Parabrisas', skus: [
    { sku: 'PAR-15', desc: 'Parabrisas 15" ahumado', compat: 'Universal', min: 4, initialStock: 9 },
    { sku: 'PAR-17', desc: 'Parabrisas 17" cristal', compat: 'CB / FZ', min: 5, initialStock: 3 },
    { sku: 'PAR-19', desc: 'Parabrisas 19" ahumado', compat: 'Touring', min: 3, initialStock: 0 },
  ]},
  { id: 'LLA', name: 'Llantas', skus: [
    { sku: 'LLA-8017', desc: 'Llanta 80/100-17', compat: 'Delantera', min: 8, initialStock: 22 },
    { sku: 'LLA-9017', desc: 'Llanta 90/90-17', compat: 'Delantera', min: 8, initialStock: 14 },
    { sku: 'LLA-9018', desc: 'Llanta 90/90-18', compat: 'Trasera', min: 6, initialStock: 6 },
    { sku: 'LLA-1017', desc: 'Llanta 100/90-17', compat: 'Trasera', min: 8, initialStock: 40 },
  ]},
  { id: 'CAD', name: 'Cadenas', skus: [
    { sku: 'CAD-428', desc: 'Cadena 428H · 120L', compat: 'CB / YBR', min: 10, initialStock: 18 },
    { sku: 'CAD-520', desc: 'Cadena 520 · 112L', compat: 'FZ / Pulsar', min: 6, initialStock: 2 },
  ]},
  { id: 'PAS', name: 'Pastillas de freno', skus: [
    { sku: 'PAS-D190', desc: 'Pastilla delantera CB190', compat: 'CB190R', min: 8, initialStock: 12 },
    { sku: 'PAS-DFZ', desc: 'Pastilla delantera FZ25', compat: 'FZ25', min: 6, initialStock: 5 },
    { sku: 'PAS-TUNI', desc: 'Pastilla trasera universal', compat: 'Universal', min: 8, initialStock: 30 },
  ]},
  { id: 'FIL', name: 'Filtros', skus: [
    { sku: 'FIL-ACH', desc: 'Filtro de aceite Honda', compat: 'Honda', min: 10, initialStock: 16 },
    { sku: 'FIL-ACY', desc: 'Filtro de aceite Yamaha', compat: 'Yamaha', min: 8, initialStock: 9 },
    { sku: 'FIL-AIR', desc: 'Filtro de aire CB190', compat: 'CB190R', min: 5, initialStock: 1 },
  ]},
  { id: 'BUJ', name: 'Bujías', skus: [
    { sku: 'BUJ-CR7', desc: 'Bujía NGK CR7HSA', compat: '125–160cc', min: 10, initialStock: 44 },
    { sku: 'BUJ-CR8', desc: 'Bujía NGK CR8E', compat: '190–250cc', min: 8, initialStock: 12 },
  ]},
  { id: 'ESP', name: 'Espejos', skus: [
    { sku: 'ESP-UNI', desc: 'Espejo universal 10mm (par)', compat: 'Universal', min: 6, initialStock: 20 },
    { sku: 'ESP-190', desc: 'Espejo CB190 (par)', compat: 'CB190R', min: 4, initialStock: 0 },
  ]},
  { id: 'BAT', name: 'Baterías', skus: [
    { sku: 'BAT-5A', desc: 'Batería 12V 5Ah gel', compat: '125–160cc', min: 5, initialStock: 7 },
    { sku: 'BAT-7A', desc: 'Batería 12V 7Ah gel', compat: '190–250cc', min: 5, initialStock: 3 },
  ]},
  { id: 'FOC', name: 'Focos', skus: [
    { sku: 'FOC-H4', desc: 'Foco H4 12V halógeno', compat: 'Universal', min: 8, initialStock: 26 },
    { sku: 'FOC-LED', desc: 'Foco LED H4 6000K', compat: 'Universal', min: 6, initialStock: 10 },
  ]},
  { id: 'KIT', name: 'Kits de arrastre', skus: [
    { sku: 'KIT-190', desc: 'Kit arrastre CB190', compat: 'CB190R', min: 4, initialStock: 4 },
    { sku: 'KIT-FZ', desc: 'Kit arrastre FZ25', compat: 'FZ25', min: 3, initialStock: 2 },
  ]},
];

async function ensureAdminUser(): Promise<{ id: string; email: string }> {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Admin' },
  });
  if (created?.user) return { id: created.user.id, email: created.user.email! };

  // If the account already exists, look it up instead of failing the whole seed.
  if (createError?.message.includes('already been registered')) {
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    const existing = list.users.find((u) => u.email === ADMIN_EMAIL);
    if (existing) return { id: existing.id, email: existing.email! };
  }
  throw createError ?? new Error('No se pudo crear ni encontrar el usuario admin.');
}

async function main() {
  console.log('Ensuring admin user exists in Supabase Auth...');
  const admin = await ensureAdminUser();

  console.log('Seeding groups and parts...');
  const now = new Date();
  for (const group of CATALOG) {
    const [insertedGroup] = await db.insert(groups).values({ name: group.name }).returning();
    for (const s of group.skus) {
      const [insertedPart] = await db.insert(parts).values({
        sku: s.sku, description: s.desc, compat: s.compat,
        groupId: insertedGroup.id, minStock: s.min,
      }).returning();

      if (s.initialStock > 0) {
        await db.insert(movements).values({
          partId: insertedPart.id, type: 'ingreso', qty: s.initialStock,
          fromLocation: 'Proveedor', toLocation: 'Almacén',
          referenceCode: `OC-${insertedPart.sku}`,
          userId: admin.id, userEmail: admin.email,
          createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        });
      }
    }
  }

  console.log(`Seed complete. Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed script**

Run: `npm run db:seed`
Expected: logs "Seed complete. Admin login: admin@mileniummotos.pe / ***REDACTED***" with no errors.

- [ ] **Step 3: Verify data landed (manual spot check)**

In the Supabase dashboard: **Authentication → Users** should show `admin@mileniummotos.pe`. In **Table Editor**, `parts` should have 25 rows and `groups` should have 10 rows.

- [ ] **Step 4: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat: add seed script with sample catalog and Supabase Auth admin account"
```

---

### Task 6: Data-access layer

**Files:**
- Create: `src/db/queries.ts`

**Interfaces:**
- Consumes: `db`, schema (Task 4); `PartInput`/`MovementInput` types (Task 2).
- Produces: `getGroups()`, `getPartsWithMovements(): Promise<PartInput[]>`, `getRecentMovements(limit?)`, `getMovementsByPartId(partId)` — consumed by every page/server-action task from here on.

- [ ] **Step 1: Implement queries**

Create `src/db/queries.ts`:
```ts
import { eq, desc } from 'drizzle-orm';
import { db } from './client';
import { groups, parts, movements } from './schema';
import type { PartInput, MovementInput } from '../lib/inventory';

export async function getGroups() {
  return db.select().from(groups).orderBy(groups.name);
}

export async function getPartsWithMovements(): Promise<PartInput[]> {
  const [allParts, allGroups, allMovements] = await Promise.all([
    db.select().from(parts),
    db.select().from(groups),
    db.select().from(movements),
  ]);

  const groupNameById = new Map(allGroups.map((g) => [g.id, g.name]));
  const movementsByPart = new Map<string, MovementInput[]>();
  for (const m of allMovements) {
    const list = movementsByPart.get(m.partId) ?? [];
    list.push({ type: m.type, qty: m.qty, createdAt: m.createdAt });
    movementsByPart.set(m.partId, list);
  }

  return allParts.map((p) => ({
    id: p.id, sku: p.sku, description: p.description, compat: p.compat,
    groupId: p.groupId, groupName: groupNameById.get(p.groupId) ?? '',
    minStock: p.minStock, movements: movementsByPart.get(p.id) ?? [],
  }));
}

export interface MovementRow {
  id: string; type: 'ingreso' | 'salida' | 'ajuste'; qty: number;
  fromLocation: string; toLocation: string; referenceCode: string; createdAt: Date;
  userEmail: string; partSku: string; partDescription: string;
}

export async function getRecentMovements(limit = 100): Promise<MovementRow[]> {
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
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
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .where(eq(movements.partId, partId))
    .orderBy(desc(movements.createdAt));
}
```

- [ ] **Step 2: Manual verification**

Create a throwaway file `src/db/verify.ts`:
```ts
import { getGroups, getPartsWithMovements } from './queries';

async function main() {
  const groups = await getGroups();
  const parts = await getPartsWithMovements();
  console.log(`${groups.length} groups, ${parts.length} parts`);
  console.log(parts[0]);
  process.exit(0);
}
main();
```
Run: `npx tsx src/db/verify.ts`
Expected: `10 groups, 25 parts` and a sample part object with a non-empty `movements` array.
Then delete `src/db/verify.ts` — it was only for manual verification.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat: add data-access layer for groups, parts and movements"
```

---

### Task 7: Supabase Auth setup and login page

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`

**Interfaces:**
- Consumes: `@supabase/ssr`, `@supabase/supabase-js`.
- Produces: `createClient()` (server-side Supabase client bound to Next.js cookies), `updateSession()` (middleware helper) — consumed by every protected page/layout (Task 8+) and by `createMovement` (Task 11) to read the current user.

- [ ] **Step 1: Server-side Supabase client**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component that can't set cookies directly —
            // the middleware below refreshes the session on every request instead.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Middleware session refresh helper**

Create `src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 3: Root middleware**

Create `src/middleware.ts`:
```ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
```

- [ ] **Step 4: Login server action**

Create `src/app/login/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return 'Usuario o contraseña incorrectos.';
  }

  redirect('/');
}
```

- [ ] **Step 5: Login page (styled after the prototype)**

Create `src/app/login/page.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { authenticate } from './actions';

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: 'Manrope, system-ui, sans-serif', background: '#f6f7f9' }}>
      <div style={{ width: '44%', minWidth: 380, background: '#1b2230', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 56px' }}>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>MILENIUM <span style={{ fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>MOTOS</span></div>
        </div>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: '.16em', color: 'rgba(255,255,255,.45)', marginBottom: 16 }}>
            INVENTARIO DE REPUESTOS
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.12, maxWidth: 400 }}>
            Cada repuesto, clasificado y bajo control.
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.62)', marginTop: 16, maxWidth: 370, lineHeight: 1.5 }}>
            Control de stock por grupo y SKU, alertas automáticas de reposición, trazabilidad de movimientos y reportes para tus compras.
          </div>
        </div>
        <div />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <form action={formAction} style={{ width: 380, maxWidth: '100%' }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Iniciar sesión</div>
          <div style={{ fontSize: 14, color: '#5b6472', marginTop: 6 }}>Ingresa con tu cuenta del sistema</div>

          <div style={{ marginTop: 28 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Usuario</label>
            <input
              name="email" type="email" required placeholder="admin@mileniummotos.pe"
              style={{ width: '100%', padding: '13px 14px', border: '1px solid #e3e6ec', borderRadius: 11, fontSize: 14.5, outline: 'none' }}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Contraseña</label>
            <input
              name="password" type="password" required placeholder="••••••••"
              style={{ width: '100%', padding: '13px 14px', border: '1px solid #e3e6ec', borderRadius: 11, fontSize: 14.5, outline: 'none' }}
            />
          </div>

          {errorMessage && (
            <div style={{ marginTop: 14, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit" disabled={isPending}
            style={{ width: '100%', marginTop: 24, padding: 14, background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            {isPending ? 'Ingresando…' : 'Ingresar al sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, then open `http://localhost:3000` in a browser.
Expected: redirected to `/login` (middleware protects `/`). Log in with `admin@mileniummotos.pe` / `***REDACTED***` (from Task 5's seed). Expected: redirected to `/`, which currently shows the placeholder page from Task 1 (replaced in Task 9) — confirm no error is thrown and the URL is `/`, not `/login`.
Also verify: entering a wrong password shows "Usuario o contraseña incorrectos." without redirecting.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase src/middleware.ts src/app/login
git commit -m "feat: add Supabase Auth login and session-refreshing middleware"
```

---

### Task 8: App shell — Sidebar, Header, protected layout

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/components/Header.tsx`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/actions.ts`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Delete: `src/app/page.tsx` (replaced by `src/app/(app)/page.tsx` in Task 9)

**Interfaces:**
- Consumes: `createClient()` (Task 7).
- Produces: `<Sidebar alertCount userEmail>`, `<Header title subtitle alertCount>` — consumed by every page task (9, 13, 14, 15, 16).

- [ ] **Step 1: Add global font setup**

Modify `src/app/layout.tsx` to load the prototype's fonts and reset body styles:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Milenium Motos · Inventario de Repuestos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Replace the contents of `src/app/globals.css` with:
```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Manrope', system-ui, sans-serif;
  background: #f6f7f9;
  color: #1b2230;
}
input, select, button { font-family: inherit; }
```

- [ ] **Step 2: Delete the placeholder root page**

Run: `rm src/app/page.tsx` (its content moves to `src/app/(app)/page.tsx` in Task 9).

- [ ] **Step 3: Add the sign-out server action**

Create `src/app/(app)/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 4: Build the Sidebar**

Create `src/components/Sidebar.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/(app)/actions';

const NAV_ITEMS = [
  { href: '/', label: 'Panel general' },
  { href: '/inventario', label: 'Inventario' },
  { href: '/alertas', label: 'Alertas' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/reportes', label: 'Reportes' },
];

export default function Sidebar({ alertCount, userEmail }: { alertCount: number; userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside style={{ width: 248, flex: 'none', display: 'flex', flexDirection: 'column', background: '#1b2230' }}>
      <div style={{ padding: '22px 20px 18px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
          MILENIUM <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>MOTOS</span>
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9.5, letterSpacing: '.22em', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          REPUESTOS
        </div>
      </div>
      <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px',
                borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
                background: active ? 'rgba(31,86,214,0.24)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.64)',
                boxShadow: active ? 'inset 3px 0 0 #1F56D6' : 'none',
              }}
            >
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.href === '/alertas' && alertCount > 0 && (
                <span style={{
                  minWidth: 20, height: 18, padding: '0 5px', borderRadius: 9, background: '#E23B3B',
                  color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1F56D6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          </div>
          <form action={signOutAction}>
            <button type="submit" title="Salir" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 6 }}>
              Salir
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Build the Header**

Create `src/components/Header.tsx`:
```tsx
import Link from 'next/link';

export default function Header({ title, subtitle, alertCount }: { title: string; subtitle: string; alertCount: number }) {
  return (
    <header style={{ height: 66, flex: 'none', background: '#fff', borderBottom: '1px solid #eef1f5', display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px' }}>
      <div style={{ flex: 'none' }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#8a93a3', marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href="/alertas"
          style={{
            position: 'relative', width: 40, height: 40, border: '1px solid #eef1f5', borderRadius: 10,
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5b6472', textDecoration: 'none',
          }}
        >
          🔔
          {alertCount > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', background: '#E23B3B',
              color: '#fff', borderRadius: 9, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
            }}>
              {alertCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Build the protected layout**

Create `src/app/(app)/layout.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const partsInput = await getPartsWithMovements();
  const alerts = buildAlerts(computeParts(partsInput));

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', minHeight: 0 }}>
      <Sidebar alertCount={alerts.length} userEmail={user.email ?? 'Usuario'} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
```

Note: each page (Task 9 onward) renders its own `<Header>` plus `<main>` content, since `Header`'s title/subtitle differ per page and Next.js layouts don't receive per-route props directly. The middleware from Task 7 already redirects unauthenticated requests, but this layout re-checks defensively (middleware is a performance/UX optimization, not the security boundary).

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, log in, confirm the sidebar renders with 5 nav items, the alert badge shows a number, the admin email is shown at the bottom, and clicking "Salir" logs out and redirects to `/login`.

- [ ] **Step 8: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Header.tsx src/app/(app)/layout.tsx src/app/(app)/actions.ts src/app/layout.tsx src/app/globals.css
git rm src/app/page.tsx
git commit -m "feat: add app shell with sidebar, header and route protection"
```

---

### Task 9: Dashboard page

**Files:**
- Create: `src/app/(app)/page.tsx`
- Create: `src/components/KpiCard.tsx`

**Interfaces:**
- Consumes: `getGroups`, `getPartsWithMovements`, `getRecentMovements` (Task 6); `computeParts`, `buildAlerts`, `buildGroupBars`, `buildDashboardKpis` (Tasks 2-3); `Header` (Task 8).

- [ ] **Step 1: Build the KPI card component**

Create `src/components/KpiCard.tsx`:
```tsx
export default function KpiCard({ label, value, sub, dotColor }: { label: string; value: string; sub: string; dotColor?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {dotColor && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />}
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a93a3' }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 10, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5b6472', marginTop: 7 }}>{sub}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build the dashboard page**

Create `src/app/(app)/page.tsx`:
```tsx
import Header from '@/components/Header';
import KpiCard from '@/components/KpiCard';
import { getGroups, getPartsWithMovements, getRecentMovements } from '@/db/queries';
import { computeParts, buildAlerts, buildGroupBars, buildDashboardKpis } from '@/lib/inventory';

export default async function DashboardPage() {
  const [groups, partsInput, recentMovements] = await Promise.all([
    getGroups(), getPartsWithMovements(), getRecentMovements(5),
  ]);
  const parts = computeParts(partsInput);
  const alerts = buildAlerts(parts);
  const groupBars = buildGroupBars(parts, groups);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const movementsLast7Days = (await getRecentMovements(1000)).filter((m) => m.createdAt >= sevenDaysAgo).length;
  const kpis = buildDashboardKpis(parts, groups.length, alerts, movementsLast7Days);

  const slowest = parts
    .filter((p) => p.stock > 0 && p.rotationDays !== null)
    .sort((a, b) => (b.rotationDays ?? 0) - (a.rotationDays ?? 0))
    .slice(0, 5);

  return (
    <>
      <Header title="Panel general" subtitle="Resumen de stock, alertas y movimientos de repuestos" alertCount={alerts.length} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          <KpiCard label="Unidades en stock" value={String(kpis.totalUnits)} sub={`${kpis.totalSkus} SKUs · ${kpis.inStockSkus} con stock`} dotColor="#1F56D6" />
          <KpiCard label="Grupos" value={String(kpis.totalGroups)} sub={`${kpis.totalSkus} SKUs clasificados`} dotColor="#1b7a47" />
          <KpiCard label="Alertas activas" value={String(kpis.activeAlerts)} sub={`${kpis.criticalAlerts} críticas · ${kpis.highAlerts} altas`} dotColor="#E23B3B" />
          <KpiCard label="Rotación promedio" value={kpis.avgRotationDays !== null ? `${kpis.avgRotationDays} d` : '—'} sub="meta ≤ 30 días" dotColor="#e8870f" />
          <KpiCard label="Movimientos (7d)" value={String(kpis.movementsLast7Days)} sub="ingresos, salidas y ajustes" dotColor="#5b6472" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Alertas activas</div>
              {alerts.slice(0, 5).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid #f3f4f7' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.tipo} · {a.desc}</div>
                    <div style={{ fontSize: 12.5, color: '#5b6472', marginTop: 3 }}>{a.detail}</div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && <div style={{ fontSize: 13, color: '#8a93a3', padding: '12px 0' }}>Sin alertas activas.</div>}
            </div>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Movimientos recientes</div>
              {recentMovements.map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 0', borderTop: '1px solid #f3f4f7' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                      {m.qty >= 0 ? '+' : '−'}{Math.abs(m.qty)} u. {m.partDescription}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a93a3', marginTop: 2 }}>{m.fromLocation} → {m.toLocation} · {m.referenceCode}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: '#8a93a3' }}>
                    <div>{m.createdAt.toLocaleDateString('es-PE')}</div>
                    <div>{m.userEmail}</div>
                  </div>
                </div>
              ))}
              {recentMovements.length === 0 && <div style={{ fontSize: 13, color: '#8a93a3', padding: '12px 0' }}>Sin movimientos todavía.</div>}
            </div>
          </div>
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
              {groupBars.map((g) => (
                <div key={g.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 12.5, color: '#5b6472' }}><b>{g.count}</b> u. · {g.skuCount} SKU</span>
                  </div>
                  <div style={{ height: 8, background: '#eef1f5', borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${g.pct}%`, background: '#1F56D6', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, log in.
Expected: dashboard shows 5 KPI cards with real numbers derived from the seeded data (e.g. "Unidades en stock" should equal the sum of all seeded `initialStock` values), "Movimientos recientes" lists the seeded ingresos, "Stock por grupo" shows all 10 groups with proportional bars.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/page.tsx src/components/KpiCard.tsx
git commit -m "feat: add dashboard page with live KPIs and summaries"
```

---

### Task 10: Group CRUD server actions

**Files:**
- Create: `src/app/(app)/inventario/actions.ts`

**Interfaces:**
- Consumes: `db`, `groups`, `parts` (Task 4).
- Produces: `createGroup(formData)`, `updateGroup(id, formData)`, `deleteGroup(id)` returning `{ error: string } | { success: true }` — consumed by Task 13 (Inventario UI).

- [ ] **Step 1: Implement group actions**

Create `src/app/(app)/inventario/actions.ts`:
```ts
'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { groups, parts } from '@/db/schema';

export type ActionResult = { error: string } | { success: true };

export async function createGroup(formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return { error: 'El nombre del grupo es obligatorio.' };

  const existing = await db.select().from(groups).where(eq(groups.name, name)).limit(1);
  if (existing.length > 0) return { error: 'Ya existe un grupo con ese nombre.' };

  await db.insert(groups).values({ name });
  revalidatePath('/inventario');
  revalidatePath('/');
  return { success: true };
}

export async function updateGroup(id: string, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return { error: 'El nombre del grupo es obligatorio.' };

  const existing = await db.select().from(groups).where(eq(groups.name, name)).limit(1);
  if (existing.length > 0 && existing[0].id !== id) return { error: 'Ya existe un grupo con ese nombre.' };

  await db.update(groups).set({ name }).where(eq(groups.id, id));
  revalidatePath('/inventario');
  return { success: true };
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const partsInGroup = await db.select().from(parts).where(eq(parts.groupId, id)).limit(1);
  if (partsInGroup.length > 0) {
    return { error: 'No se puede eliminar un grupo que tiene repuestos asociados.' };
  }
  await db.delete(groups).where(eq(groups.id, id));
  revalidatePath('/inventario');
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/inventario/actions.ts
git commit -m "feat: add group CRUD server actions"
```

---

### Task 11: Part CRUD server actions

**Files:**
- Create: `src/app/(app)/inventario/partActions.ts`

**Interfaces:**
- Consumes: `db`, `parts`, `movements` (Task 4).
- Produces: `createPart(formData)`, `updatePart(id, formData)`, `deletePart(id)` returning `ActionResult` — consumed by Task 13 (Inventario UI).

- [ ] **Step 1: Implement part actions**

Create `src/app/(app)/inventario/partActions.ts`:
```ts
'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { parts, movements } from '@/db/schema';
import type { ActionResult } from './actions';

function parsePartFields(formData: FormData): { sku: string; description: string; compat: string; groupId: string; minStock: number } | { error: string } {
  const sku = (formData.get('sku') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const compat = (formData.get('compat') as string | null)?.trim() ?? '';
  const groupId = (formData.get('groupId') as string | null)?.trim();
  const minStockRaw = formData.get('minStock') as string | null;

  if (!sku || !description || !groupId) {
    return { error: 'SKU, descripción y grupo son obligatorios.' };
  }
  const minStock = Number(minStockRaw);
  if (!Number.isInteger(minStock) || minStock < 0) {
    return { error: 'El mínimo debe ser un número entero mayor o igual a 0.' };
  }
  return { sku, description, compat, groupId, minStock };
}

export async function createPart(formData: FormData): Promise<ActionResult> {
  const parsed = parsePartFields(formData);
  if ('error' in parsed) return parsed;

  const existing = await db.select().from(parts).where(eq(parts.sku, parsed.sku)).limit(1);
  if (existing.length > 0) return { error: 'Ya existe un repuesto con ese SKU.' };

  await db.insert(parts).values(parsed);
  revalidatePath('/inventario');
  revalidatePath('/');
  return { success: true };
}

export async function updatePart(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parsePartFields(formData);
  if ('error' in parsed) return parsed;

  const existing = await db.select().from(parts).where(eq(parts.sku, parsed.sku)).limit(1);
  if (existing.length > 0 && existing[0].id !== id) return { error: 'Ya existe un repuesto con ese SKU.' };

  await db.update(parts).set(parsed).where(eq(parts.id, id));
  revalidatePath('/inventario');
  return { success: true };
}

export async function deletePart(id: string): Promise<ActionResult> {
  const partMovements = await db.select().from(movements).where(eq(movements.partId, id)).limit(1);
  if (partMovements.length > 0) {
    return { error: 'No se puede eliminar un repuesto con movimientos registrados.' };
  }
  await db.delete(parts).where(eq(parts.id, id));
  revalidatePath('/inventario');
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/inventario/partActions.ts
git commit -m "feat: add part CRUD server actions"
```

---

### Task 12: Movement registration server action

**Files:**
- Create: `src/app/(app)/inventario/movementActions.ts`
- Test: `src/app/(app)/inventario/movementActions.test.ts`

**Interfaces:**
- Consumes: `db`, `movements`, `parts` (Task 4); `computeStock` (Task 2); `createClient()` (Task 7).
- Produces: `createMovement(formData)` returning `ActionResult` — consumed by Task 13 (Inventario UI) and reflected on Tasks 9, 14, 15, 16 via `revalidatePath`.

- [ ] **Step 1: Write a failing test for the quantity-sign logic**

Since the action itself talks to the database and Supabase Auth, extract the pure sign/validation logic into a testable function first.

Create `src/app/(app)/inventario/movementActions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveSignedQty } from './movementActions';

describe('resolveSignedQty', () => {
  it('keeps ingreso positive', () => {
    expect(resolveSignedQty('ingreso', 10)).toEqual({ ok: true, qty: 10 });
  });
  it('rejects a non-positive ingreso', () => {
    expect(resolveSignedQty('ingreso', 0)).toEqual({ ok: false, error: 'Para un ingreso, la cantidad debe ser positiva.' });
  });
  it('negates salida', () => {
    expect(resolveSignedQty('salida', 5)).toEqual({ ok: true, qty: -5 });
  });
  it('rejects a non-positive salida input', () => {
    expect(resolveSignedQty('salida', -2)).toEqual({ ok: false, error: 'Para una salida, ingresa la cantidad como un número positivo.' });
  });
  it('allows ajuste to be positive or negative but not zero', () => {
    expect(resolveSignedQty('ajuste', -3)).toEqual({ ok: true, qty: -3 });
    expect(resolveSignedQty('ajuste', 3)).toEqual({ ok: true, qty: 3 });
    expect(resolveSignedQty('ajuste', 0)).toEqual({ ok: false, error: 'La cantidad debe ser un número entero distinto de 0.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/\(app\)/inventario/movementActions.test.ts`
Expected: FAIL — `Cannot find module './movementActions'`

- [ ] **Step 3: Implement `resolveSignedQty` and `createMovement`**

Create `src/app/(app)/inventario/movementActions.ts`:
```ts
'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db/client';
import { movements, parts } from '@/db/schema';
import { computeStock } from '@/lib/inventory';
import type { ActionResult } from './actions';
import type { MovementType } from '@/lib/inventory';

export function resolveSignedQty(
  type: MovementType, qty: number
): { ok: true; qty: number } | { ok: false; error: string } {
  if (!Number.isInteger(qty) || qty === 0) {
    return { ok: false, error: 'La cantidad debe ser un número entero distinto de 0.' };
  }
  if (type === 'ingreso') {
    if (qty <= 0) return { ok: false, error: 'Para un ingreso, la cantidad debe ser positiva.' };
    return { ok: true, qty };
  }
  if (type === 'salida') {
    if (qty <= 0) return { ok: false, error: 'Para una salida, ingresa la cantidad como un número positivo.' };
    return { ok: true, qty: -qty };
  }
  return { ok: true, qty };
}

export async function createMovement(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const partId = (formData.get('partId') as string | null)?.trim();
  const type = formData.get('type') as string | null;
  const qtyRaw = formData.get('qty') as string | null;
  const fromLocation = (formData.get('fromLocation') as string | null)?.trim();
  const toLocation = (formData.get('toLocation') as string | null)?.trim();
  const referenceCode = (formData.get('referenceCode') as string | null)?.trim();

  if (!partId || !type || !qtyRaw || !fromLocation || !toLocation || !referenceCode) {
    return { error: 'Todos los campos son obligatorios.' };
  }
  if (type !== 'ingreso' && type !== 'salida' && type !== 'ajuste') {
    return { error: 'Tipo de movimiento inválido.' };
  }

  const resolved = resolveSignedQty(type, Number(qtyRaw));
  if (!resolved.ok) return { error: resolved.error };

  const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
  if (!part) return { error: 'El repuesto no existe.' };

  if (resolved.qty < 0) {
    const existingMovements = await db.select().from(movements).where(eq(movements.partId, partId));
    const currentStock = computeStock(existingMovements.map((m) => ({ type: m.type, qty: m.qty, createdAt: m.createdAt })));
    if (currentStock + resolved.qty < 0) {
      return { error: `Stock insuficiente: hay ${currentStock} unidades disponibles.` };
    }
  }

  await db.insert(movements).values({
    partId, type, qty: resolved.qty, fromLocation, toLocation, referenceCode,
    userId: user.id, userEmail: user.email ?? 'desconocido',
  });

  revalidatePath('/inventario');
  revalidatePath('/movimientos');
  revalidatePath('/reportes');
  revalidatePath('/alertas');
  revalidatePath('/');
  return { success: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/\(app\)/inventario/movementActions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/inventario/movementActions.ts src/app/(app)/inventario/movementActions.test.ts
git commit -m "feat: add movement registration server action with stock guard"
```

---

### Task 13: Inventario page — list, filters, CRUD, movement form, drawer

**Files:**
- Create: `src/app/(app)/inventario/page.tsx`
- Create: `src/app/(app)/inventario/InventarioView.tsx`
- Create: `src/app/(app)/inventario/PartDrawer.tsx`
- Create: `src/app/(app)/inventario/MovementFormModal.tsx`
- Create: `src/app/(app)/inventario/PartFormModal.tsx`
- Create: `src/app/(app)/inventario/GroupFormModal.tsx`
- Create: `src/app/api/parts/[id]/movements/route.ts`

**Interfaces:**
- Consumes: `getGroups`, `getPartsWithMovements`, `getMovementsByPartId` (Task 6); `computeParts` (Task 2); `createGroup`/`updateGroup`/`deleteGroup` (Task 10); `createPart`/`updatePart`/`deletePart` (Task 11); `createMovement` (Task 12); `Header` (Task 8); `createClient()` (Task 7) for the API route's auth check.

- [ ] **Step 1: Server page — fetch and compute**

Create `src/app/(app)/inventario/page.tsx`:
```tsx
import Header from '@/components/Header';
import { getGroups, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import InventarioView from './InventarioView';

export default async function InventarioPage() {
  const [groups, partsInput] = await Promise.all([getGroups(), getPartsWithMovements()]);
  const parts = computeParts(partsInput);
  const alertCount = buildAlerts(parts).length;

  return (
    <>
      <Header title="Inventario" subtitle="Repuestos clasificados por grupo y SKU" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <InventarioView groups={groups} parts={parts} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Client view — filters, table, and modal triggers**

Create `src/app/(app)/inventario/InventarioView.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PartComputed } from '@/lib/inventory';
import PartDrawer from './PartDrawer';
import MovementFormModal from './MovementFormModal';
import PartFormModal from './PartFormModal';
import GroupFormModal from './GroupFormModal';

const STATUS_COLORS: Record<string, [string, string, string]> = {
  Disponible: ['#e7f6ee', '#1b7a47', '#1f9d57'],
  'Stock bajo': ['#fdeede', '#b3640f', '#e8870f'],
  Agotado: ['#fde8e8', '#c0322f', '#E23B3B'],
  Exceso: ['#e8eefc', '#1846B3', '#1F56D6'],
};

export default function InventarioView({ groups, parts }: { groups: { id: string; name: string }[]; parts: PartComputed[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedPart, setSelectedPart] = useState<PartComputed | null>(null);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showPartForm, setShowPartForm] = useState<PartComputed | 'new' | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (groupFilter !== 'all' && p.groupId !== groupFilter) return false;
      if (!q) return true;
      return `${p.description} ${p.sku} ${p.groupName} ${p.compat}`.toLowerCase().includes(q);
    });
  }, [parts, query, groupFilter]);

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar repuesto, SKU o grupo…"
          style={{ flex: 1, maxWidth: 320, padding: '10px 12px', border: '1px solid #eef1f5', borderRadius: 10, fontSize: 13.5 }}
        />
        <select
          value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #eef1f5', borderRadius: 10, fontSize: 13.5 }}
        >
          <option value="all">Todos los grupos</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={() => setShowGroupForm(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          + Grupo
        </button>
        <button onClick={() => setShowPartForm('new')} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          + Repuesto
        </button>
        <button onClick={() => setShowMovementForm(true)} style={{ padding: '10px 16px', background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          + Registrar ingreso
        </button>
      </div>

      <div style={{ fontSize: 13, color: '#5b6472', marginBottom: 14 }}>
        <b>{filtered.length}</b> SKUs · <b>{filtered.reduce((s, p) => s + p.stock, 0)}</b> unidades
      </div>

      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fbfbfc' }}>
              <th style={thStyle}>SKU / Repuesto</th>
              <th style={thStyle}>Grupo</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Stock</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Mín</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Rotación</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const colors = STATUS_COLORS[p.status];
              return (
                <tr key={p.id} onClick={() => setSelectedPart(p)} style={{ cursor: 'pointer' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{p.description}</div>
                    <div style={{ fontSize: 11.5, color: '#8a93a3', fontFamily: 'IBM Plex Mono, monospace' }}>{p.sku}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#5b6472', background: '#f1f3f6', padding: '3px 9px', borderRadius: 7 }}>{p.groupName}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>{p.stock}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#8a93a3' }}>{p.minStock}</td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: colors[0], color: colors[1] }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[2] }} />
                      {p.status}
                    </span>
                  </td>
                  <td style={tdStyle}>{p.rotationDays !== null ? `${p.rotationDays} d` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>Sin resultados para tu búsqueda.</div>}
      </div>

      {selectedPart && <PartDrawer part={selectedPart} onClose={() => setSelectedPart(null)} />}
      {showMovementForm && (
        <MovementFormModal
          parts={parts}
          onClose={() => setShowMovementForm(false)}
          onSuccess={() => { setShowMovementForm(false); refresh(); }}
        />
      )}
      {showPartForm && (
        <PartFormModal
          groups={groups}
          part={showPartForm === 'new' ? null : showPartForm}
          onClose={() => setShowPartForm(null)}
          onSuccess={() => { setShowPartForm(null); refresh(); }}
        />
      )}
      {showGroupForm && (
        <GroupFormModal
          onClose={() => setShowGroupForm(false)}
          onSuccess={() => { setShowGroupForm(false); refresh(); }}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a93a3', padding: '13px 16px', borderBottom: '1px solid #eef1f5' };
const tdStyle: React.CSSProperties = { padding: '13px 16px', borderBottom: '1px solid #f3f4f7' };
```

- [ ] **Step 3: Part detail drawer**

Create `src/app/(app)/inventario/PartDrawer.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import type { MovementRow } from '@/db/queries';

export default function PartDrawer({ part, onClose }: { part: PartComputed; onClose: () => void }) {
  const [history, setHistory] = useState<MovementRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/parts/${part.id}/movements`)
      .then((res) => res.json())
      .then((data: MovementRow[]) => { if (!cancelled) setHistory(data); });
    return () => { cancelled = true; };
  }, [part.id]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 620, maxWidth: '94vw', background: '#fff', zIndex: 41, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #eef1f5' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#8a93a3' }}>{part.groupName} › {part.sku}</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{part.description}</div>
          <button onClick={onClose} style={{ position: 'absolute', top: 22, right: 26, width: 36, height: 36, border: '1px solid #eef1f5', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px 26px 8px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <StatBox label="Stock" value={String(part.stock)} />
          <StatBox label="Mínimo" value={String(part.minStock)} />
          <StatBox label="Rotación" value={part.rotationDays !== null ? `${part.rotationDays} d` : '—'} />
          <StatBox label="Compat." value={part.compat} />
        </div>
        <div style={{ padding: '14px 26px 6px', fontSize: 13.5, fontWeight: 800 }}>Movimientos de este SKU</div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 26px 20px' }}>
          {history === null && <div style={{ color: '#8a93a3', fontSize: 13 }}>Cargando…</div>}
          {history?.length === 0 && <div style={{ color: '#8a93a3', fontSize: 13 }}>Sin movimientos registrados todavía.</div>}
          {history?.map((h) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: '1px solid #f3f4f7' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 700, color: h.qty >= 0 ? '#1b7a47' : '#c0322f', width: 60 }}>
                {h.qty >= 0 ? '+' : '−'}{Math.abs(h.qty)}
              </span>
              <div style={{ flex: 1, fontSize: 12.5, color: '#5b6472' }}>{h.fromLocation} → {h.toLocation} · {h.referenceCode}</div>
              <div style={{ textAlign: 'right', fontSize: 11.5 }}>
                <div style={{ fontWeight: 700 }}>{new Date(h.createdAt).toLocaleDateString('es-PE')}</div>
                <div style={{ color: '#8a93a3' }}>por {h.userEmail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f6f7f9', borderRadius: 12, padding: '13px 14px' }}>
      <div style={{ fontSize: 11, color: '#8a93a3', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Movement history API route (used by the drawer)**

Create `src/app/api/parts/[id]/movements/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMovementsByPartId } from '@/db/queries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const history = await getMovementsByPartId(id);
  return NextResponse.json(history);
}
```

- [ ] **Step 5: Movement form modal**

Create `src/app/(app)/inventario/MovementFormModal.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { createMovement } from './movementActions';
import type { ActionResult } from './actions';

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return createMovement(formData);
}

export default function MovementFormModal({ parts, onClose, onSuccess }: { parts: PartComputed[]; onClose: () => void; onSuccess: () => void }) {
  const [result, formAction, isPending] = useActionState(action, null);

  if (result && 'success' in result) {
    onSuccess();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form action={formAction} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440 }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>Registrar movimiento</div>

        <Field label="Repuesto">
          <select name="partId" required style={inputStyle}>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.description}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select name="type" required style={inputStyle} defaultValue="ingreso">
            <option value="ingreso">Ingreso</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </Field>
        <Field label="Cantidad">
          <input name="qty" type="number" required style={inputStyle} placeholder="Ej. 10 (usa negativo solo para ajustes)" />
        </Field>
        <Field label="Origen">
          <input name="fromLocation" required style={inputStyle} placeholder="Proveedor Michelin" />
        </Field>
        <Field label="Destino">
          <input name="toLocation" required style={inputStyle} placeholder="Almacén" />
        </Field>
        <Field label="Código de referencia">
          <input name="referenceCode" required style={inputStyle} placeholder="OC-1234" />
        </Field>

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

- [ ] **Step 6: Part form modal (create/edit)**

Create `src/app/(app)/inventario/PartFormModal.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { createPart, updatePart } from './partActions';
import type { ActionResult } from './actions';

export default function PartFormModal({
  groups, part, onClose, onSuccess,
}: {
  groups: { id: string; name: string }[];
  part: PartComputed | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
    return part ? updatePart(part.id, formData) : createPart(formData);
  }
  const [result, formAction, isPending] = useActionState(action, null);

  if (result && 'success' in result) {
    onSuccess();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form action={formAction} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440 }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>{part ? 'Editar repuesto' : 'Nuevo repuesto'}</div>

        <Field label="SKU">
          <input name="sku" required defaultValue={part?.sku} style={inputStyle} />
        </Field>
        <Field label="Descripción">
          <input name="description" required defaultValue={part?.description} style={inputStyle} />
        </Field>
        <Field label="Compatibilidad">
          <input name="compat" defaultValue={part?.compat} style={inputStyle} />
        </Field>
        <Field label="Grupo">
          <select name="groupId" required defaultValue={part?.groupId} style={inputStyle}>
            <option value="" disabled>Selecciona un grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Mínimo">
          <input name="minStock" type="number" min={0} required defaultValue={part?.minStock ?? 0} style={inputStyle} />
        </Field>

        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Guardar'}
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

- [ ] **Step 7: Group form modal (create)**

Create `src/app/(app)/inventario/GroupFormModal.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { createGroup } from './actions';
import type { ActionResult } from './actions';

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return createGroup(formData);
}

export default function GroupFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [result, formAction, isPending] = useActionState(action, null);

  if (result && 'success' in result) {
    onSuccess();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form action={formAction} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380 }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>Nuevo grupo</div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nombre</label>
        <input name="name" required style={{ width: '100%', padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 }} placeholder="Ej. Amortiguadores" />

        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, log in, go to `/inventario`.
Expected:
- List shows 24 seeded parts; searching "llanta" filters to the 4 llanta SKUs; selecting a group chip filters correctly.
- "+ Grupo" creates a new group that appears in the group filter dropdown.
- "+ Repuesto" creates a new part that appears in the table with stock 0 (Agotado).
- "+ Registrar ingreso" with type "Ingreso" and a positive quantity increases that part's stock in the table after the modal closes.
- Attempting a "Salida" larger than current stock shows the "Stock insuficiente" error instead of saving.
- Clicking a row opens the drawer with correct stock/min/rotation/compat and its movement history, showing your logged-in email as the actor.

- [ ] **Step 9: Commit**

```bash
git add src/app/(app)/inventario src/app/api/parts
git commit -m "feat: add Inventario page with CRUD, movement form and detail drawer"
```

---

### Task 14: Alertas page

**Files:**
- Create: `src/app/(app)/alertas/page.tsx`

**Interfaces:**
- Consumes: `getPartsWithMovements` (Task 6), `computeParts`, `buildAlerts` (Tasks 2-3), `Header` (Task 8).

- [ ] **Step 1: Build the page**

Create `src/app/(app)/alertas/page.tsx`:
```tsx
import Header from '@/components/Header';
import { getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';

const SEV_COLORS: Record<string, [string, string, string]> = {
  'Crítica': ['#fde8e8', '#c0322f', '#E23B3B'],
  'Alta': ['#fdeede', '#b3640f', '#e8870f'],
  'Media': ['#e8eefc', '#1846B3', '#1F56D6'],
};

export default async function AlertasPage() {
  const partsInput = await getPartsWithMovements();
  const parts = computeParts(partsInput);
  const alerts = buildAlerts(parts);
  const critCount = alerts.filter((a) => a.sev === 'Crítica').length;
  const altaCount = alerts.filter((a) => a.sev === 'Alta').length;
  const mediaCount = alerts.filter((a) => a.sev === 'Media').length;

  return (
    <>
      <Header title="Alertas automáticas" subtitle="Reposición, rotación y exceso de stock" alertCount={alerts.length} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
          <SummaryCard label="Críticas" value={critCount} sub="Agotado — reposición urgente" color="#E23B3B" textColor="#c0322f" />
          <SummaryCard label="Altas" value={altaCount} sub="Por debajo del mínimo" color="#e8870f" textColor="#b3640f" />
          <SummaryCard label="Medias" value={mediaCount} sub="Rotación lenta y exceso" color="#1F56D6" textColor="#1846B3" />
        </div>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef1f5', fontSize: 15, fontWeight: 800 }}>
            Todas las alertas <span style={{ fontWeight: 500, color: '#8a93a3' }}>· generadas automáticamente</span>
          </div>
          {alerts.map((a, i) => {
            const colors = SEV_COLORS[a.sev];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 20px', borderBottom: '1px solid #f3f4f7' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: colors[2] }} />
                <div style={{ width: 150, flex: 'none' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{a.tipo}</div>
                  <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, marginTop: 5, background: colors[0], color: colors[1] }}>{a.sev}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.desc} <span style={{ color: '#8a93a3', fontWeight: 500, fontSize: 12 }}>· {a.groupName}</span></div>
                  <div style={{ fontSize: 12.5, color: '#5b6472', marginTop: 2 }}>{a.detail}</div>
                </div>
                <div style={{ width: 210, flex: 'none', fontSize: 12.5, color: '#5b6472' }}>
                  <span style={{ color: '#8a93a3' }}>Sugerido:</span> {a.accion}
                </div>
              </div>
            );
          })}
          {alerts.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>No hay alertas activas.</div>}
        </div>
      </main>
    </>
  );
}

function SummaryCard({ label, value, sub, color, textColor }: { label: string; value: number; sub: string; color: string; textColor: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: textColor }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5b6472', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, go to `/alertas`.
Expected: counts match the seeded data (2 parts with 0 stock → 2 críticas; parts below min → altas; etc — matches the sidebar badge count from Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/alertas
git commit -m "feat: add Alertas page with live severity counts and list"
```

---

### Task 15: Movimientos page

**Files:**
- Create: `src/app/(app)/movimientos/page.tsx`
- Create: `src/app/(app)/movimientos/MovimientosView.tsx`

**Interfaces:**
- Consumes: `getRecentMovements` (Task 6), `getPartsWithMovements`/`computeParts`/`buildAlerts` for the header alert count, `Header` (Task 8).

- [ ] **Step 1: Server page**

Create `src/app/(app)/movimientos/page.tsx`:
```tsx
import Header from '@/components/Header';
import { getRecentMovements, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import MovimientosView from './MovimientosView';

export default async function MovimientosPage() {
  const [movements, partsInput] = await Promise.all([getRecentMovements(500), getPartsWithMovements()]);
  const alertCount = buildAlerts(computeParts(partsInput)).length;

  return (
    <>
      <Header title="Trazabilidad de movimientos" subtitle="Ingresos, salidas y ajustes" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <MovimientosView movements={movements} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Client view with type filter**

Create `src/app/(app)/movimientos/MovimientosView.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import type { MovementRow } from '@/db/queries';

const TYPE_COLORS: Record<string, [string, string, string]> = {
  ingreso: ['#e7f6ee', '#1b7a47', '#1f9d57'],
  salida: ['#fbf3d6', '#8a6a12', '#d4a813'],
  ajuste: ['#fde8e8', '#c0322f', '#E23B3B'],
};

const FILTERS = ['Todos', 'ingreso', 'salida', 'ajuste'] as const;
const FILTER_LABELS: Record<string, string> = { Todos: 'Todos', ingreso: 'Ingreso', salida: 'Salida', ajuste: 'Ajuste' };

export default function MovimientosView({ movements }: { movements: MovementRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todos');

  const filtered = useMemo(
    () => (filter === 'Todos' ? movements : movements.filter((m) => m.type === filter)),
    [movements, filter]
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
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
      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '8px 24px 18px' }}>
        {filtered.map((m) => {
          const colors = TYPE_COLORS[m.type];
          return (
            <div key={m.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #f3f4f7' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: colors[0], color: colors[1] }}>
                    {FILTER_LABELS[m.type]}
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>
                    <span style={{ color: m.qty >= 0 ? '#1b7a47' : '#c0322f' }}>{m.qty >= 0 ? '+' : '−'}{Math.abs(m.qty)} u.</span> {m.partDescription}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#5b6472', marginTop: 6 }}>
                  {m.fromLocation} → <b style={{ color: '#1b2230' }}>{m.toLocation}</b>{' '}
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, background: '#f1f3f6', padding: '2px 8px', borderRadius: 6 }}>{m.referenceCode}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none', fontSize: 12 }}>
                <div style={{ fontWeight: 700 }}>{new Date(m.createdAt).toLocaleString('es-PE')}</div>
                <div style={{ color: '#8a93a3', marginTop: 2 }}>por {m.userEmail}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>Sin movimientos para este filtro.</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, go to `/movimientos`. Expected: all seeded ingresos appear; filtering by "Salida" shows none yet (until Task 13's smoke test creates one); registering a new movement from `/inventario` makes it appear here after a refresh.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/movimientos
git commit -m "feat: add Movimientos page with type filtering"
```

---

### Task 16: Reportes page

**Files:**
- Create: `src/app/(app)/reportes/page.tsx`

**Interfaces:**
- Consumes: `getGroups`, `getPartsWithMovements` (Task 6); `computeParts`, `buildAlerts`, `buildComprasSugeridas`, `buildGroupBars`, `buildReportKpis` (Tasks 2-3); `Header` (Task 8).

- [ ] **Step 1: Build the page**

Create `src/app/(app)/reportes/page.tsx`:
```tsx
import Header from '@/components/Header';
import { getGroups, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts, buildComprasSugeridas, buildGroupBars, buildReportKpis } from '@/lib/inventory';

const PRIO_COLORS: Record<string, [string, string]> = { 'Crítica': ['#fde8e8', '#c0322f'], 'Alta': ['#fdeede', '#b3640f'] };

export default async function ReportesPage() {
  const [groups, partsInput] = await Promise.all([getGroups(), getPartsWithMovements()]);
  const parts = computeParts(partsInput);
  const alertCount = buildAlerts(parts).length;
  const compras = buildComprasSugeridas(parts);
  const groupBars = buildGroupBars(parts, groups);
  const reportKpis = buildReportKpis(parts, compras);

  const rotationRows = parts
    .filter((p) => p.stock > 0 && p.rotationDays !== null)
    .sort((a, b) => (b.rotationDays ?? 0) - (a.rotationDays ?? 0));

  return (
    <>
      <Header title="Reportes" subtitle="Decisiones de compra y rotación" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          <ReportKpiCard label="Unidades a reponer" value={String(reportKpis.unitsToReplenish)} sub={`${reportKpis.comprasCount} SKUs bajo mínimo`} />
          <ReportKpiCard label="SKUs en exceso" value={String(reportKpis.excessCount)} sub="candidatos a pausar compra" />
          <ReportKpiCard label="Rotación lenta" value={String(reportKpis.slowRotationCount)} sub="SKUs ≥ 60 días de cobertura" />
          <ReportKpiCard label="Cobertura" value={reportKpis.coverageRatio !== null ? `${reportKpis.coverageRatio}×` : '—'} sub="stock total vs mínimos" />
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef1f5', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Compras sugeridas</div>
              <div style={{ fontSize: 12, color: '#8a93a3', marginTop: 1 }}>SKUs bajo el stock mínimo, priorizados por urgencia.</div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fbfbfc' }}>
                <th style={thStyle}>SKU / Repuesto</th>
                <th style={thStyle}>Grupo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actual</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Mínimo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Sugerido</th>
                <th style={thStyle}>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((r) => (
                <tr key={r.sku}>
                  <td style={tdStyle}><div style={{ fontWeight: 700 }}>{r.desc}</div><div style={{ fontSize: 11.5, color: '#8a93a3', fontFamily: 'IBM Plex Mono, monospace' }}>{r.sku}</div></td>
                  <td style={tdStyle}>{r.groupName}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{r.actual}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#8a93a3' }}>{r.min}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#1F56D6' }}>+{r.sugerido}</td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: PRIO_COLORS[r.prio][0], color: PRIO_COLORS[r.prio][1] }}>{r.prio}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {compras.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#8a93a3' }}>No hay SKUs bajo el mínimo.</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Rotación por SKU</div>
            <div style={{ fontSize: 12, color: '#8a93a3', marginBottom: 14 }}>Días de cobertura estimados — menor es mejor.</div>
            {rotationRows.map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.sku}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5, fontWeight: 600 }}>{p.rotationDays} d</span>
                </div>
              </div>
            ))}
            {rotationRows.length === 0 && <div style={{ color: '#8a93a3', fontSize: 13 }}>Sin datos de rotación todavía.</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Inventario por grupo</div>
            <div style={{ fontSize: 12, color: '#8a93a3', marginBottom: 14 }}>Participación de cada grupo en el stock total.</div>
            {groupBars.map((g) => (
              <div key={g.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                  <span style={{ fontSize: 12.5, color: '#5b6472' }}><b>{g.count}</b> u. · {g.pct}%</span>
                </div>
                <div style={{ height: 8, background: '#eef1f5', borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${g.pct}%`, background: '#1F56D6', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function ReportKpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 18px 16px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a93a3' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5b6472', marginTop: 7 }}>{sub}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a93a3', padding: '12px 20px', borderBottom: '1px solid #eef1f5' };
const tdStyle: React.CSSProperties = { padding: '13px 20px', borderBottom: '1px solid #f3f4f7' };
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, go to `/reportes`. Expected: "Compras sugeridas" lists the same SKUs as the Críticas/Altas alerts; "Inventario por grupo" percentages sum to ~100%.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/reportes
git commit -m "feat: add Reportes page with purchase suggestions and rotation report"
```

---

### Task 17: End-to-end smoke test and cleanup

**Files:**
- None created — this task only verifies behavior across everything built so far.

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests across `inventory.test.ts` and `movementActions.test.ts` pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build completes with no TypeScript or ESLint errors.

- [ ] **Step 3: Manual smoke test — full flow**

With `npm run dev` running, walk through:
1. Log in as `admin@mileniummotos.pe` / `***REDACTED***`.
2. Dashboard shows non-zero KPIs.
3. Go to Inventario, create a new group "Amortiguadores".
4. Create a new part in that group: SKU `AMO-TEST`, description "Amortiguador de prueba", mínimo 5.
5. Register an "Ingreso" of 20 units for that part — confirm stock becomes 20 and status is "Disponible" in the table.
6. Register a "Salida" of 25 units for the same part — confirm it's rejected with the "Stock insuficiente" message.
7. Register a "Salida" of 18 units — confirm it succeeds and stock becomes 2, status becomes "Stock bajo".
8. Go to Alertas — confirm `AMO-TEST` now appears as "Alta / Stock bajo".
9. Go to Movimientos — confirm both movements for `AMO-TEST` appear (with your admin email as the actor), and filtering by "Salida" shows only the salida.
10. Go to Reportes — confirm `AMO-TEST` appears in "Compras sugeridas" with a sensible "Sugerido" quantity.
11. Click the `AMO-TEST` row in Inventario — confirm the drawer shows stock 2, mínimo 5, and both movements in the history.
12. Try to delete the "Amortiguadores" group while `AMO-TEST` still exists — confirm it's rejected.
13. Try to delete `AMO-TEST` itself — confirm it's rejected with "No se puede eliminar un repuesto con movimientos registrados." (it has movements from steps 5 and 7).
14. Log out — confirm redirect to `/login` and that `/` redirects back to `/login` when visited while logged out.

- [ ] **Step 4: Commit (if any fixes were needed during the smoke test)**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end smoke test"
```
(Skip this commit if the smoke test found no issues.)

---

### Task 18: Deploy to Vercel

**Files:**
- None created — this task is deployment configuration.

- [ ] **Step 1: Push the repository to a remote (GitHub)**

If not already done, create a GitHub repository and push:
```bash
git remote add origin <your-repo-url>
git push -u origin master
```

- [ ] **Step 2: Import the project in Vercel**

In the Vercel dashboard, import the GitHub repository as a new project. Accept the default Next.js build settings.

- [ ] **Step 3: Set environment variables in Vercel**

In the Vercel project's Settings → Environment Variables, add for the Production (and Preview, if desired) environment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (only needed if you plan to re-run the seed script against production from CI; not required for the app to run)
- `DATABASE_URL` — the same Supabase pooled connection string from `.env.local`.
- `DIRECT_DATABASE_URL` — the same Supabase direct connection string.

- [ ] **Step 4: Deploy**

Trigger a deploy (push to `master`, or click "Deploy" in the Vercel dashboard).
Expected: build succeeds; visiting the deployed URL redirects to `/login`; logging in with the seeded admin credentials works and shows real data (the same Supabase project used in development).

- [ ] **Step 5: Confirm production smoke test**

Repeat a shortened version of Task 17's flow against the production URL: log in, view dashboard, register one test movement, confirm it appears in Movimientos.

---

## Self-Review Notes

- **Spec coverage:** Login via Supabase Auth (Task 7), Dashboard (Task 9), Inventario + CRUD + movement form + drawer (Tasks 10-13), Alertas (Task 14), Movimientos (Task 15), Reportes (Task 16), validations (stock guard in Task 12, uniqueness/required-field checks in Tasks 10-11, group/part deletion guards in Tasks 10-11), seed data (Task 5), unit tests on calculation logic (Tasks 2-3, 12), manual smoke test (Task 17), deployment (Task 18) — every section of the spec maps to at least one task.
- **Type consistency:** `PartComputed`, `MovementInput`, `MovementRow`, `ActionResult`, `MovementType` are defined once (Tasks 2, 6, 10, 12) and imported everywhere else — checked for consistent naming across all later tasks, including the `userName` → `userEmail` rename now that identity comes from Supabase Auth instead of a local `users` table.
- **No placeholders:** every step has runnable code or an exact command.
- **Auth rework:** this plan replaces the earlier Auth.js + local `users` table design with Supabase Auth end-to-end — no local password table, no bcrypt, no Auth.js dependency. `movements.user_id` stores the Supabase Auth user id (no FK, since `auth.users` lives in Supabase's managed schema) and `movements.user_email` snapshots the email for display without needing to query the `auth` schema.
