import { eq, desc } from 'drizzle-orm';
import { db } from './client';
import { groups, parts, movements } from './schema';
import type { PartInput, MovementInput } from '../lib/inventory';

export async function getGroups() {
  return db.select().from(groups).orderBy(groups.name);
}

export async function getPartsWithMovements(): Promise<PartInput[]> {
  const [allParts, allGroups, allMovements] = await Promise.all([
    db.select().from(parts),
    db.select().from(groups),
    db.select().from(movements),
  ]);

  const groupNameById = new Map(allGroups.map((g) => [g.id, g.name]));
  const movementsByPart = new Map<string, MovementInput[]>();
  for (const m of allMovements) {
    const list = movementsByPart.get(m.partId) ?? [];
    list.push({ id: m.id, type: m.type, qty: m.qty, createdAt: m.createdAt, reversesMovementId: m.reversesMovementId });
    movementsByPart.set(m.partId, list);
  }

  return allParts.map((p) => ({
    id: p.id, sku: p.sku, description: p.description, compat: p.compat,
    groupId: p.groupId, groupName: groupNameById.get(p.groupId) ?? '',
    minStock: p.minStock, movements: movementsByPart.get(p.id) ?? [],
  }));
}

export interface MovementRow {
  id: string; type: 'ingreso' | 'salida' | 'ajuste'; qty: number;
  fromLocation: string; toLocation: string; referenceCode: string; createdAt: Date;
  userEmail: string; partSku: string; partDescription: string;
  reversesMovementId: string | null;
}

export async function getRecentMovements(limit = 100): Promise<MovementRow[]> {
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
      reversesMovementId: movements.reversesMovementId,
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .orderBy(desc(movements.createdAt))
    .limit(limit);
}

export async function getMovementsByPartId(partId: string): Promise<MovementRow[]> {
  return db
    .select({
      id: movements.id, type: movements.type, qty: movements.qty,
      fromLocation: movements.fromLocation, toLocation: movements.toLocation,
      referenceCode: movements.referenceCode, createdAt: movements.createdAt,
      userEmail: movements.userEmail, partSku: parts.sku, partDescription: parts.description,
      reversesMovementId: movements.reversesMovementId,
    })
    .from(movements)
    .innerJoin(parts, eq(movements.partId, parts.id))
    .where(eq(movements.partId, partId))
    .orderBy(desc(movements.createdAt));
}
