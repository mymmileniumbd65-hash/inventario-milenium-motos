import { describe, it, expect } from 'vitest';
import { computeStock, statusOf, computeRotationDays } from './inventory';

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
