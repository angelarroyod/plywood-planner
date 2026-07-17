import { describe, expect, it } from 'vitest';
import { estimateCost, nest } from './nesting.ts';
import { DEFAULT_CONFIG } from './types.ts';
import type { NestingResult, Panel, PlacedPiece } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';

const CFG = DEFAULT_CONFIG.nesting;

function panel(over: Partial<Panel> = {}): Panel {
  return { id: 'p', label: 'P', length: 600, width: 400, thickness: 18, grain: 'any', qty: 1, ...over };
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
        expect(Math.max(xGap, yGap)).toBeGreaterThanOrEqual(CFG.kerf);
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

  it('keeps every piece inside the sheet', () => {
    const r = nest(bookshelfPanels());
    for (const p of allPieces(r)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(CFG.sheetWidth);
      expect(p.y + p.length).toBeLessThanOrEqual(CFG.sheetLength);
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

  it('splits different thicknesses onto separate sheets', () => {
    const r = nest([
      panel({ id: 'thick', thickness: 18, qty: 1 }),
      panel({ id: 'thin', thickness: 12, qty: 1 }),
    ]);
    expect(r.sheets).toHaveLength(2);
    for (const sheet of r.sheets) {
      const ids = new Set(sheet.pieces.map((p) => p.panelId));
      expect(ids.size).toBe(1);
    }
  });

  it('spills onto extra sheets when full', () => {
    // 1100x1100 with fixed grain: one per shelf, two shelves per sheet → 5 pieces = 3 sheets
    const r = nest([panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 })]);
    expect(r.sheets).toHaveLength(3);
    assertNoOverlapWithKerf(r);
  });

  it('computes waste percentage', () => {
    const full = nest([
      panel({ id: 'full', grain: 'length', length: CFG.sheetLength, width: CFG.sheetWidth }),
    ]);
    expect(full.wastePercent).toBeCloseTo(0);

    const half = nest([
      panel({ id: 'half', grain: 'length', length: CFG.sheetLength / 2, width: CFG.sheetWidth }),
    ]);
    expect(half.wastePercent).toBeCloseTo(50);

    expect(nest([]).wastePercent).toBe(0);
    expect(nest([]).sheets).toHaveLength(0);
  });

  it('rotates grain-free pieces to fit when needed', () => {
    // 1500 long does not fit across the 1220 width, but fits along the length once rotated
    const r = nest([panel({ id: 'wide', grain: 'any', length: 1500, width: 1000 })]);
    expect(r.sheets).toHaveLength(1);
    assertNoOverlapWithKerf(r);
  });

  it('throws when a panel cannot fit any sheet orientation', () => {
    expect(() => nest([panel({ grain: 'length', length: 2500, width: 300 })])).toThrow(
      /does not fit/,
    );
  });
});

describe('estimateCost', () => {
  it('multiplies sheets by unit price', () => {
    const r = nest([panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 })]);
    expect(r.sheets).toHaveLength(3);
    expect(estimateCost(r, 950)).toBe(2850);
  });
});
