import type { NestingResult, PlacedPiece, SheetLayout } from './types.ts';

/** One straight saw pass across a sheet, in sheet mm (origin top-left, x along width, y along length). */
export interface Cut {
  n: number; // 1-based, per sheet, in saw order
  kind: 'cross' | 'rip' | 'trim'; // cross and trim run across the grain (along x); rip runs along it (along y)
  x1: number; // start → end; x1 ≤ x2, y1 ≤ y2
  y1: number;
  x2: number;
  y2: number;
  from: 'top' | 'left'; // edge of the board as it is at this cut, to measure from
  mm: number; // distance from that edge to the cut line
}

/**
 * The circular-saw sequence that frees a sheet's pieces from its FFDH shelf layout.
 * Pieces sharing a `y` form a row whose height is its tallest piece; rows go top to bottom.
 * Each row gets a crosscut under it (unless it reaches the sheet bottom), then, for each run of
 * neighbouring equal-length pieces: rips piece by piece when the run is full height, or — when it
 * is shorter — one rip at the run's end, one trim shared by the whole run and short rips between
 * its pieces. Every cut is measured from the top or left edge of the board at that moment; rows
 * are packed edge to edge with the kerf between them, so a row's top is the board's top edge.
 */
export function sheetCuts(sheet: SheetLayout): Cut[] {
  const { width: W, length: L } = sheet.stock.sheet;
  const rows = new Map<number, PlacedPiece[]>();
  for (const p of sheet.pieces) rows.set(p.y, [...(rows.get(p.y) ?? []), p]);

  const cuts: Cut[] = [];
  const add = (cut: Omit<Cut, 'n'>) => cuts.push({ n: cuts.length + 1, ...cut });

  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(y)!.sort((a, b) => a.x - b.x);
    const h = Math.max(...row.map((p) => p.length));
    if (y + h < L) add({ kind: 'cross', x1: 0, y1: y + h, x2: W, y2: y + h, from: 'top', mm: h });

    const runs: PlacedPiece[][] = []; // neighbouring pieces of equal length
    for (const p of row) {
      const last = runs.at(-1);
      if (last && last[0]!.length === p.length) last.push(p);
      else runs.push([p]);
    }

    for (const run of runs) {
      const length = run[0]!.length;
      const xStart = run[0]!.x;
      const xEnd = run.at(-1)!.x + run.at(-1)!.width;
      if (length === h) {
        for (const p of run) {
          const right = p.x + p.width;
          if (right < W) add({ kind: 'rip', x1: right, y1: y, x2: right, y2: y + h, from: 'left', mm: p.width });
        }
      } else {
        if (xEnd < W) add({ kind: 'rip', x1: xEnd, y1: y, x2: xEnd, y2: y + h, from: 'left', mm: xEnd - xStart });
        add({ kind: 'trim', x1: xStart, y1: y + length, x2: xEnd, y2: y + length, from: 'top', mm: length });
        for (const p of run.slice(0, -1)) {
          const right = p.x + p.width;
          add({ kind: 'rip', x1: right, y1: y, x2: right, y2: y + length, from: 'left', mm: p.width });
        }
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

const KIND_TEXT: Record<Cut['kind'], string> = { cross: 'A lo ancho', rip: 'A lo largo', trim: 'Recorte' };
const EDGE_TEXT: Record<Cut['from'], string> = { top: 'arriba', left: 'la izquierda' };

/** One saw step in Spanish, e.g. 'A lo largo — 297 mm desde la izquierda'. */
export function cutText(cut: Cut): string {
  return `${KIND_TEXT[cut.kind]} — ${cut.mm} mm desde ${EDGE_TEXT[cut.from]}`;
}

/** Shown once above every cut list. */
export const CUT_TIP =
  'Mide desde el borde indicado del tablero que te queda y corta del lado del sobrante: el disco se come 3 mm.';

const BADGE_OFFSET = 70; // mm from where the saw enters, clear of the piece labels at each piece's center

/** Where to draw a cut's number: 70 mm in from its start, or its midpoint when the cut is shorter than 140 mm. */
export function cutBadge(cut: Cut): { x: number; y: number } {
  const length = Math.abs(cut.x2 - cut.x1) + Math.abs(cut.y2 - cut.y1);
  const d = Math.min(BADGE_OFFSET, length / 2);
  return { x: cut.x1 + Math.sign(cut.x2 - cut.x1) * d, y: cut.y1 + Math.sign(cut.y2 - cut.y1) * d };
}
