import { describe, it, expect } from 'vitest';
import { filterParts } from './partSearch';

const parts = [
  { sku: 'PAR-17', description: 'Parabrisas 17" cristal' },
  { sku: 'PAR-19', description: 'Parabrisas 19" ahumado' },
  { sku: 'LLA-8017', description: 'Llanta 80/100-17' },
  { sku: 'CAD-428', description: 'Cadena 428H · 120L' },
];

describe('filterParts', () => {
  it('devuelve todo con query vacía', () => {
    expect(filterParts(parts, '')).toEqual(parts);
  });

  it('devuelve todo con query de solo espacios', () => {
    expect(filterParts(parts, '   ')).toEqual(parts);
  });

  it('filtra por SKU, sin distinguir mayúsculas', () => {
    expect(filterParts(parts, 'lla-80')).toEqual([parts[2]]);
  });

  it('filtra por descripción, sin distinguir mayúsculas', () => {
    expect(filterParts(parts, 'PARABRISAS')).toEqual([parts[0], parts[1]]);
  });

  it('ignora tildes en la query y en los datos', () => {
    const conTilde = [{ sku: 'AMO-1', description: 'Amortiguador hidráulico' }];
    expect(filterParts(conTilde, 'hidraulico')).toEqual(conTilde);
    expect(filterParts(parts, 'cádena')).toEqual([parts[3]]);
  });

  it('devuelve [] sin coincidencias', () => {
    expect(filterParts(parts, 'zzz')).toEqual([]);
  });
});
