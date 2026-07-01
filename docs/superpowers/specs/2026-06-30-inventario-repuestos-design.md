# Inventario de Repuestos — Milenium Motos

## Contexto

Milenium Motos tiene un prototipo hecho en Claude Design (`App gestión inventarios motos.zip`) que cubre un módulo de **inventario de repuestos**: control de stock por grupo/SKU, alertas automáticas de reposición, trazabilidad de movimientos y reportes de compra/rotación.

El prototipo es una maqueta visual sin backend: el login acepta cualquier credencial, los datos (`GROUPS`, `MOVS`) están hardcodeados en el propio archivo, y botones como "Registrar ingreso" o "Generar orden de compra" no ejecutan ninguna acción.

El zip también incluye tres capturas de pantalla (`screenshots/01-app.png` a `03-app.png`) que muestran una pantalla distinta: inventario de motocicletas por unidad (placa, chasis, N° motor) con un módulo "Almacenes". Esa pantalla **no existe en el código exportado** — es de una iteración de diseño anterior/diferente. Se confirmó con el usuario que el alcance de este proyecto es únicamente el módulo de **repuestos** que sí está implementado en el prototipo; el módulo de motos por unidad queda fuera de este spec.

## Objetivo

Convertir el prototipo de repuestos en una aplicación web funcional, con backend real, base de datos persistente y login real, manteniendo el diseño visual y los flujos ya validados en la maqueta.

## Alcance

**Incluido:**
- Los 5 módulos del prototipo: Panel general, Inventario, Alertas, Movimientos, Reportes.
- CRUD de grupos y de repuestos (SKU).
- Registro real de movimientos (ingreso/salida/ajuste) que actualiza el stock.
- Cálculo en vivo de stock, estado (Disponible/Stock bajo/Agotado/Exceso), alertas, rotación y KPIs.
- Login real (usuario/contraseña con hash), sesión persistente.
- Un solo almacén/tienda, un solo rol de usuario (sin permisos diferenciados).
- Datos de muestra (el catálogo del prototipo: Parabrisas, Llantas, Cadenas, etc.) precargados al desplegar.

**Fuera de alcance (explícitamente pospuesto):**
- Módulo de inventario de motocicletas por unidad (placa/chasis/motor/almacenes) visto en los screenshots.
- Generación real de órdenes de compra (el botón "Generar orden de compra" / "Generar OC" se mostrará pero no ejecutará acción).
- Múltiples sucursales/almacenes con inventario separado.
- Roles y permisos diferenciados por usuario.
- Registro público de cuentas (las cuentas las crea el operador del sistema manualmente).

## Arquitectura

- **Frontend + Backend:** Next.js (App Router), desplegado en Vercel.
- **Base de datos:** Postgres en Supabase (proyecto ya existente del usuario).
- **Acceso a datos de negocio:** Drizzle ORM, directo sobre las tablas propias (`groups`, `parts`, `movements`).
- **Autenticación:** Supabase Auth (email/contraseña), integrado a Next.js vía `@supabase/ssr` (sesión por cookie, refrescada en middleware). No es una tabla propia de usuarios ni Auth.js — es el servicio de autenticación nativo de Supabase. Sin OAuth, sin registro público: las cuentas se crean manualmente desde el panel de Supabase o su API de administración.

## Modelo de datos

`groups`, `parts` y `movements` viven en el esquema propio de la app (gestionados con Drizzle). Los usuarios/login viven en `auth.users`, gestionado enteramente por Supabase Auth — la app no tiene una tabla `users` propia.

```
groups
  id, name

parts
  id, sku (único), description, compat, group_id (FK groups), min_stock, created_at

movements
  id, part_id (FK parts), type ('ingreso' | 'salida' | 'ajuste'), qty,
  from_location, to_location, reference_code,
  user_id (id del usuario en auth.users, sin FK — Supabase gestiona ese esquema),
  user_email (copia del email al momento del movimiento, para mostrar "por quién" sin consultar auth.users),
  created_at
```

**Principio clave:** `parts` no guarda un contador de stock. El stock actual, el estado, la rotación, las alertas y los KPIs se **calculan siempre a partir de `movements`** (suma de `qty` por `part_id`). Esto evita que el stock mostrado se desincronice de la fuente real (los movimientos), igual que en el prototipo pero con datos reales.

### Fórmulas derivadas

- **Stock actual** = `SUM(movements.qty)` para ese `part_id`.
- **Estado:**
  - `stock === 0` → Agotado
  - `stock < min_stock` → Stock bajo
  - `stock >= min_stock * 4` → Exceso
  - en otro caso → Disponible
