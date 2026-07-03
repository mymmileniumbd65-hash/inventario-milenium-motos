# Fix real del hueco sticky en Movimientos + barra fija en Inventario

## Contexto

La Task 3 del plan `2026-07-03-ajustes-post-pruebas` intentó corregir un hueco visual en la barra fija (sticky) de Movimientos usando márgenes negativos (`margin: '-26px -28px 0'`) para "cancelar" el padding de `<main>`. El usuario probó el resultado en Chrome y el bug **persiste** (confirmado: la fila sigue visible en el hueco incluso sin hacer scroll, no es un artefacto pasajero de repintado).

Se aplicó `superpowers:systematic-debugging` antes de intentar un segundo fix. Diagnóstico (Fase 1-2, sin acceso a un navegador real en este entorno — la evidencia primaria vino de las capturas y confirmaciones del usuario):

- El bug es **persistente y reproducible** en Chrome, no un artefacto de scroll momentáneo.
- Estructuralmente, no existe ninguna fila de movimiento antes del div `sticky` en el DOM — para que una fila aparezca *visualmente encima* del div sticky, el div sticky no puede estar realmente "pegado" al borde superior del scroll en `top: 0`.
- Hipótesis de causa raíz: combinar `position: sticky` con **márgenes negativos** sobre el propio elemento sticky es una zona ambigua del spec de CSS — el *collapse* de márgenes entre el elemento sticky y su contenedor padre (el `<div>` raíz de `MovimientosView`, sin padding propio) puede hacer que el navegador calcule mal el punto de "enganche" del sticky. El fix anterior resolvía la cobertura del fondo (ya no hay franja transparente), pero no elimina esta ambigüedad de cálculo.
- **Decisión de diseño:** en vez de seguir ajustando la técnica de márgenes negativos (intentar una tercera variante de cancelación), se elimina la causa de raíz por completo: quitar el padding de `<main>` y no usar márgenes negativos en absoluto. Un elemento `sticky` sin ningún padding de ancestro que cancelar no tiene esta ambigüedad — es la técnica estándar más simple y robusta para este patrón.

De paso, el usuario pidió aplicar la misma idea (barra superior fija al hacer scroll) a la pantalla de Inventario.

Rama de trabajo: `feat/cambios-varios` (continúa).

## Alcance

**Incluido:**

1. Reestructurar `movimientos/page.tsx` + `MovimientosView.tsx` para eliminar el padding de `<main>` y mover esa responsabilidad al propio div sticky (padding directo, sin márgenes negativos) y a un wrapper para el resto del contenido.
2. Aplicar el mismo patrón a `inventario/page.tsx` + `InventarioView.tsx`: la franja "Buscar repuesto / Todos los grupos / Grupos / +Repuesto / +Registrar ingreso" pasa a `position: sticky`.

**Fuera de alcance:**
- El encabezado de columnas de la tabla de Inventario (SKU/GRUPO/STOCK/MÍN/ESTADO/ROTACIÓN) **no** se vuelve sticky en este cambio — vive dentro de una tarjeta con `overflow: hidden` (para las esquinas redondeadas), y fijarlo requeriría restructurar esa tarjeta con más riesgo. Se descartó explícitamente por menor riesgo, dado que ya tuvimos un bug de sticky sin resolver a la primera.
- Cualquier otro contenido de Inventario (el contador de SKUs/unidades, la tabla en sí, el drawer de detalle, los modales) no cambia de comportamiento, solo de contenedor/padding.

## 1. Movimientos — eliminar la causa raíz del hueco

**`src/app/(app)/movimientos/page.tsx`:** el `<main>` pierde su padding:
- Antes: `<main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>`
- Después: `<main style={{ flex: 1, overflow: 'auto' }}>`

**`src/app/(app)/movimientos/MovimientosView.tsx`:**
- El div sticky (mes/año + filtros) deja de usar `margin`/`paddingTop`/`paddingBottom` sueltos y pasa a un solo `padding: '26px 28px 14px'` (sin `margin` en absoluto — nada que cancelar, nada que pueda calcularse mal). Sigue con `position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9'`.
- Todo lo que sigue después del div sticky (el aviso de error condicional y la tarjeta de movimientos) se envuelve en un nuevo `<div style={{ padding: '0 28px 40px' }}>`, que reemplaza el padding que antes daba `<main>` para ese contenido.
- El resultado visual (espaciado, posición de todo) es idéntico al estado antes de la Task 3 — solo cambia el mecanismo interno, no la apariencia.

## 2. Inventario — barra superior fija

**`src/app/(app)/inventario/page.tsx`:** mismo cambio — `<main>` pierde su padding.

**`src/app/(app)/inventario/InventarioView.tsx`:**
- El primer `<div>` (que hoy contiene el input de búsqueda, el `<select>` de grupo, y los botones "Grupos"/"+ Repuesto"/"+ Registrar ingreso") pasa a `position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', padding: '26px 28px 14px'`.
- Todo lo que sigue (el contador de "N SKUs · N unidades" y la tarjeta con la tabla) se envuelve en `<div style={{ padding: '0 28px 40px' }}>`.
- El drawer (`PartDrawer`), los modales (`MovementFormModal`, `PartFormModal`, `GroupManagerModal`) no cambian — siguen siendo overlays `position: fixed` sobre toda la pantalla, no dependen del padding de `<main>`.

## Testing

Es un cambio puramente de CSS/estructura de contenedores, sin lógica de negocio — no aplica TDD con Vitest. Verificación:
- `npx tsc --noEmit` y `npm test` (regresión: nada debe romperse funcionalmente).
- Verificación manual del usuario en navegador (igual que los cambios de UI anteriores): confirmar que el hueco de Movimientos ya no aparece (ni durante ni después del scroll), que el espaciado visual no cambió en ningún lado, y que la nueva barra fija de Inventario se comporta igual (queda fija, sin huecos).
- **Si este fix tampoco resuelve el hueco de Movimientos**, según `superpowers:systematic-debugging` no se debe intentar una tercera variante de la misma técnica — hay que detenerse y reconsiderar el enfoque de fondo (por ejemplo, abandonar `position: sticky` por una implementación con `IntersectionObserver`, o aceptar que la barra no quede fija).
