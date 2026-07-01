# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state of this repository

**There is no application code here yet.** This repo currently contains only planning artifacts and a design reference; Next.js has not been scaffolded, so there is no `package.json`, no build/lint/test commands, and nothing to run. Do not assume a framework or tooling until Task 1 of the implementation plan (below) has been executed.

- `docs/superpowers/specs/2026-06-30-inventario-repuestos-design.md` — the approved spec: what the app does, its scope, data model, and business rules. Read this first for *what* to build.
- `docs/superpowers/plans/2026-06-30-inventario-repuestos.md` — the approved, task-by-task implementation plan (file paths, exact code, commands, commit points). Read this for *how* to build it. Execute it via the `superpowers:subagent-driven-development` or `superpowers:executing-plans` skill, task by task — don't freehand the implementation from the spec alone.
- `prototype-extract/` — a Claude Design (Claude Desing) export of the original UI prototype, extracted from `App gestión inventarios motos.zip`. **This is a reference only, not code to run or adapt directly.** `Milenium Inventario.dc.html` and `Milenium Inventario - Repuestos.html` use a proprietary declarative-component DSL (`<x-dc>`, `<sc-if>`, `<sc-for>`, `{{ }}` bindings interpreted by `support.js`) — it is not React/HTML you can extend. Use it only to confirm exact colors, copy, layout, and the original hardcoded business-logic formulas (status/alerts/KPIs), which the spec and plan already translated into real TypeScript.
- `prototype-extract/screenshots/` show a *different*, out-of-scope design (motorcycle-unit tracking by plate/VIN/warehouse) that does not match the exported prototype code and is explicitly out of scope — see the "Contexto" section of the spec for why.

Once Task 1 of the plan has been run, update this file with the real build/lint/test commands and the actual project structure — the sections above should be replaced, not just appended to.

## What the app is (per the spec)

A spare-parts inventory system for Milenium Motos: stock tracked by group → SKU, with live-computed stock/status/rotation/alerts (never stored counters — always derived from the `movements` table), a CRUD for groups/parts, movement registration (ingreso/salida/ajuste), and dashboard/alerts/movements/reports views. Single warehouse, single user role, no PO generation yet. Full details, including the exact derived-value formulas, are in the spec.

## Planned architecture (per the plan — not yet implemented)

- Next.js (App Router, TypeScript), deployed on Vercel.
- Postgres hosted on Supabase; Drizzle ORM for the app's own tables (`groups`, `parts`, `movements`).
- **Auth is Supabase Auth**, not a custom users table — session cookies managed via `@supabase/ssr`, refreshed in `middleware.ts`. `movements.user_id`/`user_email` reference the Supabase Auth user without a local `users` table.
- All derived business values (stock, status, rotation, alerts, KPIs) live in one pure, unit-tested module (`src/lib/inventory.ts`) — this is the part of the plan with the most business logic and the most test coverage; keep new derived calculations there rather than scattering them across pages.
- No CSS framework — inline `style` objects matching the prototype's own approach, on purpose (see plan Task 8+).
