import { describe, expect, it } from 'vitest';
import { EMPTY_PRICES, hardwareKey, missingPricesText, normalizePrices, orderCost, type Prices } from './cost.ts';
import { buildOrder } from './order.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';
import type { Boring } from './types.ts';

function order(params = {}) {
  const result = bookshelf.generate(params);
  if (!result.ok) throw new Error('bookshelf must validate');
  return buildOrder(result.design, nest(result.design.panels), 'Librero');
}

const FULL: Prices = {
  sheets: { 3: 950, 5: 180 },
  cut: { unit: 'meter', price: 4 },
  bands: { 'Cubrecanto de chapa de pino 22 mm': 12 },
  hardware: { 'confirmat 5x50': 2, 'screw 3.5x16': 0.5 },
  boring: 5,
};

describe('orderCost', () => {
  it('prices sheets, cutting, band and hardware, in that order', () => {
    expect(orderCost(order(), FULL).lines.map((l) => [l.key, l.label, l.qty, l.unit, l.price])).toEqual([
      ['sheet:3', 'Triplay de pino 18 mm', 1, 'hoja', 950],
      ['sheet:5', 'Fibracel 3 mm', 1, 'hoja', 180],
      ['cut', 'Corte', 12.2, 'm', 4],
      ['band:Cubrecanto de chapa de pino 22 mm', 'Cubrecanto de chapa de pino 22 mm', 7.1, 'm', 12],
      ['hw:confirmat 5x50', 'Tornillo confirmat 5x50', 20, 'pza', 2],
      ['hw:screw 3.5x16', 'Tornillo 3.5x16', 32, 'pza', 0.5],
    ]);
  });

  it('adds up every priced line', () => {
    const { total, missing } = orderCost(order(), FULL);
    // 950 + 180 + 12.2·4 + 7.1·12 + 20·2 + 32·0.5 = 950 + 180 + 48.8 + 85.2 + 40 + 16
    expect(total).toBeCloseTo(1320);
    expect(missing).toBe(0);
  });

  it('prices cutting per cut when asked', () => {
    const cut = orderCost(order(), { ...FULL, cut: { unit: 'cut', price: 10 } }).lines.find((l) => l.key === 'cut');
    expect(cut).toMatchObject({ qty: 12, unit: 'corte', price: 10, subtotal: 120 });
  });

  it('leaves unpriced lines out of the total and counts them', () => {
    const partial: Prices = { ...EMPTY_PRICES, sheets: { 3: 950, 5: 0 }, hardware: { 'confirmat 5x50': -1 } };
    const { lines, total, missing } = orderCost(order(), partial);
    expect(total).toBe(950);
    expect(missing).toBe(5); // Fibracel (0), cut, band, confirmat (negative), screw
    expect(lines.find((l) => l.key === 'sheet:5')).toMatchObject({ price: null, subtotal: null });
  });

  it('has no band line when nothing is banded', () => {
    expect(orderCost(order({ edgeBanding: 0 }), FULL).lines.some((l) => l.key.startsWith('band:'))).toBe(false);
  });

  it('keys hardware by type and size', () => {
    expect(hardwareKey({ type: 'confirmat', size: '5x50', qty: 20 })).toBe('confirmat 5x50');
  });

  it('starts with no prices', () => {
    expect(EMPTY_PRICES).toEqual({ sheets: {}, cut: { unit: 'meter', price: 0 }, bands: {}, hardware: {}, boring: 0 });
  });
});

describe('missingPricesText', () => {
  it('uses the singular for one missing price', () => {
    expect(missingPricesText(1)).toBe('falta 1 precio');
  });

  it('uses the plural otherwise', () => {
    expect(missingPricesText(0)).toBe('faltan 0 precios');
    expect(missingPricesText(2)).toBe('faltan 2 precios');
  });
});

describe('normalizePrices', () => {
  it('falls back to EMPTY_PRICES for undefined', () => {
    expect(normalizePrices(undefined)).toEqual(EMPTY_PRICES);
  });

  it('keeps only the finite-number entries it finds, defaulting the rest', () => {
    expect(normalizePrices({ sheets: { 3: 950 } })).toEqual({ ...EMPTY_PRICES, sheets: { 3: 950 } });
  });

  it('drops a malformed cut unit/price and non-numeric band entries', () => {
    expect(normalizePrices({ cut: { unit: 'bogus', price: 'x' }, bands: { a: 5, b: 'x' } })).toEqual({
      ...EMPTY_PRICES,
      cut: EMPTY_PRICES.cut,
      bands: { a: 5 },
    });
  });

  it('round-trips a full valid object unchanged', () => {
    const full: Prices = {
      sheets: { 3: 950, 5: 180 },
      cut: { unit: 'cut', price: 10 },
      bands: { 'Cubrecanto de chapa de pino 22 mm': 12 },
      hardware: { 'confirmat 5x50': 2 },
      boring: 7,
    };
    expect(normalizePrices(full)).toEqual(full);
  });
});

describe('boring cost', () => {
  const cups: Boring = { panelId: 'side', kind: 'hinge-cup', diameter: 35, depth: 12, fromEdge: 22, along: [100, 600, 1100] };

  function drilled() {
    const result = bookshelf.generate({});
    if (!result.ok) throw new Error('bookshelf must validate');
    const design = { ...result.design, boring: [cups] };
    return buildOrder(design, nest(design.panels), 'Librero');
  }

  it("prices the yard's hinge drilling per hole, right after cutting", () => {
    const lines = orderCost(drilled(), FULL).lines;
    expect(lines.map((l) => l.key).slice(2, 4)).toEqual(['cut', 'boring']);
    expect(lines.find((l) => l.key === 'boring')).toEqual({
      key: 'boring',
      label: 'Barrenado de bisagra',
      qty: 6, // 2 sides × 3 cups
      unit: 'perforación',
      price: 5,
      subtotal: 30,
    });
  });

  it('counts the drilling as missing until it has a price', () => {
    const { lines, missing } = orderCost(drilled(), { ...FULL, boring: 0 });
    expect(lines.find((l) => l.key === 'boring')!.price).toBeNull();
    expect(missing).toBe(1);
  });

  it('has no drilling line without holes', () => {
    expect(orderCost(order(), FULL).lines.some((l) => l.key === 'boring')).toBe(false);
  });

  it('defaults a missing stored boring price to 0', () => {
    expect(normalizePrices({ sheets: { 3: 950 } }).boring).toBe(0);
    expect(normalizePrices({ boring: 'x' }).boring).toBe(0);
    expect(normalizePrices({ boring: 4.5 }).boring).toBe(4.5);
  });
});
