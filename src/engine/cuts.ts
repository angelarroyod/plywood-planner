import type { NestingResult, PlacedPiece, SheetLayout } from './types.ts';

/** One straight saw pass across a sheet, in sheet mm (origin top-left, x along width, y along length). */
export interface Cut {
  kind: 'rip' | 'cross' | 'trim';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The guillotine cuts that free a sheet's pieces from its FFDH shelf layout.
 * Pieces sharing a `y` form a row whose height is its tallest piece:
 * - rip: under each row that stops short of the sheet's bottom, across the full width;
 * - cross: after each piece that stops short of the sheet's right edge, down the row;
 * - trim: across each piece shorter than its row.
 */
export function sheetCuts(sheet: SheetLayout): Cut[] {
  const { width: W, length: L } = sheet.stock.sheet;
  const rows = new Map<number, PlacedPiece[]>();
  for (const p of sheet.pieces) rows.set(p.y, [...(rows.get(p.y) ?? []), p]);

  const cuts: Cut[] = [];
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(y)!.sort((a, b) => a.x - b.x);
    const height = Math.max(...row.map((p) => p.length));
    if (y + height < L) cuts.push({ kind: 'rip', x1: 0, y1: y + height, x2: W, y2: y + height });
    for (const p of row) {
      const right = p.x + p.width;
      if (right < W) cuts.push({ kind: 'cross', x1: right, y1: y, x2: right, y2: y + height });
      if (p.length < height) {
        cuts.push({ kind: 'trim', x1: p.x, y1: y + p.length, x2: right, y2: y + p.length });
      }
    }
  }
  return cuts;
}

/** Every cut in the layout: how many, and their total length in meters rounded UP to 0.1 m. */
export function cutTotals(layout: NestingResult): { count: number; meters: number } {
  const cuts = layout.sheets.flatMap((s) => sheetCuts(s));
  const mm = cuts.reduce((sum, c) => sum + Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1), 0);
  return { count: cuts.length, meters: Math.ceil(mm / 100) / 10 };
}
