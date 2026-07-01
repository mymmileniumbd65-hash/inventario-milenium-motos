import type { MovementType } from '@/lib/inventory';

export function resolveSignedQty(
  type: MovementType, qty: number
): { ok: true; qty: number } | { ok: false; error: string } {
  if (!Number.isInteger(qty)) {
    return { ok: false, error: 'La cantidad debe ser un número entero distinto de 0.' };
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
