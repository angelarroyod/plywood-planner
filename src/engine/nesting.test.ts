import { describe, expect, it } from 'vitest';
import { estimateCost, nest } from './nesting.ts';
import { getStock } from './stock.ts';
import { DEFAULT_CONFIG } from './types.ts';
import type { NestingResult, Panel, PlacedPiece, Stock } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';

const PLY18 = getStock(3);
const PLY12 = getStock(1);
const MELAMINA = getStock(4);
const FIBRACEL = getStock(5);
const SHEET = PLY18.sheet; // 1220 × 2440
const KERF = DEFAULT_CONFIG.nesting.kerf;

function panel(over: Partial<Panel> = {}): Panel {
  return { id: 'p', label: 'P', length: 600, width: 400, stock: PLY18, grain: 'any', qty: 1, ...over };
}

function allPieces(r: NestingResult): PlacedPiece[] {
  return r.sheets.flatMap((s) => s.pieces);
}

/** Gap between two axis-aligned rects along one axis; negative = overlapping ranges. */
function axisGap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(a0 - b1, b0 - a1);
}

function assertNoOverlapWithKerf(r: NestingResult): void {
  for (const sheet of r.sheets) {
    const ps = sheet.pieces;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]!;
        const b = ps[j]!;
        const xGap = axisGap(a.x, a.x + a.width, b.x, b.x + b.width);
        const yGap = axisGap(a.y, a.y + a.length, b.y, b.y + b.length);
        // separated by at least the kerf along at least one axis
        expect(Math.max(xGap, yGap)).toBeGreaterThanOrEqual(KERF);
      }
    }
  }
}

function bookshelfPanels(): Panel[] {
  const result = bookshelf.generate({});
  if (!result.ok) throw new Error('default bookshelf must validate');
  return result.design.panels;
}

