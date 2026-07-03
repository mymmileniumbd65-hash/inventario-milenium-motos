# Flujo de trabajo — Desarrollo

Cómo trabajar el **código** de este proyecto: preparar el entorno, agregar
funcionalidad, verificar y desplegar. Para el uso operativo de la app (almacén),
ver [`FLUJO-DE-TRABAJO.md`](./FLUJO-DE-TRABAJO.md).

## Stack y principios

- **Next.js 16** (App Router, TypeScript) — se despliega en Vercel.
- **Supabase**: Postgres (datos) + Supabase Auth (login vía `@supabase/ssr`).
- **Drizzle ORM** (`drizzle-orm/node-postgres` + `pg`) para las tablas propias.
- **Vitest** para la lógica de negocio pura.
- **Sin framework de CSS**: estilos inline, a propósito (imita el prototipo).

Tres principios que rigen el diseño (respétalos al tocar código):

1. **Los valores derivados no se guardan, se calculan.** Stock, estado, rotación,
   alertas, KPIs y sugerencias de compra salen siempre de la tabla `movements`.
   Toda esa lógica vive en un único módulo puro: **`src/lib/inventory.ts`**.
2. **Lógica de negocio = módulo puro y testeado.** Sin I/O ni imports de framework
   en `inventory.ts`. Los datos reales se los pasa la capa de acceso a datos.
3. **Auth es Supabase Auth**, no una tabla propia. El middleware refresca la sesión
   en cada request y redirige lo no autenticado a `/login`.

## Puesta a punto del entorno

1. **Requisitos:** Node 20+ (probado en Node 24), un proyecto Supabase.
2. **Dependencias:**
   ```bash
   npm install
   ```
3. **Variables de entorno:** copia la plantilla y rellénala con valores reales.
   ```bash
   cp .env.example .env.local
   ```
   Necesitas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler de transacción, puerto 6543),
   `DIRECT_DATABASE_URL` (para migraciones) y, opcional, `SEED_ADMIN_EMAIL` /
   `SEED_ADMIN_PASSWORD` para el seed.
4. **Base de datos:**
   ```bash
   npm run db:push    # empuja el esquema de src/db/schema.ts a Supabase
   npm run db:seed    # crea el admin + catálogo de ejemplo (imprime la clave si la genera)
   ```
   > `db:seed` **no es re-ejecutable** (SKUs/nombres son únicos): para resembrar,
   > vacía primero las tablas.
5. **Levantar en local:**
   ```bash
   npm run dev        # http://localhost:3000
   ```

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción (incluye typecheck). |
| `npm run lint` | ESLint. |
| `npm test` | Corre toda la suite de Vitest una vez. |
| `npx vitest run <ruta>` | Un solo archivo de test. |
| `npx tsc --noEmit` | Typecheck sin generar salida. |
| `npm run db:generate` | Genera una migración Drizzle desde el esquema. |
| `npm run db:push` | Empuja el esquema a la base de datos. |
| `npm run db:seed` | Siembra admin + catálogo. |

## Dónde va cada cosa

```
src/
  app/
    login/                 Login (page + server action authenticate)
    (app)/                 Grupo de rutas protegidas (layout valida sesión)
      page.tsx             Dashboard
      inventario/          Página + vista cliente + modales + server actions
        actions.ts         Server actions de GRUPOS (create/update/delete)
        partActions.ts     Server actions de REPUESTOS
        movementActions.ts Server actions de MOVIMIENTOS
        movementLogic.ts   Lógica pura (sin 'use server') que usan las actions
      alertas/ movimientos/ reportes/
    api/parts/[id]/movements/route.ts   Historial de un SKU (usado por el drawer)
  components/              Sidebar, Header, KpiCard
  db/
    schema.ts              Tablas Drizzle: groups, parts, movements
    client.ts              Pool de Postgres (TLS verificado con CA fijada)
    queries.ts             Capa de acceso a datos (alimenta a inventory.ts)
    seed.ts                Script de siembra
    supabase-ca.ts         CA raíz de Supabase (pinning TLS)
  lib/
    inventory.ts           TODA la lógica de negocio derivada (pura, testeada)
    inventory.test.ts      Tests de esa lógica
    supabase/              Clientes SSR (server.ts, middleware.ts)
  proxy.ts                 Refresca sesión y protege rutas
docs/superpowers/          Spec y plan aprobados (fuente de verdad del qué y el cómo)
.superpowers/sdd/progress.md   Bitácora de ejecución (qué tarea, qué commits, hallazgos)
```

## Cómo se agrega funcionalidad

Este proyecto se construye **tarea por tarea** desde un plan aprobado, no
improvisando desde la spec. Antes de tocar código:

1. Lee la **spec** (`docs/superpowers/specs/…`) y el **plan**
   (`docs/superpowers/plans/…`): el plan es la fuente de verdad del *cómo*.
