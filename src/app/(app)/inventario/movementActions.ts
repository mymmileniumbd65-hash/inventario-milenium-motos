'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db/client';
import { movements, parts } from '@/db/schema';
import { computeStock } from '@/lib/inventory';
import { isUniqueViolation } from '@/db/errors';
import type { ActionResult } from './actions';
import { resolveSignedQty } from './movementLogic';

const LOCATION_MAX_LENGTH = 200;
const REFERENCE_CODE_MAX_LENGTH = 60;
const COMMENT_MAX_LENGTH = 2000;

export async function createMovement(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const partId = (formData.get('partId') as string | null)?.trim();
  const type = formData.get('type') as string | null;
  const qtyRaw = formData.get('qty') as string | null;
  const counterparty = (formData.get('fromLocation') as string | null)?.trim();
  const referenceCode = (formData.get('referenceCode') as string | null)?.trim();
  const commentRaw = (formData.get('comment') as string | null)?.trim();

  if (!partId || !type || !qtyRaw || !counterparty || !referenceCode) {
    return { error: 'Todos los campos son obligatorios.' };
  }
  if (type !== 'ingreso' && type !== 'salida' && type !== 'ajuste') {
    return { error: 'Tipo de movimiento inválido.' };
  }
  if (counterparty.length > LOCATION_MAX_LENGTH) {
    return { error: `El origen no puede superar los ${LOCATION_MAX_LENGTH} caracteres.` };
  }
  if (referenceCode.length > REFERENCE_CODE_MAX_LENGTH) {
    return { error: `El código de referencia no puede superar los ${REFERENCE_CODE_MAX_LENGTH} caracteres.` };
  }
  if (commentRaw && commentRaw.length > COMMENT_MAX_LENGTH) {
    return { error: `El comentario no puede superar los ${COMMENT_MAX_LENGTH} caracteres.` };
  }

  const resolved = resolveSignedQty(type, Number(qtyRaw));
  if (!resolved.ok) return { error: resolved.error };

  // "Origen" always names the counterparty (proveedor/cliente); a salida moves
  // stock out to them, so the warehouse is the source and they're the destination.
  const [fromLocation, toLocation] = type === 'salida'
    ? ['Almacén', counterparty]
    : [counterparty, 'Almacén'];

  // Lock the part row for the duration of the check+insert so two concurrent
  // movements on the same SKU (e.g. two salidas racing for the last unit)
  // serialize instead of both reading the same stock and both passing.
  const result = await db.transaction(async (tx) => {
    const [part] = await tx.select().from(parts).where(eq(parts.id, partId)).for('update').limit(1);
    if (!part) return { error: 'El repuesto no existe.' } satisfies ActionResult;

    if (resolved.qty < 0) {
      const existingMovements = await tx.select().from(movements).where(eq(movements.partId, partId));
      const currentStock = computeStock(existingMovements.map((m) => ({ type: m.type, qty: m.qty, createdAt: m.createdAt })));
      if (currentStock + resolved.qty < 0) {
        return { error: `Stock insuficiente: hay ${currentStock} unidades disponibles.` } satisfies ActionResult;
      }
    }

    await tx.insert(movements).values({
      partId, type, qty: resolved.qty, fromLocation, toLocation, referenceCode,
      comment: commentRaw && commentRaw.length > 0 ? commentRaw : null,
      userId: user.id, userEmail: user.email ?? 'desconocido',
    });
    return { success: true } satisfies ActionResult;
  });

  if ('error' in result) return result;

  revalidatePath('/inventario');
  revalidatePath('/movimientos');
  revalidatePath('/reportes');
  revalidatePath('/alertas');
  revalidatePath('/');
  return result;
}

// Voids a movement by inserting a compensating reversal (type 'ajuste' with the
// negated quantity) instead of editing/deleting the original — the ledger stays
// immutable and every correction is attributable to whoever made it.
export async function reverseMovement(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const [orig] = await db.select().from(movements).where(eq(movements.id, id)).limit(1);
  if (!orig) return { error: 'El movimiento no existe.' };
  if (orig.reversesMovementId) return { error: 'No se puede anular una anulación.' };

  // Lock the part row so a double-click or two people reversing the same
  // movement at once serialize instead of both passing the "already voided"
  // check before either insert lands. The partial unique index on
  // reverses_movement_id backs this up at the DB level as a second guard.
  const result = await db.transaction(async (tx) => {
    await tx.select().from(parts).where(eq(parts.id, orig.partId)).for('update').limit(1);

    const [already] = await tx.select().from(movements).where(eq(movements.reversesMovementId, id)).limit(1);
    if (already) return { error: 'Este movimiento ya fue anulado.' } satisfies ActionResult;

    const partMovements = await tx.select().from(movements).where(eq(movements.partId, orig.partId));
    const currentStock = computeStock(partMovements.map((m) => ({ type: m.type, qty: m.qty, createdAt: m.createdAt })));
    if (currentStock - orig.qty < 0) {
      return { error: `No se puede anular: dejaría el stock en ${currentStock - orig.qty}. Hay ${currentStock} unidades disponibles.` } satisfies ActionResult;
    }

    try {
      await tx.insert(movements).values({
        partId: orig.partId,
        type: 'ajuste',
        qty: -orig.qty,
        fromLocation: orig.toLocation,
        toLocation: orig.fromLocation,
        referenceCode: `ANULA ${orig.referenceCode}`,
        userId: user.id,
        userEmail: user.email ?? 'desconocido',
        reversesMovementId: orig.id,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { error: 'Este movimiento ya fue anulado.' } satisfies ActionResult;
      }
      throw err;
    }
    return { success: true } satisfies ActionResult;
  });

  if ('error' in result) return result;

  revalidatePath('/inventario');
  revalidatePath('/movimientos');
  revalidatePath('/reportes');
  revalidatePath('/alertas');
  revalidatePath('/');
  return result;
}
