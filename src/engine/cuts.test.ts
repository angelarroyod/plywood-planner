import { describe, expect, it } from 'vitest';
import { CUT_TIP, cutBadge, cutText, cutTotals, sheetCuts, type Cut } from './cuts.ts';
import { nest } from './nesting.ts';
import { getStock } from './stock.ts';
import type { PlacedPiece, SheetLayout, Template } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';
import { sideTable } from './templates/side-table.ts';

const PLY18 = getStock(3); // 1220 × 2440

function piece(over: Partial<PlacedPiece>): PlacedPiece {
  return { panelId: 'p', instance: 0, x: 0, y: 0, length: 600, width: 400, rotated: false, ...over };
}

function sheet(...pieces: PlacedPiece[]): SheetLayout {
  return { stock: PLY18, pieces };
}

function defaultSheets(template: Template): SheetLayout[] {
  const result = template.generate({});
  if (!result.ok) throw new Error(`default ${template.id} must validate`);
  return nest(result.design.panels).sheets;
}

describe('sheetCuts', () => {
  it('frees a corner piece with one crosscut and one rip', () => {
    expect(sheetCuts(sheet(piece({})))).toEqual([
      { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 },
      { n: 2, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 600, from: 'left', mm: 400 },
    ]);
  });

  it('flags cuts that leave less than the blade width past their line', () => {
    // A 300-long row with a 298-long run ending 2 mm short of the sheet edge: both of its cuts only shave 2 mm.
    const cuts = sheetCuts(sheet(piece({ length: 300 }), piece({ instance: 1, x: 403, length: 298, width: 815 })));
    expect(cuts).toEqual([
      { n: 1, kind: 'cross', x1: 0, y1: 300, x2: 1220, y2: 300, from: 'top', mm: 300 },
      { n: 2, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 300, from: 'left', mm: 400 },
      { n: 3, kind: 'rip', x1: 1218, y1: 0, x2: 1218, y2: 300, from: 'left', mm: 815, sliver: 2 },
      { n: 4, kind: 'trim', x1: 403, y1: 298, x2: 1218, y2: 298, from: 'top', mm: 298, sliver: 2 },
    ]);
  });

  it('needs no cut for a piece that fills the sheet', () => {
    expect(sheetCuts(sheet(piece({ length: 2440, width: 1220 })))).toEqual([]);
  });

  it('rips full-height pieces one by one, each from the new left edge', () => {
    const cuts = sheetCuts(sheet(piece({ x: 0 }), piece({ instance: 1, x: 403 })));
    expect(cuts.map((c) => [c.n, c.kind, c.from, c.mm, c.x1])).toEqual([
      [1, 'cross', 'top', 600, 0],
      [2, 'rip', 'left', 400, 400],
      [3, 'rip', 'left', 400, 803],
    ]);
  });

  it('trims a run of equal short pieces in one pass', () => {
    const cuts = sheetCuts(
      sheet(piece({ x: 0 }), piece({ instance: 1, x: 403, length: 500 }), piece({ instance: 2, x: 806, length: 500 })),
    );
    expect(cuts).toEqual([
      { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 },
      { n: 2, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 600, from: 'left', mm: 400 },
      { n: 3, kind: 'rip', x1: 1206, y1: 0, x2: 1206, y2: 600, from: 'left', mm: 803 }, // end of the short run
      { n: 4, kind: 'trim', x1: 403, y1: 500, x2: 1206, y2: 500, from: 'top', mm: 500 }, // one pass for both
      { n: 5, kind: 'rip', x1: 803, y1: 0, x2: 803, y2: 500, from: 'left', mm: 400 }, // only as long as the trim
    ]);
  });

  it('does not crosscut under a row that reaches the sheet bottom', () => {
    expect(sheetCuts(sheet(piece({ length: 2440 })))).toEqual([
      { n: 1, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 2440, from: 'left', mm: 400 },
    ]);
  });

  it('trims a short run in a second row that ends at the sheet edge', () => {
    const cuts = sheetCuts(
      sheet(
        piece({ width: 1220 }),
        piece({ instance: 1, y: 603, length: 500, width: 400 }),
        piece({ instance: 2, x: 403, y: 603, length: 300, width: 817 }),
      ),
    );
    expect(cuts).toEqual([
      { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 },
      { n: 2, kind: 'cross', x1: 0, y1: 1103, x2: 1220, y2: 1103, from: 'top', mm: 500 },
      { n: 3, kind: 'rip', x1: 400, y1: 603, x2: 400, y2: 1103, from: 'left', mm: 400 },
      { n: 4, kind: 'trim', x1: 403, y1: 903, x2: 1220, y2: 903, from: 'top', mm: 300 },
    ]);
  });

  it('walks rows top to bottom and numbers cuts in order', () => {
    const cuts = sheetCuts(sheet(piece({ instance: 1, y: 603 }), piece({})));
    expect(cuts.filter((c) => c.kind === 'cross').map((c) => c.y1)).toEqual([600, 1203]);
    expect(cuts.map((c) => c.n)).toEqual([1, 2, 3, 4]);
  });

  it('gives the default bookshelf its saw sequence', () => {
    const [plywood, fibracel] = defaultSheets(bookshelf);
    expect(sheetCuts(plywood!).map((c) => cutText(c))).toEqual([
      'A lo ancho — 1200 mm desde arriba',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 597 mm desde la izquierda',
      'Recorte — 764 mm desde arriba',
      'A lo largo — 297 mm desde la izquierda',
      'A lo ancho — 764 mm desde arriba',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 297 mm desde la izquierda',
    ]);
    expect(sheetCuts(fibracel!).map((c) => cutText(c))).toEqual([
      'A lo ancho — 1200 mm desde arriba',
      'A lo largo — 800 mm desde la izquierda',
    ]);
  });
});

