import { describe, it, expect } from 'vitest';
import { computeStock, statusOf, computeRotationDays, computeParts, buildAlerts, buildComprasSugeridas, buildGroupBars, buildDashboardKpis } from './inventory';
import type { PartInput } from './inventory';

describe('computeStock', () => {
  it('sums positive and negative movement quantities', () => {
    const stock = computeStock([
      { type: 'ingreso', qty: 10, createdAt: new Date('2026-01-01') },
      { type: 'salida', qty: -3, createdAt: new Date('2026-01-02') },
      { type: 'ajuste', qty: -1, createdAt: new Date('2026-01-03') },
    ]);
    expect(stock).toBe(6);
  });

  it('returns 0 for a part with no movements', () => {
    expect(computeStock([])).toBe(0);
  });
});

describe('statusOf', () => {
  it('is Agotado when stock is 0', () => {
    expect(statusOf(0, 5)).toBe('Agotado');
  });
  it('is Stock bajo when stock is below the minimum', () => {
    expect(statusOf(3, 5)).toBe('Stock bajo');
  });
  it('is Exceso when stock is at least 4x the minimum', () => {
    expect(statusOf(20, 5)).toBe('Exceso');
  });
  it('is Disponible otherwise', () => {
    expect(statusOf(8, 5)).toBe('Disponible');
  });
});

describe('computeRotationDays', () => {
  const now = new Date('2026-06-30T00:00:00Z');

  it('returns null when there are no salida movements in the last 90 days', () => {
    const rotation = computeRotationDays(
      [{ type: 'ingreso', qty: 10, createdAt: new Date('2026-06-01') }],
      now
    );
    expect(rotation).toBeNull();
  });

  it('computes days of coverage from trailing 90-day sell-through velocity', () => {
    // 10 units in stock, 45 units sold over the last 90 days -> velocity 0.5/day -> 20 days of coverage
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 55, createdAt: new Date('2026-04-01') },
        { type: 'salida', qty: -45, createdAt: new Date('2026-06-01') },
      ],
      now
    );
    expect(rotation).toBe(20);
  });

  it('ignores salida movements older than 90 days', () => {
    const rotation = computeRotationDays(
      [
        { type: 'ingreso', qty: 10, createdAt: new Date('2025-01-01') },
        { type: 'salida', qty: -5, createdAt: new Date('2025-01-15') },
      ],
      now
    );
    expect(rotation).toBeNull();
  });
});

const now = new Date('2026-06-30T00:00:00Z');

function part(overrides: Partial<PartInput>): PartInput {
  return {
    id: 'id-1', sku: 'SKU-1', description: 'Repuesto de prueba', compat: 'Universal',
    groupId: 'g1', groupName: 'Grupo 1', minStock: 5, movements: [],
    ...overrides,
  };
}

describe('buildAlerts', () => {
  it('flags a part with 0 stock as Crítica / Agotado', () => {
    const parts = computeParts([part({ movements: [] })], now);
    const alerts = buildAlerts(parts);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ sev: 'Crítica', tipo: 'Agotado', sku: 'SKU-1' });
  });

  it('flags a part below minimum as Alta / Stock bajo', () => {
    const parts = computeParts(
      [part({ movements: [{ type: 'ingreso', qty: 3, createdAt: now }] })],
      now
    );
    const alerts = buildAlerts(parts);
    expect(alerts[0]).toMatchObject({ sev: 'Alta', tipo: 'Stock bajo' });
  });

  it('flags 4x-minimum stock as Media / Exceso de stock', () => {
    const parts = computeParts(
      [part({ movements: [{ type: 'ingreso', qty: 20, createdAt: now }] })],
      now
    );
    const alerts = buildAlerts(parts);
    expect(alerts.some((a) => a.tipo === 'Exceso de stock' && a.sev === 'Media')).toBe(true);
  });

  it('sorts alerts by severity: Crítica, Alta, Media', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', movements: [{ type: 'ingreso', qty: 20, createdAt: now }] }), // Exceso -> Media
        part({ id: 'b', sku: 'B', movements: [] }), // Agotado -> Crítica
        part({ id: 'c', sku: 'C', movements: [{ type: 'ingreso', qty: 2, createdAt: now }] }), // Stock bajo -> Alta
      ],
      now
    );
    const alerts = buildAlerts(parts);
    expect(alerts.map((a) => a.sev)).toEqual(['Crítica', 'Alta', 'Media']);
  });
});

describe('buildComprasSugeridas', () => {
  it('includes only Agotado and Stock bajo parts, sorted by priority', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', movements: [] }), // Agotado
        part({ id: 'b', sku: 'B', movements: [{ type: 'ingreso', qty: 3, createdAt: now }] }), // Stock bajo
        part({ id: 'c', sku: 'C', movements: [{ type: 'ingreso', qty: 20, createdAt: now }] }), // Disponible/Exceso
      ],
      now
    );
    const rows = buildComprasSugeridas(parts);
    expect(rows.map((r) => r.sku)).toEqual(['A', 'B']);
    expect(rows[0].prio).toBe('Crítica');
    expect(rows[0].sugerido).toBe(10); // min 5 * 2 - 0
  });
});

describe('buildGroupBars', () => {
  it('computes unit count and percentage share per group', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', groupId: 'g1', groupName: 'Grupo 1', movements: [{ type: 'ingreso', qty: 10, createdAt: now }] }),
        part({ id: 'b', sku: 'B', groupId: 'g2', groupName: 'Grupo 2', movements: [{ type: 'ingreso', qty: 30, createdAt: now }] }),
      ],
      now
    );
    const bars = buildGroupBars(parts, [{ id: 'g1', name: 'Grupo 1' }, { id: 'g2', name: 'Grupo 2' }]);
    expect(bars.find((b) => b.id === 'g1')).toMatchObject({ count: 10, skuCount: 1, pct: 25 });
    expect(bars.find((b) => b.id === 'g2')).toMatchObject({ count: 30, skuCount: 1, pct: 75 });
  });
});

describe('buildDashboardKpis', () => {
  it('summarizes totals, alerts and average rotation', () => {
    const parts = computeParts(
      [
        part({ id: 'a', sku: 'A', movements: [{ type: 'ingreso', qty: 55, createdAt: new Date('2026-04-01') }, { type: 'salida', qty: -45, createdAt: new Date('2026-06-01') }] }),
        part({ id: 'b', sku: 'B', movements: [] }),
      ],
      now
    );
    const alerts = buildAlerts(parts);
    const kpis = buildDashboardKpis(parts, 2, alerts, 3);
    expect(kpis.totalUnits).toBe(10);
    expect(kpis.totalSkus).toBe(2);
    expect(kpis.totalGroups).toBe(2);
    expect(kpis.criticalAlerts).toBe(1);
    expect(kpis.avgRotationDays).toBe(20);
    expect(kpis.movementsLast7Days).toBe(3);
  });
});
