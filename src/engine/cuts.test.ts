import { describe, expect, it } from 'vitest';
import { cutTotals, sheetCuts } from './cuts.ts';
import { nest } from './nesting.ts';
import { getStock } from './stock.ts';
import type { PlacedPiece, SheetLayout } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';

const PLY18 = getStock(3); // 1220 × 2440

function piece(over: Partial<PlacedPiece>): PlacedPiece {
  return { panelId: 'p', instance: 0, x: 0, y: 0, length: 600, width: 400, rotated: false, ...over };
}

function sheet(...pieces: PlacedPiece[]): SheetLayout {
  return { stock: PLY18, pieces };
}

describe('sheetCuts', () => {
  it('frees a corner piece with one rip and one crosscut', () => {
    expect(sheetCuts(sheet(piece({})))).toEqual([
      { kind: 'rip', x1: 0, y1: 600, x2: 1220, y2: 600 },
      { kind: 'cross', x1: 400, y1: 0, x2: 400, y2: 600 },
    ]);
  });

  it('needs no cut for a piece that fills the sheet', () => {
    expect(sheetCuts(sheet(piece({ length: 2440, width: 1220 })))).toEqual([]);
  });

  it('crosscuts after every piece in a row', () => {
    const cuts = sheetCuts(sheet(piece({ x: 0 }), piece({ instance: 1, x: 403 })));
    expect(cuts.map((c) => c.kind)).toEqual(['rip', 'cross', 'cross']);
    expect(cuts[2]).toEqual({ kind: 'cross', x1: 803, y1: 0, x2: 803, y2: 600 });
  });

  it('trims a piece shorter than its row', () => {
    const cuts = sheetCuts(sheet(piece({ x: 0 }), piece({ instance: 1, x: 403, length: 500 })));
    expect(cuts.filter((c) => c.kind === 'trim')).toEqual([
      { kind: 'trim', x1: 403, y1: 500, x2: 803, y2: 500 },
    ]);
  });

  it('does not rip under a row that reaches the sheet bottom', () => {
    expect(sheetCuts(sheet(piece({ length: 2440 })))).toEqual([
      { kind: 'cross', x1: 400, y1: 0, x2: 400, y2: 2440 },
    ]);
  });

  it('walks rows top to bottom whatever order the pieces come in', () => {
    const cuts = sheetCuts(sheet(piece({ instance: 1, y: 603 }), piece({})));
    expect(cuts.filter((c) => c.kind === 'rip').map((c) => c.y1)).toEqual([600, 1203]);
  });
});

describe('cutTotals', () => {
  it('counts cuts and rounds meters up to 0.1', () => {
    // 1220 + 600 = 1820 mm → 1.9 m
    expect(cutTotals({ sheets: [sheet(piece({}))], byStock: [] })).toEqual({ count: 2, meters: 1.9 });
  });

  it('totals the default bookshelf', () => {
    const result = bookshelf.generate({});
    if (!result.ok) throw new Error('default bookshelf must validate');
    // plywood: 2 rips + 7 crosses + 2 trims = 10 126 mm; Fibracel: 1 rip + 1 cross = 2420 mm → 12 546 mm
    expect(cutTotals(nest(result.design.panels))).toEqual({ count: 13, meters: 12.6 });
  });
});
