import { describe, expect, it } from 'vitest';
import { EMPTY_PRICES, hardwareKey, missingPricesText, normalizePrices, orderCost, type Prices } from './cost.ts';
import { buildOrder } from './order.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';

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
};

describe('orderCost', () => {
  it('prices sheets, cutting, band and hardware, in that order', () => {
    expect(orderCost(order(), FULL).lines.map((l) => [l.key, l.label, l.qty, l.unit, l.price])).toEqual([
      ['sheet:3', 'Triplay de pino 18 mm', 1, 'hoja', 950],
      ['sheet:5', 'Fibracel 3 mm', 1, 'hoja', 180],
      ['cut', 'Corte', 12.6, 'm', 4],
      ['band:Cubrecanto de chapa de pino 22 mm', 'Cubrecanto de chapa de pino 22 mm', 7.1, 'm', 12],
      ['hw:confirmat 5x50', 'Tornillo confirmat 5x50', 20, 'pza', 2],
      ['hw:screw 3.5x16', 'Tornillo 3.5x16', 32, 'pza', 0.5],
    ]);
  });

  it('adds up every priced line', () => {
    const { total, missing } = orderCost(order(), FULL);
    // 950 + 180 + 12.6·4 + 7.1·12 + 20·2 + 32·0.5 = 950 + 180 + 50.4 + 85.2 + 40 + 16
    expect(total).toBeCloseTo(1321.6);
    expect(missing).toBe(0);
  });

  it('prices cutting per cut when asked', () => {
    const cut = orderCost(order(), { ...FULL, cut: { unit: 'cut', price: 10 } }).lines.find((l) => l.key === 'cut');
    expect(cut).toMatchObject({ qty: 13, unit: 'corte', price: 10, subtotal: 130 });
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
    expect(EMPTY_PRICES).toEqual({ sheets: {}, cut: { unit: 'meter', price: 0 }, bands: {}, hardware: {} });
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
    };
    expect(normalizePrices(full)).toEqual(full);
  });
});
