# Combobox con búsqueda para el campo "Repuesto" del modal Registrar movimiento

**Fecha:** 2026-07-02
**Estado:** Aprobado

## Problema

En el modal "Registrar movimiento" (`src/app/(app)/inventario/MovementFormModal.tsx`), el campo
"Repuesto" es un `<select>` nativo con los 28+ SKUs. Para encontrar un item hay que desplegar y
recorrer toda la lista. Con el catálogo creciendo, esto no escala.

## Solución

Reemplazar el `<select>` por un combobox propio con búsqueda al escribir. Sin dependencias nuevas,
estilos inline consistentes con el resto de la app (el proyecto no usa framework CSS a propósito).

## Componente nuevo: `src/app/(app)/inventario/PartCombobox.tsx`

Client component. Props:

- `parts: PartComputed[]` — el catálogo a buscar.
- `name: string` — nombre del campo del formulario (`"partId"`).

Estructura interna:

- Un `<input type="text">` visible con placeholder `Buscar por SKU o nombre…`.
- Un `<input type="hidden" name={name}>` que lleva el id del repuesto seleccionado. El server
  action `createMovement` no cambia en absoluto.
- Una lista desplegable posicionada bajo el input con las coincidencias, cada una mostrando
  `SKU · descripción` (mismo formato que el `<select>` actual).

## Comportamiento

- **Filtrado:** al escribir se filtran las coincidencias por SKU **o** descripción, sin distinguir
  mayúsculas ni tildes ("parabrisas" encuentra "Parabrisas"). Con el campo vacío y enfocado se
  muestra la lista completa.
- **Teclado:** ↑/↓ mueven el resaltado, Enter selecciona el resaltado (con `preventDefault` para
  no enviar el formulario), Esc cierra la lista.
- **Ratón:** clic en una opción selecciona; clic fuera del componente cierra la lista.
- **Selección:** al seleccionar, el input visible muestra `SKU · descripción` y el hidden recibe
  el id. Si el usuario edita el texto después de seleccionar, la selección se limpia (el hidden
  queda vacío).
- **Solo items de la lista:** si se envía el formulario sin selección válida, el modal muestra el
  error "Selecciona un repuesto de la lista" y no envía (los inputs hidden no participan en la
  validación nativa del navegador, así que el guard va en el submit del formulario).
- **Valor inicial vacío (cambio deliberado):** hoy el `<select>` pre-selecciona el primer repuesto;
  el combobox empieza vacío para evitar registrar movimientos al repuesto equivocado por descuido.
  Decisión confirmada por el usuario.

## Lógica pura testeable

La normalización (minúsculas + sin tildes, vía `String.normalize('NFD')`) y el filtrado se exportan
como función pura — `filterParts(parts, query)` — para testearse en Vitest sin montar UI, siguiendo
el patrón del proyecto (lógica de negocio pura con tests; cf. `src/lib/inventory.ts`,
`movementLogic.ts`). Tests: query vacía devuelve todo; match por SKU; match por descripción;
insensible a mayúsculas y tildes; sin resultados devuelve `[]`.

## Cambios en archivos

- **Nuevo:** `src/app/(app)/inventario/PartCombobox.tsx` (componente + `filterParts`).
- **Nuevo:** `src/app/(app)/inventario/PartCombobox.test.ts` (tests de `filterParts`).
- **Modificado:** `MovementFormModal.tsx` — el `Field "Repuesto"` pasa a renderizar
  `<PartCombobox parts={parts} name="partId" />`; el submit gana el guard de selección válida.

## Verificación

- `npm test` (tests de `filterParts`) y `npm run lint` corren en la sesión.
- El click-through del combobox (escribir, filtrar, teclado, registrar movimiento) lo verifica el
  usuario en su navegador — es UI client-only dentro de un modal, fuera del alcance del patrón
  curl (ver CLAUDE.md).

## Fuera de alcance

- No se tocan los demás `<select>` de la app (Tipo, filtros de Inventario/Movimientos, grupo en
  PartFormModal): son listas cortas donde el select nativo va bien.
- Sin virtualización de la lista (28 items hoy; irrelevante hasta miles).
