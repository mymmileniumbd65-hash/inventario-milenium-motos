# Combobox con búsqueda para "Repuesto" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el `<select>` nativo del campo "Repuesto" en el modal Registrar movimiento por un combobox propio con búsqueda al escribir.

**Architecture:** Una función pura `filterParts` en `partSearch.ts` (testeada con Vitest), un client component `PartCombobox.tsx` que la usa y expone la selección vía `<input type="hidden" name="partId">`, y la integración en `MovementFormModal.tsx` con un guard de submit. El server action `createMovement` no cambia.

**Tech Stack:** Next.js App Router, React 19 (client components), TypeScript, Vitest. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-07-02-part-combobox-design.md`

## Global Constraints

- Sin framework CSS ni librerías de UI: estilos inline (`React.CSSProperties`), como el resto de la app.
- Sin dependencias nuevas en `package.json`.
- El server action `createMovement` y el nombre de campo `partId` no cambian.
- Copy en español: placeholder `Buscar por SKU o nombre…`, error `Selecciona un repuesto de la lista`, vacío `Sin coincidencias.`
- Formato de opción: `SKU · descripción` (separador `·` U+00B7, igual que el `<select>` actual).
- No hay navegador en el sandbox: la verificación de UI interactiva queda para el usuario; aquí se verifica con `npm test`, `npm run lint` y `npm run build`.

---

### Task 1: `filterParts` — lógica pura de búsqueda con tests

**Files:**
- Create: `src/app/(app)/inventario/partSearch.ts`
- Test: `src/app/(app)/inventario/partSearch.test.ts`

**Interfaces:**
- Consumes: nada (función pura, sin imports del proyecto).
- Produces: `filterParts<T extends { sku: string; description: string }>(parts: T[], query: string): T[]` — usada por Task 2. Genérica para que los tests usen objetos mínimos y el componente le pase `PartComputed[]` sin casts.

- [ ] **Step 1: Write the failing tests**

Crear `src/app/(app)/inventario/partSearch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterParts } from './partSearch';

const parts = [
  { sku: 'PAR-17', description: 'Parabrisas 17" cristal' },
  { sku: 'PAR-19', description: 'Parabrisas 19" ahumado' },
  { sku: 'LLA-8017', description: 'Llanta 80/100-17' },
  { sku: 'CAD-428', description: 'Cadena 428H · 120L' },
];