describe('cutTotals', () => {
  it('counts cuts and rounds meters up to 0.1', () => {
    // 1220 + 600 = 1820 mm → 1.9 m
    expect(cutTotals({ sheets: [sheet(piece({}))], byStock: [] })).toEqual({ count: 2, meters: 1.9 });
  });

  it('totals the default designs', () => {
    expect(cutTotals({ sheets: defaultSheets(bookshelf), byStock: [] })).toEqual({ count: 12, meters: 12.2 });
    expect(cutTotals({ sheets: defaultSheets(sideTable), byStock: [] })).toEqual({ count: 8, meters: 5.1 });
  });
});

describe('cutText / CUT_TIP', () => {
  const at = { n: 1, x1: 0, y1: 0, x2: 0, y2: 0 };

  it('says which way to cut and how far from which edge', () => {
    expect(cutText({ ...at, kind: 'cross', from: 'top', mm: 1200 })).toBe('A lo ancho — 1200 mm desde arriba');
    expect(cutText({ ...at, kind: 'rip', from: 'left', mm: 297 })).toBe('A lo largo — 297 mm desde la izquierda');
    expect(cutText({ ...at, kind: 'trim', from: 'top', mm: 764 })).toBe('Recorte — 764 mm desde arriba');
  });

  it('warns when the cut only shaves a strip thinner than the blade', () => {
    expect(cutText({ ...at, kind: 'trim', from: 'top', mm: 298, sliver: 2 })).toBe(
      'Recorte — 298 mm desde arriba (solo rebaja 2 mm)',
    );
  });

  it('reminds to cut on the waste side', () => {
    expect(CUT_TIP).toBe(
      'Haz cada corte en la pieza donde está su número en el dibujo; mide desde el borde indicado y corta del lado del sobrante: el disco se come 3 mm.',
    );
  });
});

describe('cutBadge', () => {
  it('sits 70 mm in from where the saw enters', () => {
    const cross: Cut = { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 };
    const rip: Cut = { n: 2, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 600, from: 'left', mm: 400 };
    expect(cutBadge(cross, PLY18.sheet)).toEqual({ x: 70, y: 600 });
    expect(cutBadge(rip, PLY18.sheet)).toEqual({ x: 400, y: 70 });
  });

  it('stays inside the sheet, whatever its radius', () => {
    const edgeRip: Cut = { n: 4, kind: 'rip', x1: 1197, y1: 0, x2: 1197, y2: 600, from: 'left', mm: 597 };
    const cross: Cut = { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 };
    expect(cutBadge(edgeRip, PLY18.sheet)).toEqual({ x: 1186, y: 70 });
    expect(cutBadge(cross, PLY18.sheet, 90)).toEqual({ x: 90, y: 600 });
  });

  it('uses the midpoint of a short cut', () => {
    const short: Cut = { n: 1, kind: 'trim', x1: 0, y1: 50, x2: 100, y2: 50, from: 'top', mm: 50 };
    expect(cutBadge(short, PLY18.sheet)).toEqual({ x: 50, y: 50 });
  });
});