- **Rotación (días de cobertura)** = `stock_actual / velocidad_diaria_de_salida`, donde `velocidad_diaria_de_salida` = unidades de tipo "salida" en los últimos 90 días ÷ 90. Si no hay salidas registradas en ese período, se muestra "—" (sin datos suficientes), igual que el prototipo cuando `rot = 0`.
- **Alertas** (recalculadas en cada carga, no se persisten):
  - Crítica: `stock === 0` → "reponer" sugerido de `min_stock * 2`.
  - Alta: `0 < stock < min_stock` → "reponer" sugerido de `min_stock * 2 - stock`.
  - Media (baja rotación): rotación ≥ 60 días.
  - Media (exceso): `stock >= min_stock * 4`.

## Pantallas y funcionalidad

### Login
Formulario usuario/contraseña autenticado contra Supabase Auth. Sin "cualquier credencial" — credenciales inválidas muestran error. Sesión persistente vía cookie, refrescada automáticamente en el middleware de Next.js.

### Panel general (Dashboard)
KPIs (unidades en stock, grupos, alertas activas, rotación promedio, movimientos últimos 7 días), alertas activas (top 5), movimientos recientes (top 5), rotación más lenta (top 5), stock por grupo. Todo calculado en vivo desde la base de datos, mismo diseño visual del prototipo.

### Inventario
- Listado de repuestos filtrable por grupo (chips) y búsqueda de texto (SKU, descripción, grupo, compatibilidad).
- **Nuevo:** crear/editar/eliminar grupos.
- **Nuevo:** crear/editar/eliminar repuestos (SKU, descripción, compatibilidad, grupo, mínimo).
- **Nuevo:** botón "Registrar ingreso" abre un formulario para crear un movimiento real (tipo, cantidad, origen/destino, código de referencia), que impacta el stock al instante.
- Click en una fila abre el drawer de detalle: stock, mínimo, rotación, compatibilidad, historial de movimientos de ese SKU (real, no generado con semilla pseudoaleatoria como en el prototipo).

### Alertas
Igual que el prototipo: conteos por severidad (Crítica/Alta/Media) y listado completo, calculados en vivo. Los botones "Generar OC" / "Revisar" se muestran pero no ejecutan ninguna acción en esta versión.

### Movimientos
Timeline completo de movimientos, filtrable por tipo (Todos/Ingreso/Salida/Ajuste). Se alimenta del mismo formulario de "registrar movimiento" usado en Inventario.

### Reportes
KPIs de reposición (unidades a reponer, SKUs en exceso, rotación lenta, cobertura), tabla de "Compras sugeridas" (SKUs bajo mínimo, con cantidad sugerida y prioridad), rotación por SKU, inventario por grupo. Todo calculado en vivo. Sin generación de orden de compra todavía.

## Validaciones y manejo de errores

- No se permite un movimiento de "salida" que deje el stock en negativo.
- Campos obligatorios en formularios de repuesto, grupo y movimiento (no se puede guardar con campos vacíos o cantidad ≤ 0).
- SKU único por repuesto (no se permiten duplicados).
- No se puede eliminar un grupo que todavía tiene repuestos asociados.
- Mensajes de error en español, mostrados inline en el formulario correspondiente.
- Login con credenciales inválidas muestra un mensaje de error genérico (sin indicar si el usuario existe o no).

## Datos iniciales

Al desplegar, la base de datos se siembra con el catálogo de ejemplo del prototipo (10 grupos: Parabrisas, Llantas, Cadenas, Pastillas de freno, Filtros, Bujías, Espejos, Baterías, Focos, Kits de arrastre — con sus SKUs, descripciones, compatibilidad y mínimos) y un conjunto de movimientos de ejemplo para poder ver el flujo completo funcionando de inmediato. El usuario podrá editar o borrar estos datos y cargar el catálogo real desde la misma app.

Las cuentas de usuario (login) se crean manualmente al desplegar, usando el API de administración de Supabase Auth (no hay pantalla de registro público). Se creará al menos una cuenta inicial ("Admin").

## Pruebas

- **Pruebas unitarias** sobre la lógica de cálculo derivada (stock, estado, rotación, alertas, KPIs), por ser el corazón del sistema y la parte con más reglas de negocio.
- **Smoke test manual** de los flujos principales antes de dar por terminada la implementación: login, crear grupo, crear repuesto, registrar ingreso, registrar salida, ver que el stock/alertas/reportes se actualicen correctamente, ver historial en el drawer de detalle.

## Notas para la fase de planificación

- El prototipo (`prototype-extract/`) sirve como referencia exacta de diseño visual (colores, tipografía, layout, componentes) y de las fórmulas de negocio originales (estado, alertas, KPIs) — se reutiliza como especificación visual, no como código a ejecutar directamente (usa un DSL propietario de Claude Design que no es código de producción).
