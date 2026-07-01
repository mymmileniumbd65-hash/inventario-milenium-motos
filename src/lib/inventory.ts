export type MovementType = 'ingreso' | 'salida' | 'ajuste';

export interface MovementInput {
  type: MovementType;
  qty: number;
  createdAt: Date;
}

export interface PartInput {
  id: string;
  sku: string;
  description: string;
  compat: string;
  groupId: string;
  groupName: string;
  minStock: number;
  movements: MovementInput[];
}

export type PartStatus = 'Disponible' | 'Stock bajo' | 'Agotado' | 'Exceso';

export function computeStock(movements: MovementInput[]): number {
  return movements.reduce((sum, m) => sum + m.qty, 0);
}

export function statusOf(stock: number, minStock: number): PartStatus {
  if (stock === 0) return 'Agotado';
  if (stock < minStock) return 'Stock bajo';
  if (minStock > 0 && stock >= minStock * 4) return 'Exceso';
  return 'Disponible';
}

const ROTATION_WINDOW_DAYS = 90;

export function computeRotationDays(movements: MovementInput[], now: Date = new Date()): number | null {
  const windowStart = new Date(now.getTime() - ROTATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const salidaUnits = movements
    .filter((m) => m.type === 'salida' && m.createdAt >= windowStart)
    .reduce((sum, m) => sum + Math.abs(m.qty), 0);
  if (salidaUnits === 0) return null;
  const stock = computeStock(movements);
  const dailyVelocity = salidaUnits / ROTATION_WINDOW_DAYS;
  return Math.round(stock / dailyVelocity);
}

export interface PartComputed extends PartInput {
  stock: number;
  status: PartStatus;
  rotationDays: number | null;
}

export function computeParts(parts: PartInput[], now: Date = new Date()): PartComputed[] {
  return parts.map((p) => {
    const stock = computeStock(p.movements);
    return {
      ...p,
      stock,
      status: statusOf(stock, p.minStock),
      rotationDays: computeRotationDays(p.movements, now),
    };
  });
}
