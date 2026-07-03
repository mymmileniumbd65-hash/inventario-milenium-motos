import type { MovementType } from '@/lib/inventory';

// Well under Postgres' `integer` range (±2.147B) — a real movement will never
// need more than this, and it keeps out-of-range values from ever reaching
// the DB as an unhandled insert error.
const MAX_QTY = 1_000_000;

export function resolveSignedQty(
  type: MovementType, qty: number
): { ok: true; qty: number } | { ok: false; error: string } {
  if (!Number.isInteger(qty)) {
    return { ok: false, error: 'La cantidad debe ser un número entero distinto de 0.' };
  }
  if (Math.abs(qty) > MAX_QTY) {
    return { ok: false, error: `La cantidad no puede superar ${MAX_QTY.toLocaleString('es-PE')} unidades.` };
  }
  if (type === 'ingreso') {
    if (qty <= 0) return { ok: false, error: 'Para un ingreso, la cantidad debe ser positiva.' };
    return { ok: true, qty };
  }
  if (type === 'salida') {
    if (qty <= 0) return { ok: false, error: 'Para una salida, ingresa la cantidad como un número positivo.' };
    return { ok: true, qty: -qty };
  }
  if (qty === 0) {
    return { ok: false, error: 'La cantidad debe ser un número entero distinto de 0.' };
  }
  return { ok: true, qty };
}
