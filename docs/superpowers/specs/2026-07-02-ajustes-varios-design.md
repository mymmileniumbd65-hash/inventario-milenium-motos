# Ajustes varios — Inventario, Movimientos, Reportes y Panel general

## Contexto

Tras probar la app en un navegador real, el usuario detectó 6 problemas/mejoras puntuales sobre módulos ya implementados (Inventario, Movimientos, Reportes, Panel general). Ninguno cambia el alcance ni la arquitectura de la app — son correcciones de UX y un bug de cálculo de negocio, más un campo nuevo opcional.

Rama de trabajo: `feat/cambios-varios`.

## Alcance

**Incluido**, en el orden en que se acordaron con el usuario:

1. Modal "Registrar movimiento": placeholder de "Origen" dinámico según tipo; quitar el campo "Destino".
2. Fix del cálculo de "Rotación" (bug: movimientos anulados se contaban como demanda real).
3. Reportes: quitar tarjetas "SKUs en exceso" y "Cobertura"; heredar el fix de rotación.
4. Panel general: quitar tarjetas "Unidades en stock" y "Rotación promedio"; quitar "Rotación más lenta" (duplicada con Reportes).
5. Movimientos: filtro por mes/año (consulta al servidor, ya no un límite fijo de 500 filas); mes actual por defecto; barra de filtros Todos/Ingreso/Salida/Ajuste con `position: sticky`.
6. Campo "Comentarios" opcional al registrar un movimiento, visible en Movimientos y en el drawer del repuesto.

**Fuera de alcance:**
- Cualquier cambio a la lógica de anulación (`reverseMovement`) más allá de que la excluya del cálculo de rotación.
- Cambios al modelo de un solo almacén (se sigue asumiendo `to_location = "Almacén"` siempre).
- Comentarios en el propio flujo de anulación (el botón "Anular" no pide texto).
- Paginación infinita o exportación de movimientos — el filtro de mes/año resuelve el problema de "lista demasiado larga" sin necesidad de scroll infinito.

## 1. Modal "Registrar movimiento" — Origen dinámico, quitar Destino

**Problema:** el campo "Origen" siempre sugiere `Proveedor Michelin` como placeholder, sin importar el tipo de movimiento (Ingreso/Salida/Ajuste). El campo "Destino" siempre pide "Almacén", pero solo existe un almacén — pedirlo no aporta nada.

**Comportamiento deseado:**
- El `<select name="type">` de `MovementFormModal.tsx` pasa a ser un componente controlado (`useState`). El placeholder del input "Origen" cambia según el valor seleccionado:
  - Ingreso → `Proveedor`
  - Salida → `Cliente`
  - Ajuste → `Proveedor o Cliente`
- El campo "Destino" desaparece del formulario.
- `createMovement` (en `movementActions.ts`) ya no lee `toLocation` del `FormData`; lo fija siempre a la constante `"Almacén"` antes de insertar en `movements`.
- Sin cambios de esquema: la columna `to_location` sigue `NOT NULL`, solo que ahora la llena el servidor en vez del usuario.
- La reversión (`reverseMovement`) sigue intercambiando `fromLocation`/`toLocation` del movimiento original; como `toLocation` original ya será siempre `"Almacén"`, el comportamiento no cambia.

## 2. Fix del cálculo de "Rotación"

**Problema (causa raíz confirmada leyendo `src/lib/inventory.ts:35-44`):** `computeRotationDays` calcula la velocidad diaria de salida sumando **todos** los movimientos de tipo `salida` dentro de una ventana de 90 días — incluyendo salidas que luego fueron **anuladas**. Una salida anulada queda compensada por un `ajuste` (tipo distinto de `salida`), pero el movimiento `salida` original nunca se edita ni se borra (el ledger es inmutable), así que sigue contando como demanda real.

Ejemplo reportado: ingreso de 8 unidades y salida de 2 unidades el mismo día; la salida se anula de inmediato. Resultado observado: `rotationDays = round(8 / (2/90)) = 360 d`, un valor absurdo para actividad del mismo día. Sin el bug, al no haber ninguna salida real neta, el resultado correcto es "sin datos de rotación" (`null`).

