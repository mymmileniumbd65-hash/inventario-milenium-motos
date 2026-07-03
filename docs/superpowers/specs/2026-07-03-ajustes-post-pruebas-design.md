# Ajustes post-pruebas — Rotación dinámica, selector de mes/año, barra sticky

## Contexto

Tras completar y revisar el plan `2026-07-02-ajustes-varios` (6 tareas: fix de rotación por anulados, limpieza de Reportes/Panel general, modal de movimiento, comentarios, filtro de mes/año), el usuario probó los cambios en un navegador real sobre la rama `feat/cambios-varios` y reportó 3 observaciones nuevas.

Rama de trabajo: `feat/cambios-varios` (continúa sobre la misma rama, sin mergear a `master` todavía).

## Alcance

**Incluido:**

1. Ventana dinámica en el cálculo de rotación, para SKUs con menos de 90 días de historial real.
2. Selector de mes/año con 2 `<select>` (mes y año) en vez del label con flechas ‹ ›.
3. Fix del hueco visual en la barra fija (sticky) de Movimientos al hacer scroll.

**Fuera de alcance:**
- Cualquier otro cambio a la fórmula de rotación más allá de la ventana dinámica (el piso de 90 días para SKUs con historial largo, y la exclusión de movimientos anulados de la Task 1, no cambian).
- Un date-picker de calendario completo (día específico) para Movimientos — se descartó explícitamente a favor de 2 selects, ya que el filtro real es por mes/año, no por día.
- Cambios a la paginación/consulta de `getMovementsForMonth` más allá de lo que ya hace (sigue siendo por mes calendario completo).

## 1. Rotación — ventana dinámica para SKUs con poco historial

**Problema:** `computeRotationDays` (en `src/lib/inventory.ts`) usa una ventana fija de 90 días para calcular la velocidad diaria de salida (`salidaUnits / 90`). Para un SKU con muy poco historial real (ej. ingresado ayer, vendido hoy), esto diluye una venta reciente sobre 90 días completos, dando un número de "días de cobertura" absurdamente alto (ej. 144 días) aunque toda la actividad ocurrió en las últimas 24-48 horas.

**Comportamiento deseado:**
- Se calcula `earliestMovementDate`: la fecha (`createdAt`) del movimiento más antiguo de ese SKU, de cualquier tipo (ingreso/salida/ajuste), incluyendo movimientos anulados o de anulación (cuentan para "cuánto historial real tiene este SKU", aunque no cuenten como demanda).
- `windowDays = Math.min(90, Math.max(1, (now.getTime() - earliestMovementDate.getTime()) / (24*60*60*1000)))` — días transcurridos como valor continuo (fraccionario), no redondeado a día calendario. El piso de 1 día evita divisiones por valores extremadamente pequeños cuando todo el historial ocurrió en las últimas horas.
- La ventana de tiempo para filtrar `salidaUnits` (qué salidas cuentan como demanda) pasa de "últimos 90 días fijos" a "últimos `windowDays` días" — es decir, `windowStart = now - windowDays` en vez de `now - 90`.
- `salidaUnits` se sigue calculando exactamente igual que hoy sobre esa ventana: suma de movimientos `salida` no anulados con `createdAt >= windowStart` (el fix de la Task 1, que excluye anulados, no cambia).
- `dailyVelocity = salidaUnits / windowDays` (antes `salidaUnits / 90`).
- `rotationDays = round(stock / dailyVelocity)`, igual que hoy. Si `salidaUnits === 0`, sigue devolviendo `null` (sin datos de rotación).
- **Para SKUs con ≥ 90 días de historial real, el comportamiento es idéntico al actual** (`windowDays` se satura en 90).
- Ejemplo verificado a mano: Batería Etna con `earliestMovementDate` de ayer, `windowDays ≈ 1`, `salidaUnits = 5` (la salida de -2 anulada sigue excluida) → `dailyVelocity ≈ 5`, `rotationDays = round(8/5) = 2`.

## 2. Selector de mes/año — 2 dropdowns

**Problema:** el selector actual (`‹ Junio De 2026 ›` con flechas) funciona, pero el usuario quiere evaluar una alternativa más estándar. Un calendario de día completo (como la imagen de referencia de Windows) resolvería una granularidad que el filtro no necesita — Movimientos filtra por mes calendario completo, no por día específico.

**Comportamiento deseado:**
- En `MovimientosView.tsx`, el bloque `‹ [mes label] ›` se reemplaza por dos `<select>`:
  - **Mes:** 12 opciones (Enero..Diciembre), valor = número de mes (1-12).
  - **Año:** 3 opciones — año actual y los 2 anteriores (ej. en 2026: 2024, 2025, 2026).
- Al cambiar cualquiera de los dos selects, se navega igual que hoy: `router.push('/movimientos?year=Y&month=M')` con los valores actualizados, disparando una nueva carga server-side vía `getMovementsForMonth`.
- Se quitan los botones ‹ › y la función `shiftMonth` (ya no se navega por incrementos, se elige directo).
- Mismo patrón visual que el `<select>` de "Tipo" en el modal de movimientos — sin librerías nuevas, sin calendario visual.

## 3. Fix del hueco en la barra sticky

**Problema:** en `MovimientosView.tsx`, el wrapper `sticky` (selector de mes/año + filtros Todos/Ingreso/Salida/Ajuste) vive dentro del `<main>` de la página, que tiene `padding: '26px 28px 40px'`. El fondo del wrapper sticky no cubre esa franja de padding superior de `<main>`, así que al hacer scroll se alcanza a ver una fila de movimiento asomando en el hueco entre el encabezado fijo de la página (`Header`, fuera de `<main>`) y la barra sticky.

**Comportamiento deseado:**
- El wrapper sticky se extiende con márgenes negativos hasta los bordes de `<main>` y repone el padding internamente, para que su fondo cubra edge-to-edge sin huecos:
  - Antes: `{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', paddingTop: 4, paddingBottom: 14 }`
  - Después: `{ position: 'sticky', top: -26, zIndex: 5, background: '#f6f7f9', margin: '-26px -28px 0', padding: '30px 28px 14px' }`
  (el `top: -26` compensa el margen negativo superior para que el punto de "pegado" visual siga siendo el mismo que hoy; el padding interno reemplaza el espacio que el margen negativo quitó, más el padding lateral que antes daba `<main>`).
- No cambia la posición visual del selector ni de los filtros en el estado inicial (sin scroll) — solo corrige lo que se ve *durante* el scroll.

## Resumen de archivos afectados

- `src/lib/inventory.ts` — `computeRotationDays` (ventana dinámica).
- `src/lib/inventory.test.ts` — nuevos casos de prueba para la ventana dinámica (SKU con < 90 días de historial vs. SKU con ≥ 90 días).
- `src/app/(app)/movimientos/MovimientosView.tsx` — selectores de mes/año (reemplaza `shiftMonth`/botones ‹ ›), fix del wrapper sticky.

## Testing

- `computeRotationDays`: casos nuevos en `inventory.test.ts` — (a) SKU con historial de 1-2 días y una venta reciente da un `rotationDays` bajo y coherente con la venta real (no 90-días-diluido); (b) SKU con historial ≥ 90 días se comporta exactamente igual que antes de este cambio (regresión); (c) el caso ya existente de exclusión de anulados (Task 1) sigue pasando sin cambios.
- Selector de mes/año y fix visual del sticky: son cambios de UI client-side — se verifican con el patrón ya establecido en el proyecto (curl para lo server-rendered) más una pasada manual del usuario en navegador, igual que el resto de cambios client-only de este proyecto.