describe('nest', () => {
  it('expands qty into individual instances', () => {
    const r = nest([panel({ qty: 3 })]);
    const pieces = allPieces(r);
    expect(pieces).toHaveLength(3);
    expect(pieces.map((p) => p.instance).sort()).toEqual([0, 1, 2]);
  });

  it('keeps every piece inside its sheet', () => {
    const r = nest(bookshelfPanels());
    for (const sheet of r.sheets) {
      for (const p of sheet.pieces) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width).toBeLessThanOrEqual(sheet.stock.sheet.width);
        expect(p.y + p.length).toBeLessThanOrEqual(sheet.stock.sheet.length);
      }
    }
  });

  it('never overlaps pieces and keeps kerf between them', () => {
    const r = nest([
      ...bookshelfPanels(),
      panel({ id: 'extra1', length: 900, width: 350, qty: 3 }),
      panel({ id: 'extra2', length: 400, width: 400, qty: 5 }),
    ]);
    assertNoOverlapWithKerf(r);
  });

  it("respects grain 'length': never rotated, length along sheet length", () => {
    const r = nest([panel({ grain: 'length', length: 2000, width: 300, qty: 4 })]);
    for (const p of allPieces(r)) {
      expect(p.rotated).toBe(false);
      expect(p.length).toBe(2000);
      expect(p.width).toBe(300);
    }
  });

  it("respects grain 'width': always rotated, width along sheet length", () => {
    const r = nest([panel({ grain: 'width', length: 900, width: 300, qty: 3 })]);
    for (const p of allPieces(r)) {
      expect(p.rotated).toBe(true);
      expect(p.length).toBe(300); // panel width lies along sheet length (grain)
      expect(p.width).toBe(900);
    }
  });

  it('ignores grain on stock that has none', () => {
    // 2000 long across a 1220-wide sheet: impossible with plywood grain, fine on melamine
    const tooWide = { grain: 'width' as const, length: 2000, width: 500 };
    expect(() => nest([panel({ ...tooWide, stock: PLY18 })])).toThrow(/does not fit/);
    expect(nest([panel({ ...tooWide, stock: MELAMINA })]).sheets).toHaveLength(1);
  });

  it('applies kerf between pieces and starts new shelves when the row is full', () => {
    // three 600x600 pieces: two fit per row (600+3+600=1203 ≤ 1220), third opens a new shelf
    const r = nest([panel({ id: 'sq', grain: 'length', length: 600, width: 600, qty: 3 })]);
    expect(r.sheets).toHaveLength(1);
    const positions = allPieces(r)
      .map((p) => [p.x, p.y])
      .sort((a, b) => a[1]! - b[1]! || a[0]! - b[0]!);
    expect(positions).toEqual([
      [0, 0],
      [603, 0],
      [0, 603],
    ]);
  });

  it("uses each stock's own sheet size", () => {
    const wide: Stock = { ...PLY18, id: 99, label: 'Prueba 1830', sheet: { length: 2500, width: 1830 } };
    // two 900-wide pieces share one row on an 1830-wide sheet (900+3+900=1803); on 1220 they could not
    const r = nest([panel({ stock: wide, grain: 'length', length: 1000, width: 900, qty: 2 })]);
    expect(r.sheets).toHaveLength(1);
    expect(allPieces(r).map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [903, 0],
    ]);
  });

  it('never mixes stocks on a sheet, thickest stock first', () => {
    const r = nest([
      panel({ id: 'back', stock: FIBRACEL }),
      panel({ id: 'thin', stock: PLY12 }),
      panel({ id: 'thick', stock: PLY18 }),
    ]);
    expect(r.sheets.map((s) => s.stock.id)).toEqual([3, 1, 5]);
    expect(r.byStock.map((g) => g.stock.id)).toEqual([3, 1, 5]);
    const panelFor: Record<number, string> = { 3: 'thick', 1: 'thin', 5: 'back' };
    for (const sheet of r.sheets) {
      for (const p of sheet.pieces) expect(p.panelId).toBe(panelFor[sheet.stock.id]);
    }
  });

  it('spills onto extra sheets when full', () => {
    // 1100x1100 with fixed grain: one per shelf, two shelves per sheet → 5 pieces = 3 sheets
    const r = nest([panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 })]);
    expect(r.sheets).toHaveLength(3);
    expect(r.byStock).toEqual([expect.objectContaining({ sheets: 3 })]);
    assertNoOverlapWithKerf(r);
  });

  it('computes waste per stock', () => {
    const full = { grain: 'length' as const, length: SHEET.length, width: SHEET.width };
    const half = { grain: 'length' as const, length: SHEET.length / 2, width: SHEET.width };

    const r = nest([
      panel({ id: 'full', ...full, stock: PLY18 }),
      panel({ id: 'half', ...half, stock: FIBRACEL }),
    ]);
    expect(r.byStock).toHaveLength(2);
    expect(r.byStock[0]!.wastePercent).toBeCloseTo(0);
    expect(r.byStock[1]!.wastePercent).toBeCloseTo(50);
  });

  it('returns nothing for no panels or zero quantities', () => {
    expect(nest([])).toEqual({ sheets: [], byStock: [] });
    expect(nest([panel({ qty: 0 })])).toEqual({ sheets: [], byStock: [] });
  });

  it('rotates grain-free pieces to fit when needed', () => {
    // 1500 long does not fit across the 1220 width, but fits along the length once rotated
    const r = nest([panel({ id: 'wide', grain: 'any', length: 1500, width: 1000 })]);
    expect(r.sheets).toHaveLength(1);
    assertNoOverlapWithKerf(r);
  });

  it('throws when two different Stock objects share the same id', () => {
    const clashing: Stock = { ...PLY18, sheet: { length: 2500, width: 1830 } };
    expect(() => nest([panel({ stock: PLY18 }), panel({ id: 'p2', stock: clashing })])).toThrow(
      /two different stock objects/,
    );
  });

  it('throws when a panel cannot fit any sheet orientation', () => {
    expect(() => nest([panel({ grain: 'length', length: 2500, width: 300 })])).toThrow(
      /does not fit/,
    );
  });
});

describe('estimateCost', () => {
  // 3 plywood sheets + 1 Fibracel sheet
  const layout = () =>
    nest([
      panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 }),
      panel({ id: 'back', stock: FIBRACEL }),
    ]);

  it('sums sheets × price per stock', () => {
    expect(estimateCost(layout(), { 3: 950, 5: 180 })).toBe(3 * 950 + 180);
  });

  it('returns null until every stock in the layout has a positive price', () => {
    expect(estimateCost(layout(), { 3: 950 })).toBeNull();
    expect(estimateCost(layout(), { 3: 950, 5: 0 })).toBeNull();
    expect(estimateCost(layout(), {})).toBeNull();
  });

  it('ignores prices for stocks not in the layout', () => {
    const plywoodOnly = nest([panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 })]);
    expect(estimateCost(plywoodOnly, { 3: 950, 4: 700 })).toBe(2850);
  });
});