**Comportamiento deseado:**
- `MovementInput` (interfaz pura en `src/lib/inventory.ts`) gana dos campos: `id: string` y `reversesMovementId: string | null`.
- `computeRotationDays` construye, igual que ya hacen `MovimientosView` y `PartDrawer` en la UI, un `Set` de IDs anulados (`movements.map(m => m.reversesMovementId).filter(...)`) y excluye del cómputo de `salidaUnits` cualquier movimiento `salida` cuyo `id` esté en ese set. Los `ajuste` compensatorios ya se excluían por tipo — no cambia.
- `computeStock` **no cambia**: el saldo neto (+8 −2 +2 = 8) ya es correcto tal cual, porque el ajuste compensatorio cancela numéricamente a la salida anulada.
- `getPartsWithMovements` (en `src/db/queries.ts`) debe incluir `id` y `reversesMovementId` al construir cada `MovementInput` (hoy solo pasa `type`, `qty`, `createdAt`).
- `PartDrawer.tsx` (líneas ~47-48) construye objetos de movimiento al vuelo, a partir de `history: MovementRow[]`, para recalcular stock/rotación en vivo tras una anulación sin recargar el drawer — debe pasar también `id` y `reversesMovementId` a `computeStock`/`computeRotationDays`.

## 3. Reportes — quitar tarjetas, heredar el fix

**Problema:** las tarjetas "SKUs en exceso" y "Cobertura" (stock total vs mínimos) no aportan valor accionable, según el usuario. Además, "Rotación por SKU" y "Rotación lenta" (SKUs ≥ 60 días) hoy muestran los valores incorrectos descritos en la sección 2.

**Comportamiento deseado:**
- Quitar las tarjetas "SKUs en exceso" y "Cobertura" de `reportes/page.tsx`. El grid de KPIs pasa de `repeat(4,1fr)` a `repeat(2,1fr)`, quedando solo "Unidades a reponer" y "Rotación lenta".
- `ReportKpis`/`buildReportKpis` (en `inventory.ts`) pierden los campos `excessCount` y `coverageRatio` (y su cómputo asociado).
- "Rotación por SKU" y "Rotación lenta" no requieren cambios propios: al consumir `parts[].rotationDays` (que ya viene corregido por la sección 2), automáticamente reflejan el fix.

## 4. Panel general — quitar tarjetas poco útiles y duplicadas

**Problema:** "Unidades en stock" (338, 28 SKUs · 26 con stock) y "Rotación promedio" (185 d, mezcla de todos los SKUs) no ayudan según el usuario. Además, "Rotación más lenta" duplica la información de "Rotación por SKU" en Reportes.

**Comportamiento deseado:**
- Quitar las tarjetas KPI "Unidades en stock" y "Rotación promedio" de `page.tsx` (Dashboard). El grid pasa de `repeat(5,1fr)` a `repeat(3,1fr)`, quedando "Grupos", "Alertas activas" y "Movimientos (7d)".
- Quitar por completo la tarjeta "Rotación más lenta" (columna derecha); esa columna queda solo con "Stock por grupo".
- `buildDashboardKpis` (en `inventory.ts`) pierde los campos ya no usados: `totalUnits`, `inStockSkus`, `avgRotationDays` (y su cómputo). `totalSkus` se mantiene porque lo sigue usando la tarjeta "Grupos".
- La variable `slowest` y su cómputo en `page.tsx` se eliminan.

## 5. Movimientos — filtro por mes/año, mes actual por defecto, barra sticky

**Problema:** `movimientos/page.tsx` carga siempre los últimos 500 movimientos sin filtro de fecha; a medida que crezcan los movimientos, la lista será cada vez más larga e incompleta (corta en 500). El filtro Todos/Ingreso/Salida/Ajuste es client-side sobre esa lista ya cargada. Además, al hacer scroll hacia abajo, esa barra de filtros desaparece de la vista.

