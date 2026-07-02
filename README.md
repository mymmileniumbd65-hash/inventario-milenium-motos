# Inventario de Repuestos — Milenium Motos

Sistema de gestión de inventario de repuestos para Milenium Motos. El stock se
clasifica por **grupo → SKU** y se **calcula en vivo** a partir de los movimientos
(ingreso/salida/ajuste) — nunca se almacena un contador. Incluye CRUD de grupos y
repuestos, registro de movimientos, alertas automáticas de reposición, trazabilidad
y reportes de compra/rotación, todo protegido tras login con Supabase Auth.

## Documentación

- **[Flujo de trabajo operativo](docs/FLUJO-DE-TRABAJO.md)** — cómo usar la app en
  el día a día del almacén: crear grupos y repuestos, registrar movimientos, leer
  alertas y reportes, y las reglas de negocio que el sistema aplica.
- **[Flujo de trabajo de desarrollo](docs/FLUJO-DESARROLLO.md)** — puesta a punto del
  entorno, comandos, mapa del repositorio, el proceso de desarrollo por tareas (SDD),
  verificación, convenciones de git, checklist de seguridad y despliegue.
- **[CLAUDE.md](CLAUDE.md)** — estado del proyecto y notas de arquitectura.
- **[Spec](docs/superpowers/specs/2026-06-30-inventario-repuestos-design.md)** y
  **[plan](docs/superpowers/plans/2026-06-30-inventario-repuestos.md)** aprobados.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) · Drizzle ORM ·
Vitest · despliegue en Vercel.

## Inicio rápido

```bash
npm install
cp .env.example .env.local   # completa con los valores reales de Supabase
npm run db:push              # empuja el esquema a la base de datos
npm run db:seed              # crea el admin + catálogo de ejemplo
npm run dev                  # http://localhost:3000
```

Detalle completo del entorno, los comandos y el despliegue en
[docs/FLUJO-DESARROLLO.md](docs/FLUJO-DESARROLLO.md).

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción. |
| `npm run lint` | ESLint. |
| `npm test` | Suite de tests (Vitest). |
| `npm run db:generate` | Genera una migración Drizzle desde el esquema. |
| `npm run db:push` | Empuja el esquema a la base de datos. |
| `npm run db:seed` | Siembra admin + catálogo de ejemplo. |
