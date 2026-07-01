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

export type AlertSeverity = 'Crítica' | 'Alta' | 'Media';

export interface Alert {
  sev: AlertSeverity;
  tipo: string;
  sku: string;
  desc: string;
  groupName: string;
  detail: string;
  accion: string;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { Crítica: 0, Alta: 1, Media: 2 };

export function buildAlerts(parts: PartComputed[]): Alert[] {
  const alerts: Alert[] = [];
  for (const p of parts) {
    if (p.stock === 0) {
      alerts.push({
        sev: 'Crítica', tipo: 'Agotado', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: '0 unidades en stock', accion: `reponer ${p.minStock * 2} u.`,
      });
    } else if (p.stock < p.minStock) {
      alerts.push({
        sev: 'Alta', tipo: 'Stock bajo', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: `${p.stock} u. · mínimo ${p.minStock} u.`, accion: `reponer ${p.minStock * 2 - p.stock} u.`,
      });
    }
    if (p.stock > 0 && p.rotationDays !== null && p.rotationDays >= 60) {
      alerts.push({
        sev: 'Media', tipo: 'Baja rotación', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: `${p.rotationDays} días de cobertura estimados`, accion: 'promoción / descuento',
      });
    }
    if (p.minStock > 0 && p.stock >= p.minStock * 4) {
      alerts.push({
        sev: 'Media', tipo: 'Exceso de stock', sku: p.sku, desc: p.description, groupName: p.groupName,
        detail: `${p.stock} u. · ${(p.stock / p.minStock).toFixed(1)}× el mínimo`, accion: 'pausar compra',
      });
    }
  }
  return alerts.sort((a, b) => SEVERITY_ORDER[a.sev] - SEVERITY_ORDER[b.sev]);
}

export interface CompraSugerida {
  sku: string; desc: string; groupName: string;
  actual: number; min: number; sugerido: number; prio: AlertSeverity;
}

export function buildComprasSugeridas(parts: PartComputed[]): CompraSugerida[] {
  return parts
    .filter((p) => p.status === 'Agotado' || p.status === 'Stock bajo')
    .map((p) => ({
      sku: p.sku, desc: p.description, groupName: p.groupName,
      actual: p.stock, min: p.minStock,
      sugerido: Math.max(p.minStock * 2 - p.stock, p.minStock),
      prio: (p.stock === 0 ? 'Crítica' : 'Alta') as AlertSeverity,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.prio] - SEVERITY_ORDER[b.prio]);
}

export interface GroupBar { id: string; name: string; count: number; skuCount: number; pct: number; }

export function buildGroupBars(parts: PartComputed[], groups: { id: string; name: string }[]): GroupBar[] {
  const totalAll = parts.reduce((s, p) => s + p.stock, 0);
  return groups.map((g) => {
    const groupParts = parts.filter((p) => p.groupId === g.id);
    const count = groupParts.reduce((s, p) => s + p.stock, 0);
    return {
      id: g.id, name: g.name, count, skuCount: groupParts.length,
      pct: totalAll > 0 ? Math.round((count / totalAll) * 100) : 0,
    };
  });
}

export interface DashboardKpis {
  totalUnits: number; totalSkus: number; inStockSkus: number; totalGroups: number;
  activeAlerts: number; criticalAlerts: number; highAlerts: number;
  avgRotationDays: number | null; movementsLast7Days: number;
}

export function buildDashboardKpis(
  parts: PartComputed[], groupCount: number, alerts: Alert[], movementsLast7Days: number
): DashboardKpis {
  const totalUnits = parts.reduce((s, p) => s + p.stock, 0);
  const rotating = parts.filter((p): p is PartComputed & { rotationDays: number } => p.stock > 0 && p.rotationDays !== null);
  const avgRotationDays = rotating.length > 0
    ? Math.round(rotating.reduce((s, p) => s + p.rotationDays, 0) / rotating.length)
    : null;
  return {
    totalUnits, totalSkus: parts.length, inStockSkus: parts.filter((p) => p.stock > 0).length,
    totalGroups: groupCount, activeAlerts: alerts.length,
    criticalAlerts: alerts.filter((a) => a.sev === 'Crítica').length,
    highAlerts: alerts.filter((a) => a.sev === 'Alta').length,
    avgRotationDays, movementsLast7Days,
  };
}

export interface ReportKpis {
  unitsToReplenish: number; comprasCount: number; excessCount: number;
  slowRotationCount: number; coverageRatio: number | null;
}

export function buildReportKpis(parts: PartComputed[], compras: CompraSugerida[]): ReportKpis {
  const totalAll = parts.reduce((s, p) => s + p.stock, 0);
  const totalMin = parts.reduce((s, p) => s + p.minStock, 0);
  return {
    unitsToReplenish: compras.reduce((s, r) => s + r.sugerido, 0),
    comprasCount: compras.length,
    excessCount: parts.filter((p) => p.status === 'Exceso').length,
    slowRotationCount: parts.filter((p) => p.rotationDays !== null && p.rotationDays >= 60).length,
    coverageRatio: totalMin > 0 ? Math.round((totalAll / totalMin) * 10) / 10 : null,
  };
}
