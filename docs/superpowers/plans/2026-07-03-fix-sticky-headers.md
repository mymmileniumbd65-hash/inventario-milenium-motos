# Fix Sticky Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the root cause of the persistent visual gap in Movimientos' sticky filter bar (a prior fix using negative margins didn't work), and apply the same clean sticky-header pattern to add a fixed toolbar to the Inventario page.

**Architecture:** Both pages currently give `<main>` its own padding (`26px 28px 40px`), which forces any sticky child to either live inside that padding (leaving an uncovered gap, the original bug) or fight it with negative margins (the attempted fix, which didn't work and is suspected to interact badly with CSS margin collapsing on a `position: sticky` element). This plan removes `<main>`'s padding entirely on both pages and moves that spacing directly onto the sticky element's own `padding` (no margins involved) plus a plain, non-sticky wrapper `<div>` around everything below it. No margin cancellation is needed anywhere.

**Tech Stack:** Next.js App Router, TypeScript. No new dependencies — pure CSS/JSX restructuring, no business logic changes.

## Global Constraints

- UI text stays in Spanish, matching the existing tone (this plan touches no copy).
- No CSS framework — inline `style` objects, same as the rest of the codebase.
- No margins (negative or otherwise) on any `position: sticky` element in this plan — padding only, per the spec's root-cause analysis.
- The visual result (spacing, positions of every element) must be pixel-equivalent to the state before Task 3 of the prior plan (i.e., before the negative-margin attempt) — this is a structural fix, not a redesign.
- Scope is limited to the toolbar/filter-bar row on each page. The Inventario table's own column-header row (`<thead>`) is explicitly out of scope for this plan.
- Spec de referencia: `docs/superpowers/specs/2026-07-03-fix-sticky-headers-design.md`.

---

### Task 1: Movimientos — remove the sticky-gap root cause

**Files:**
- Modify: `src/app/(app)/movimientos/page.tsx` (remove `<main>`'s padding)
- Modify: `src/app/(app)/movimientos/MovimientosView.tsx` (sticky div: padding instead of margin+padding; wrap the rest in a padded div)

**Interfaces:**
- Consumes: `MovimientosView`'s existing `{ movements, year, month, currentYear }` props — unchanged.
- Produces: no interface change. Task 2 is a fully independent file (Inventario), not affected by this task's output.

- [ ] **Step 1: Remove `<main>`'s padding in `page.tsx`**

In `src/app/(app)/movimientos/page.tsx`, replace:

```tsx
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
```

by:

```tsx
      <main style={{ flex: 1, overflow: 'auto' }}>
```

- [ ] **Step 2: Replace the sticky wrapper and wrap the rest of the content in `MovimientosView.tsx`**

Replace the entire `return (...)` block of `src/app/(app)/movimientos/MovimientosView.tsx` — i.e. everything from `return (` down to the matching closing `);` right before the function's closing `}` — with:

```tsx
  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', padding: '26px 28px 14px' }}>
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
      <div style={{ padding: '0 28px 40px' }}>
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
    </div>
  );
```

Nothing else in the file changes: the imports, `TYPE_COLORS`, `FILTERS`, `FILTER_LABELS`, `MONTH_NAMES`, the component's props/state/`useMemo`/`goToDate`/`handleReverse`, and the trailing `const selectStyle = ...` constant all stay exactly as they are — only the JSX returned by the component changes (the sticky div's `style` loses `margin` and its `padding` changes from `'30px 28px 14px'` to `'26px 28px 14px'`; a new wrapping `<div style={{ padding: '0 28px 40px' }}>` is added around the error box and the movements card, which are otherwise unchanged).

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS (no test covers inline CSS/JSX structure; the existing 32 tests must stay green as a regression check).

- [ ] **Step 5: Manual verification (critical — read before marking this task done)**

This is a pure visual/CSS fix with no server-renderable signal `curl` can check. Ask the user to confirm in the browser:
1. Scrolling the Movimientos list down no longer reveals any movement row between the page title and the sticky bar — **at any scroll position**, not just briefly.
2. The initial (unscrolled) spacing looks the same as before (same gaps around the month/year selects, the filter pills, and the movements card).

**If the gap still appears after this fix:** per `superpowers:systematic-debugging`, do not attempt a third variation of the same padding/margin technique. Stop and report back — the next step would be questioning whether `position: sticky` is the right mechanism at all for this layout (e.g., switching to an `IntersectionObserver`-based approach), which needs a human decision, not another guess.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/movimientos/page.tsx" "src/app/(app)/movimientos/MovimientosView.tsx"
git commit -m "fix(movimientos): eliminar causa raiz del hueco sticky (sin margenes negativos)"
```

---

### Task 2: Inventario — sticky toolbar (search/filter/buttons)

**Files:**
- Modify: `src/app/(app)/inventario/page.tsx` (remove `<main>`'s padding)
- Modify: `src/app/(app)/inventario/InventarioView.tsx` (toolbar div: sticky + own padding; wrap the rest in a padded div)

**Interfaces:**
- Consumes: `InventarioView`'s existing `{ groups, parts }` props — unchanged.
- Produces: no interface change. Independent of Task 1 (different files entirely).

- [ ] **Step 1: Remove `<main>`'s padding in `page.tsx`**

In `src/app/(app)/inventario/page.tsx`, replace:

```tsx
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
```

by:

```tsx
      <main style={{ flex: 1, overflow: 'auto' }}>
```

- [ ] **Step 2: Make the toolbar sticky and wrap the rest of the content in `InventarioView.tsx`**

Replace the entire `return (...)` block of `src/app/(app)/inventario/InventarioView.tsx` — i.e. everything from `return (` down to the matching closing `);` right before the function's closing `}` — with:

```tsx
  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', padding: '26px 28px 16px', display: 'flex', gap: 12 }}>
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
        <button onClick={() => setShowGroupManager(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          Grupos
        </button>
        <button onClick={() => setShowPartForm('new')} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          + Repuesto
        </button>
        <button onClick={() => setShowMovementForm(true)} style={{ padding: '10px 16px', background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          + Registrar ingreso
        </button>
      </div>

      <div style={{ padding: '0 28px 40px' }}>
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
      </div>

      {selectedPart && (
        <PartDrawer
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
          onEdit={(p) => { setSelectedPart(null); setShowPartForm(p); }}
          onDeleted={() => { setSelectedPart(null); refresh(); }}
          onChanged={refresh}
        />
      )}
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
      {showGroupManager && (
        <GroupManagerModal
          groups={groups}
          onClose={() => setShowGroupManager(false)}
          onChanged={refresh}
        />
      )}
    </div>
  );
```

Nothing else in the file changes: imports, `STATUS_COLORS`, the component's props/state/`useMemo`/`refresh`, and the trailing `thStyle`/`tdStyle` constants all stay exactly as they are. The only differences from the current JSX: the toolbar `<div>` gains `position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9'` and its `padding: '26px 28px 16px'` replaces the old `marginBottom: 16` (the 16px bottom padding reproduces the exact same gap the old `marginBottom` gave); a new `<div style={{ padding: '0 28px 40px' }}>` wraps the SKU-count line and the table card (previously they relied on `<main>`'s own padding, which is now gone).

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS (no test covers this page's JSX; 32 tests stay green).

- [ ] **Step 5: Verification with server + curl**

Run: `npm run dev` (in background) and `curl` against `/inventario` with a valid session cookie.
Expected: the server-rendered HTML still contains the search input, group `<select>`, "Grupos"/"+ Repuesto"/"+ Registrar ingreso" buttons, the SKU/unit count line, and the full parts table — same content as before, just reorganized into two wrapper `<div>`s instead of one.

- [ ] **Step 6: Manual verification**

Ask the user to confirm in the browser: scrolling the Inventario table down keeps the search bar, group filter, and the 3 buttons fixed at the top (no gap, no flicker), and the initial (unscrolled) spacing looks unchanged.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/inventario/page.tsx" "src/app/(app)/inventario/InventarioView.tsx"
git commit -m "feat(inventario): barra superior fija al hacer scroll"
```

---

## Verificación final

Tras completar las 2 tareas:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: los tres comandos sin errores. Luego, pedir al usuario una pasada manual en el navegador: confirmar que el hueco de Movimientos desapareció por completo (no solo se cubrió visualmente), y que la nueva barra fija de Inventario funciona igual de bien.
