'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { parts, movements } from '@/db/schema';
import type { ActionResult } from './actions';

function parsePartFields(formData: FormData): { sku: string; description: string; compat: string; groupId: string; minStock: number } | { error: string } {
  const sku = (formData.get('sku') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const compat = (formData.get('compat') as string | null)?.trim() ?? '';
  const groupId = (formData.get('groupId') as string | null)?.trim();
  const minStockRaw = formData.get('minStock') as string | null;

  if (!sku || !description || !groupId) {
    return { error: 'SKU, descripción y grupo son obligatorios.' };
  }
  const minStock = Number(minStockRaw);
  if (!Number.isInteger(minStock) || minStock < 0) {
    return { error: 'El mínimo debe ser un número entero mayor o igual a 0.' };
  }
  return { sku, description, compat, groupId, minStock };
}

export async function createPart(formData: FormData): Promise<ActionResult> {
  const parsed = parsePartFields(formData);
  if ('error' in parsed) return parsed;

  const existing = await db.select().from(parts).where(eq(parts.sku, parsed.sku)).limit(1);
  if (existing.length > 0) return { error: 'Ya existe un repuesto con ese SKU.' };

  await db.insert(parts).values(parsed);
  revalidatePath('/inventario');
  revalidatePath('/');
  return { success: true };
}

export async function updatePart(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parsePartFields(formData);
  if ('error' in parsed) return parsed;

  const existing = await db.select().from(parts).where(eq(parts.sku, parsed.sku)).limit(1);
  if (existing.length > 0 && existing[0].id !== id) return { error: 'Ya existe un repuesto con ese SKU.' };

  await db.update(parts).set(parsed).where(eq(parts.id, id));
  revalidatePath('/inventario');
  return { success: true };
}

export async function deletePart(id: string): Promise<ActionResult> {
  const partMovements = await db.select().from(movements).where(eq(movements.partId, id)).limit(1);
  if (partMovements.length > 0) {
    return { error: 'No se puede eliminar un repuesto con movimientos registrados.' };
  }
  await db.delete(parts).where(eq(parts.id, id));
  revalidatePath('/inventario');
  return { success: true };
}