describe('filterParts', () => {
  it('devuelve todo con query vacía', () => {
    expect(filterParts(parts, '')).toEqual(parts);
  });

  it('devuelve todo con query de solo espacios', () => {
    expect(filterParts(parts, '   ')).toEqual(parts);
  });

  it('filtra por SKU, sin distinguir mayúsculas', () => {
    expect(filterParts(parts, 'lla-80')).toEqual([parts[2]]);
  });

  it('filtra por descripción, sin distinguir mayúsculas', () => {
    expect(filterParts(parts, 'PARABRISAS')).toEqual([parts[0], parts[1]]);
  });

  it('ignora tildes en la query y en los datos', () => {
    const conTilde = [{ sku: 'AMO-1', description: 'Amortiguador hidráulico' }];
    expect(filterParts(conTilde, 'hidraulico')).toEqual(conTilde);
    expect(filterParts(parts, 'cádena')).toEqual([parts[3]]);
  });

  it('devuelve [] sin coincidencias', () => {
    expect(filterParts(parts, 'zzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/(app)/inventario/partSearch.test.ts"`
Expected: FAIL — `Cannot find module './partSearch'` (o equivalente de resolución).

- [ ] **Step 3: Write the implementation**

Crear `src/app/(app)/inventario/partSearch.ts`:

```ts
// Lógica pura de búsqueda del PartCombobox — sin JSX ni imports de React,
// en archivo aparte para poder testearla en Vitest (mismo patrón que movementLogic.ts).

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function filterParts<T extends { sku: string; description: string }>(parts: T[], query: string): T[] {
  const q = normalize(query.trim());
  if (q === '') return parts;
  return parts.filter((p) => normalize(p.sku).includes(q) || normalize(p.description).includes(q));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/(app)/inventario/partSearch.test.ts"`
Expected: PASS — 6 tests.

Run también la suite completa para confirmar que nada se rompió: `npm test`
Expected: PASS (los tests existentes de `inventory.test.ts` + los 6 nuevos).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/inventario/partSearch.ts" "src/app/(app)/inventario/partSearch.test.ts"
git commit -m "feat(inventario): logica pura de busqueda de repuestos (filterParts)"
```

---

### Task 2: Componente `PartCombobox` + integración en el modal

**Files:**
- Create: `src/app/(app)/inventario/PartCombobox.tsx`
- Modify: `src/app/(app)/inventario/MovementFormModal.tsx` (reemplaza el `<select>` de las líneas 24–28 y añade guard de submit)

**Interfaces:**
- Consumes: `filterParts` de `./partSearch` (Task 1); `PartComputed` de `@/lib/inventory` (campos usados: `id`, `sku`, `description`).
- Produces: `PartCombobox({ parts, name }: { parts: PartComputed[]; name: string })` — default export. Emite `<input type="hidden" name={name} value={idSeleccionado} />` dentro del form que lo contenga; value queda `''` si no hay selección válida.

- [ ] **Step 1: Create the component**

Crear `src/app/(app)/inventario/PartCombobox.tsx`:

```tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { filterParts } from './partSearch';

function labelOf(p: { sku: string; description: string }): string {
  return `${p.sku} · ${p.description}`;
}

export default function PartCombobox({ parts, name }: { parts: PartComputed[]; name: string }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => filterParts(parts, query), [parts, query]);

  function select(p: PartComputed) {
    setSelectedId(p.id);
    setQuery(labelOf(p));
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) {
        e.preventDefault();
        select(matches[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      style={{ position: 'relative' }}
      onBlur={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <input
        type="text"
        value={query}
        placeholder="Buscar por SKU o nombre…"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setSelectedId(''); setHighlight(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 }}
      />
      <input type="hidden" name={name} value={selectedId} />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, background: '#fff', border: '1px solid #e3e6ec', borderRadius: 9, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(20,26,38,0.12)' }}>
          {matches.length === 0 && (
            <div style={{ padding: '9px 12px', fontSize: 13.5, color: '#8a93a3' }}>Sin coincidencias.</div>
          )}
          {matches.map((p, i) => (
            <div
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
              onMouseEnter={() => setHighlight(i)}
              style={{ padding: '9px 12px', fontSize: 13.5, cursor: 'pointer', background: i === highlight ? '#eef3fd' : '#fff' }}
            >
              {labelOf(p)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Notas de comportamiento que el código de arriba ya cumple (no reimplementar distinto):
- `onMouseDown` con `preventDefault` (no `onClick`) en las opciones, para que el blur del input no cierre la lista antes de que llegue el click.
- Editar el texto tras seleccionar limpia `selectedId` (queda `''`) — lo exige el spec.
- `ArrowDown` con la lista cerrada solo la abre; con la lista abierta mueve el resaltado.

- [ ] **Step 2: Integrate into MovementFormModal**

En `src/app/(app)/inventario/MovementFormModal.tsx`, aplicar estos tres cambios exactos:

1. Imports — añadir `useState` y el componente:

```tsx
// antes
import { useActionState, useEffect } from 'react';
// después
import { useActionState, useEffect, useState } from 'react';
import PartCombobox from './PartCombobox';
```

2. Dentro del componente, junto al `useActionState` existente, añadir estado de error local, y en el `<form>` un guard de submit (los inputs hidden no participan en la validación nativa del navegador; React ejecuta `onSubmit` antes de despachar la action, y `preventDefault` la cancela):

```tsx
const [localError, setLocalError] = useState<string | null>(null);
```

```tsx
// antes
<form action={formAction} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440 }}>
// después
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
```

3. Reemplazar el `<select>` del campo Repuesto y mostrar el error local reutilizando el mismo estilo del error del server:

```tsx
// antes
<Field label="Repuesto">
  <select name="partId" required style={inputStyle}>
    {parts.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.description}</option>)}
  </select>
</Field>
// después
<Field label="Repuesto">
  <PartCombobox parts={parts} name="partId" />
</Field>
```

```tsx
// antes (bloque de error existente, dejarlo igual y añadir el de localError encima)
{result && 'error' in result && (
// después
{localError && (
  <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
    {localError}
  </div>
)}
{result && 'error' in result && (
```

- [ ] **Step 3: Verify with lint, tests and build**

Run: `npm run lint`
Expected: sin errores.

Run: `npm test`
Expected: PASS (suite completa).

Run: `npm run build`
Expected: build de producción sin errores (verifica tipos del TSX nuevo).

- [ ] **Step 4: Smoke-check server render**

Con `npm run dev` corriendo en background, verificar que `/inventario` sigue sirviendo HTML (el modal es client-only, así que basta con que la página no rompa):

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/inventario
```

Expected: `307` (redirect a `/login` si no hay sesión) o `200` con sesión — cualquiera de los dos confirma que la página compila y responde. Parar el dev server después.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/inventario/PartCombobox.tsx" "src/app/(app)/inventario/MovementFormModal.tsx"
git commit -m "feat(inventario): combobox con busqueda para elegir repuesto en Registrar movimiento"
```

---

## Verificación final (usuario)

El click-through real del combobox es UI client-only dentro de un modal — fuera del alcance de curl. Tras completar las tareas, pedir al usuario que verifique en su navegador:

1. Abrir "Registrar ingreso" → el campo Repuesto empieza vacío con placeholder.
2. Escribir `llan` → solo aparecen las llantas; `parabrisas` sin tilde también encuentra.
3. Flechas ↑/↓ + Enter seleccionan sin enviar el formulario; Esc cierra la lista.
4. Registrar sin seleccionar → aparece "Selecciona un repuesto de la lista" y no se envía.
5. Seleccionar un repuesto, completar el resto y Registrar → el movimiento se crea como antes.
