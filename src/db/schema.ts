import { pgTable, uuid, text, integer, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const movementTypeEnum = pgEnum('movement_type', ['ingreso', 'salida', 'ajuste']);

export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
}).enableRLS();

export const parts = pgTable('parts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: text('sku').notNull().unique(),
  description: text('description').notNull(),
  compat: text('compat').notNull().default(''),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  minStock: integer('min_stock').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const movements = pgTable('movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  partId: uuid('part_id').notNull().references(() => parts.id),
  type: movementTypeEnum('type').notNull(),
  qty: integer('qty').notNull(),
  fromLocation: text('from_location').notNull(),
  toLocation: text('to_location').notNull(),
  referenceCode: text('reference_code').notNull(),
  comment: text('comment'),
  // Supabase Auth user id (auth.users.id) — no FK, since that table lives in Supabase's own "auth" schema.
  userId: uuid('user_id').notNull(),
  // Snapshot of the acting user's email at the time of the movement, so the timeline
  // and drawer history don't need to query the auth schema to display "por quién".
  userEmail: text('user_email').notNull(),
  // When set, this movement is a reversal ("anulación") that cancels the referenced
  // movement's effect on stock. The original row is never edited or deleted — the
  // ledger stays immutable and auditable. No FK to keep it simple (self-reference).
  reversesMovementId: uuid('reverses_movement_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Structural guard against double-voiding: at most one reversal per movement,
  // enforced at the DB level (defense-in-depth against the app-level race).
  uniqueIndex('movements_reverses_movement_id_unique')
    .on(table.reversesMovementId)
    .where(sql`${table.reversesMovementId} IS NOT NULL`),
]).enableRLS();
