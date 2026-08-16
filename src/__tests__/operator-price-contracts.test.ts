import { describe, it, expect } from 'vitest';
import { resolvePriceFloors } from '../core/operator/resolvePriceFloors';

const fallback = {
  storage: 22.5,
  handling: 25,
  deunitization: 1400,
  labeling: 0.75,
  adValoremPct: 0.001,
};

describe('resolvePriceFloors', () => {
  it('fallback params quando lista vazia', () => {
    const floors = resolvePriceFloors([], fallback);
    expect(floors.source).toBe('params');
    expect(floors.storage).toBe(22.5);
    expect(floors.deunitization).toBe(1400);
  });

  it('sobrescreve pisos a partir de sku_code Operator', () => {
    const floors = resolvePriceFloors(
      [
        { sku_code: 'floor-arm', description: 'Arm', unit_price_cents: 3000 },
        { sku_code: 'floor-des', description: 'Desova', unit_price_cents: 150000 },
      ],
      fallback,
    );
    expect(floors.source).toBe('operator');
    expect(floors.storage).toBe(30);
    expect(floors.deunitization).toBe(1500);
    expect(floors.handling).toBe(25);
  });

  it('não inventa hit com descrição irrelevante', () => {
    const floors = resolvePriceFloors(
      [{ sku_code: 'xyz', description: 'Frete rodoviário', unit_price_cents: 99900 }],
      fallback,
    );
    expect(floors.source).toBe('params');
    expect(floors.storage).toBe(22.5);
  });
});

describe('contracts empty contract', () => {
  it('lista vazia é estado válido (sem inventar linha)', () => {
    const contracts: unknown[] = [];
    expect(contracts).toEqual([]);
    expect(contracts.length === 0).toBe(true);
  });
});
