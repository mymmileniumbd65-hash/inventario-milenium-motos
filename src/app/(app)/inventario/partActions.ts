'use server';

import { eq, ilike } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db/client';
import { parts, movements } from '@/db/schema';
import { isUniqueViolation } from '@/db/errors';
import type { ActionResult } from './actions';

const SKU_MAX_LENGTH = 60;
const TEXT_MAX_LENGTH = 200;
const MAX_MIN_STOCK = 1_000_000;

function revalidateAll() {
  revalidatePath('/inventario');
  revalidatePath('/movimientos');
  revalidatePath('/reportes');
  revalidatePath('/alertas');
  revalidatePath('/');
}

function parsePartFields(formData: FormData): { sku: string; description: string; compat: string; groupId: string; minStock: number } | { error: string } {
  const sku = (formData.get('sku') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const compat = (formData.get('compat') as string | null)?.trim() ?? '';
  const groupId = (formData.get('groupId') as string | null)?.trim();
  const minStockRaw = formData.get('minStock') as string | null;

  if (!sku || !description || !groupId) {
    return { error: 'SKU, descripción y grupo son obligatorios.' };
  }
  if (sku.length > SKU_MAX_LENGTH) return { error: `El SKU no puede superar los ${SKU_MAX_LENGTH} caracteres.` };
  if (description.length > TEXT_MAX_LENGTH) return { error: `La descripción no puede superar los ${TEXT_MAX_LENGTH} caracteres.` };
  if (compat.length > TEXT_MAX_LENGTH) return { error: `La compatibilidad no puede superar los ${TEXT_MAX_LENGTH} caracteres.` };

  const minStock = Number(minStockRaw);
  if (!Number.isInteger(minStock) || minStock < 0) {
    return { error: 'El mínimo debe ser un número entero mayor o igual a 0.' };
  }
  if (minStock > MAX_MIN_STOCK) {
    return { error: `El mínimo no puede superar ${MAX_MIN_STOCK.toLocaleString('es-PE')} unidades.` };
  }
  return { sku, description, compat, groupId, minStock };
}

export async function createPart(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const parsed = parsePartFields(formData);
  if ('error' in parsed) return parsed;

  const existing = await db.select().from(parts).where(ilike(parts.sku, parsed.sku)).limit(1);
  if (existing.length > 0) return { error: 'Ya existe un repuesto con ese SKU.' };

  try {
    await db.insert(parts).values(parsed);
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un repuesto con ese SKU.' };
    throw err;
  }
  revalidateAll();
  return { success: true };
}

export async function updatePart(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const parsed = parsePartFields(formData);
  if ('error' in parsed) return parsed;

  const existing = await db.select().from(parts).where(ilike(parts.sku, parsed.sku)).limit(1);
  if (existing.length > 0 && existing[0].id !== id) return { error: 'Ya existe un repuesto con ese SKU.' };

  try {
    await db.update(parts).set(parsed).where(eq(parts.id, id));
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un repuesto con ese SKU.' };
    throw err;
  }
  revalidateAll();
  return { success: true };
}

export async function deletePart(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const partMovements = await db.select().from(movements).where(eq(movements.partId, id)).limit(1);
  if (partMovements.length > 0) {
    return { error: 'No se puede eliminar un repuesto con movimientos registrados.' };
  }
  await db.delete(parts).where(eq(parts.id, id));
  revalidateAll();
  return { success: true };
}
