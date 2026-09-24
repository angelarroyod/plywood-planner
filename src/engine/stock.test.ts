import { describe, expect, it } from 'vitest';
import { DEFAULT_MATERIAL, FIBRACEL_3, MATERIAL_OPTIONS, STOCKS, getStock } from './stock.ts';

describe('stock catalog', () => {
  it('has unique ids', () => {
    expect(new Set(STOCKS.map((s) => s.id)).size).toBe(STOCKS.length);
  });

  it('ships every stock on a 1220 × 2440 sheet', () => {
    for (const s of STOCKS) expect(s.sheet).toEqual({ length: 2440, width: 1220 });
  });

  it('looks stocks up by id', () => {
    expect(getStock(3)).toMatchObject({ label: 'Triplay de pino 18 mm', thickness: 18, maxSpan: 800 });
    expect(getStock(4)).toMatchObject({ label: 'Melamina blanca 16 mm', thickness: 16, hasGrain: false, maxSpan: 550 });
  });

  it('throws on unknown ids', () => {
    expect(() => getStock(999)).toThrow(/999/);
  });

  it('offers only shelf-capable stocks as materials, in catalog order', () => {
    expect(MATERIAL_OPTIONS).toEqual([
      { value: 1, label: 'Triplay de pino 12 mm' },
      { value: 2, label: 'Triplay de pino 15 mm' },
      { value: 3, label: 'Triplay de pino 18 mm' },
      { value: 4, label: 'Melamina blanca 16 mm' },
    ]);
  });

  it('defaults to 18 mm plywood and backs with 3 mm Fibracel', () => {
    expect(getStock(DEFAULT_MATERIAL).thickness).toBe(18);
    expect(FIBRACEL_3).toMatchObject({ id: 5, label: 'Fibracel 3 mm', thickness: 3, hasGrain: false, maxSpan: null });
  });

  it("knows each board's material and band", () => {
    expect(STOCKS.map((s) => [s.id, s.material, s.edgeBand?.label ?? null])).toEqual([
      [1, 'triplay', 'Cubrecanto de chapa de pino 16 mm'],
      [2, 'triplay', 'Cubrecanto de chapa de pino 19 mm'],
      [3, 'triplay', 'Cubrecanto de chapa de pino 22 mm'],
      [4, 'melamina', 'Cubrecanto PVC blanco 19 × 0.45 mm'],
      [5, 'fibracel', null],
    ]);
  });
});