2. Lee **`.superpowers/sdd/progress.md`**: qué está hecho, qué se difirió y por qué.
3. Ejecuta con las skills `superpowers:subagent-driven-development` o
   `superpowers:executing-plans`, y verifica antes de dar por cerrada una tarea.

Reglas concretas al escribir código:

- **Cálculos derivados nuevos → `src/lib/inventory.ts`** (con su test). No los
  esparzas por las páginas.
- **Server Actions:** todo archivo con `'use server'` debe exportar **solo funciones
  async**. Si necesitas un helper puro (no async), ponlo en un archivo hermano *sin*
  la directiva (ver `movementLogic.ts`).
- **No puedes llamar server actions desde un script `tsx` suelto.** Tanto `cookies()`
  como `revalidatePath()` requieren un contexto real de request de Next. Para
  probarlas sin navegador, monta una ruta API autenticada temporal y pégale con
  `curl` + una cookie de sesión real. (No nombres la carpeta con guion bajo inicial:
  Next la trata como privada y da 404.)
- **Cambios de esquema:** edita `src/db/schema.ts`, luego `npm run db:generate` y
  `npm run db:push`. `movements.user_id/user_email` referencian al usuario de
  Supabase Auth (sin FK, porque `auth.users` vive fuera de este esquema).
- **Estilos:** inline `style={{…}}`, siguiendo el patrón existente y los colores del
  prototipo (`prototype-extract/` es solo referencia, no código ejecutable).

## Verificación (no hay navegador en el sandbox)

El patrón establecido para verificar sin navegador:

- **Páginas 100% server-rendered** (Dashboard, Alertas, Movimientos, Reportes):
  `npm run dev` + `curl` es una prueba funcional completa.
- **Páginas con modales/formularios de cliente** (los CRUD de Inventario): `curl`
  solo valida el HTML inicial y las server actions por separado; el clic real
  (abrir modal, mutar dato y ver el refresco) **necesita un navegador o un agente
  con navegador**. Esa verificación interactiva sigue pendiente — hazla en local.
- **Login** sí es verificable end-to-end por `curl` extrayendo los campos
  `$ACTION_REF`/`$ACTION_KEY` del HTML server-rendered de `/login`. El mismo truco
  sirve para cualquier otro formulario server-rendered (ej. "Salir").
- **Lógica pura:** cúbrela con Vitest (`inventory.ts` es el módulo con más tests).

Antes de dar una tarea por terminada, corre y confirma en verde:
```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

## Git

- Rama principal para PRs: **`main`**. No trabajes directo sobre la rama por defecto;
  crea una rama para el trabajo.
- Mensajes de commit con prefijo tipo Conventional Commits, como en el historial:
  `feat:`, `fix:`, `docs:`, `refactor:`.
- Un commit = un propósito. Evita mezclar cambios no relacionados.
- Commitea/pushea **solo cuando el usuario lo pida**.

## Seguridad (checklist antes de mergear/desplegar)

- **RLS activado** en `groups`, `parts` y `movements`. La `anon key` va en el bundle
  del navegador; sin RLS, cualquiera puede leer/escribir la base por la API REST.
  La app funciona porque accede por conexión directa como `postgres` (que ignora
  RLS), no por PostgREST. **Si algún día lees/escribes datos con el cliente
  `supabase-js` (roles anon/authenticated), primero añade políticas RLS explícitas.**
- **Sin secretos en el código.** Todo va en `.env.local` (git-ignorado). Solo
  `.env.example` (plantilla, sin valores) se versiona.
- **TLS de la BD verificado** contra la CA fijada en `src/db/supabase-ca.ts`
  (no `rejectUnauthorized: false`). Si Supabase rota su CA raíz, actualiza ese archivo.
- **Contraseñas fuera del fuente:** el seed las toma de env o genera una aleatoria.
  Rota en Supabase cualquier credencial que haya quedado en el historial de git.

## Despliegue (Vercel — Tarea 18, pendiente)

1. Conecta el repo a Vercel (framework: Next.js, detectado solo).
2. Configura las **variables de entorno** en Vercel (las mismas de `.env.local`).
   Ojo con `DIRECT_DATABASE_URL`: el host directo de Supabase es solo IPv6; usa el
   pooler si no tienes el add-on IPv4.
3. Verifica que el build pasa en Vercel; revisa preview antes de promover a prod.
4. Task 18 está **pausada** hasta una prueba manual en navegador (ver CLAUDE.md).

## Referencias rápidas del repo

- `CLAUDE.md` — estado y notas de arquitectura para agentes/IA.
- `docs/superpowers/specs/…` — qué hace la app (spec aprobada).
- `docs/superpowers/plans/…` — cómo construirla (plan por tareas).
- `.superpowers/sdd/progress.md` — bitácora: tareas, commits y hallazgos diferidos.
