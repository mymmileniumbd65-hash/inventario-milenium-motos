'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db/client';
import { movements, parts } from '@/db/schema';
import { computeStock } from '@/lib/inventory';
import type { ActionResult } from './actions';
import { resolveSignedQty } from './movementLogic';

export async function createMovement(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const partId = (formData.get('partId') as string | null)?.trim();
  const type = formData.get('type') as string | null;
  const qtyRaw = formData.get('qty') as string | null;
  const fromLocation = (formData.get('fromLocation') as string | null)?.trim();
  const toLocation = (formData.get('toLocation') as string | null)?.trim();
  const referenceCode = (formData.get('referenceCode') as string | null)?.trim();

  if (!partId || !type || !qtyRaw || !fromLocation || !toLocation || !referenceCode) {
    return { error: 'Todos los campos son obligatorios.' };
  }
  if (type !== 'ingreso' && type !== 'salida' && type !== 'ajuste') {
    return { error: 'Tipo de movimiento inválido.' };
  }

  const resolved = resolveSignedQty(type, Number(qtyRaw));
  if (!resolved.ok) return { error: resolved.error };

  const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
  if (!part) return { error: 'El repuesto no existe.' };

  if (resolved.qty < 0) {
    const existingMovements = await db.select().from(movements).where(eq(movements.partId, partId));
    const currentStock = computeStock(existingMovements.map((m) => ({ type: m.type, qty: m.qty, createdAt: m.createdAt })));
    if (currentStock + resolved.qty < 0) {
      return { error: `Stock insuficiente: hay ${currentStock} unidades disponibles.` };
    }
  }

  await db.insert(movements).values({
    partId, type, qty: resolved.qty, fromLocation, toLocation, referenceCode,
    userId: user.id, userEmail: user.email ?? 'desconocido',
  });

  revalidatePath('/inventario');
  revalidatePath('/movimientos');
  revalidatePath('/reportes');
  revalidatePath('/alertas');
  revalidatePath('/');
  return { success: true };
}
