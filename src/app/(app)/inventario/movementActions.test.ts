import { describe, it, expect } from 'vitest';
import { resolveSignedQty } from './movementLogic';

describe('resolveSignedQty', () => {
  it('keeps ingreso positive', () => {
    expect(resolveSignedQty('ingreso', 10)).toEqual({ ok: true, qty: 10 });
  });
  it('rejects a non-positive ingreso', () => {
    expect(resolveSignedQty('ingreso', 0)).toEqual({ ok: false, error: 'Para un ingreso, la cantidad debe ser positiva.' });
  });
  it('negates salida', () => {
    expect(resolveSignedQty('salida', 5)).toEqual({ ok: true, qty: -5 });
  });
  it('rejects a non-positive salida input', () => {
    expect(resolveSignedQty('salida', -2)).toEqual({ ok: false, error: 'Para una salida, ingresa la cantidad como un número positivo.' });
  });
  it('allows ajuste to be positive or negative but not zero', () => {
    expect(resolveSignedQty('ajuste', -3)).toEqual({ ok: true, qty: -3 });
    expect(resolveSignedQty('ajuste', 3)).toEqual({ ok: true, qty: 3 });
    expect(resolveSignedQty('ajuste', 0)).toEqual({ ok: false, error: 'La cantidad debe ser un número entero distinto de 0.' });
  });
  it('rejects a non-integer quantity', () => {
    expect(resolveSignedQty('ingreso', 1.5)).toEqual({
      ok: false,
      error: 'La cantidad debe ser un número entero distinto de 0.',
    });
  });
  it('rejects a quantity above the maximum allowed', () => {
    expect(resolveSignedQty('ajuste', 1_000_001)).toEqual({
      ok: false,
      error: 'La cantidad no puede superar 1,000,000 unidades.',
    });
  });
});