**Comportamiento deseado:**
- Nueva función `getMovementsForMonth(year: number, month: number): Promise<MovementRow[]>` en `src/db/queries.ts`, que filtra `movements` por rango de fechas (`createdAt >= inicio de mes` y `< inicio del mes siguiente`) en vez de aplicar un límite fijo.
- `movimientos/page.tsx` lee `year`/`month` de `searchParams`; si no vienen, usa el mes/año actual (fecha del servidor). Llama a `getMovementsForMonth` con esos valores.
- `MovimientosView` gana un selector de mes/año tipo `‹ Julio 2026 ›` con flechas para navegar mes a mes; cada cambio navega (`router.push`) a la misma ruta con `?year=YYYY&month=M` actualizado, disparando una nueva carga server-side.
- La barra de filtros "Todos/Ingreso/Salida/Ajuste" pasa a `position: sticky; top: 0` con fondo opaco y `z-index` por encima de las filas, para que quede fija al hacer scroll dentro del `<main>` (que ya tiene `overflow: auto`).

## 6. Campo "Comentarios" opcional

**Problema:** hoy no hay forma de anotar contexto libre sobre un movimiento (por qué se hizo, detalles del cliente/proveedor, etc.).

**Comportamiento deseado:**
- Migración de base de datos: nueva columna `comment` (`text`, nullable) en la tabla `movements` (`src/db/schema.ts`), generada con `npm run db:generate` y aplicada con `npm run db:push`.
- `MovementFormModal.tsx`: nuevo campo "Comentarios" (textarea), **opcional**, visible para los 3 tipos de movimiento (el formulario es único, no se oculta condicionalmente por tipo).
- `createMovement` (en `movementActions.ts`) guarda el comentario si viene no vacío; si viene vacío, guarda `null`.
- `MovementRow` (en `queries.ts`) y las 3 queries de movimientos (`getRecentMovements`/`getMovementsByPartId`/`getMovementsForMonth`) devuelven el campo `comment`.
- `MovimientosView` y `PartDrawer`: si el movimiento tiene comentario, se muestra como texto pequeño (gris, itálica) debajo de la línea origen→destino/referencia. Si no tiene, no se muestra nada (sin placeholder tipo "Sin comentarios").
- La reversión (`reverseMovement`) no pide ni copia comentario — el movimiento de anulación se genera sin comentario propio, igual que ya no copia otros campos libres del original.

## Resumen de archivos afectados

- `src/lib/inventory.ts` — `MovementInput` (+ `id`, `+reversesMovementId`), `computeRotationDays` (fix), `ReportKpis`/`buildReportKpis` (-2 campos), `DashboardKpis`/`buildDashboardKpis` (-3 campos).
- `src/db/schema.ts` — nueva columna `comment` en `movements`.
- `src/db/queries.ts` — `getPartsWithMovements` (propaga `id`/`reversesMovementId`), nueva `getMovementsForMonth`, `MovementRow`/queries existentes (+`comment`).
- `src/app/(app)/inventario/MovementFormModal.tsx` — placeholder dinámico, quitar Destino, agregar Comentarios.
- `src/app/(app)/inventario/movementActions.ts` — `toLocation` fijo a `"Almacén"`, persistir `comment`.
- `src/app/(app)/inventario/PartDrawer.tsx` — pasar `id`/`reversesMovementId` al recomputar en vivo, mostrar comentario.
- `src/app/(app)/movimientos/page.tsx` y `MovimientosView.tsx` — filtro mes/año, barra sticky, mostrar comentario.
- `src/app/(app)/reportes/page.tsx` — quitar 2 tarjetas.
- `src/app/(app)/page.tsx` (Dashboard) — quitar 3 tarjetas/bloques.

## Testing

- `src/lib/inventory.ts` ya tiene cobertura de tests unitarios (Vitest) para stock/estado/alertas/rotación — el fix de la sección 2 necesita un caso de prueba nuevo: salida anulada el mismo día no debe producir un `rotationDays` inflado (debe dar `null` si no queda ninguna salida real neta en la ventana).
- El resto de cambios (UI, queries, migración) se verifican con el patrón ya establecido en el proyecto: `npm run dev` + `curl` para lo server-rendered, y verificación manual en navegador por parte del usuario para los formularios/modales client-side (igual que quedó documentado para el resto de Inventario).
