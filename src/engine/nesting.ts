import type {
  NestingConfig,
  NestingResult,
  Panel,
  PlacedPiece,
  SheetLayout,
  Stock,
  StockSummary,
} from './types.ts';
import { DEFAULT_CONFIG } from './types.ts';

// ponytail: FFDH shelf packing — every layout is guillotine-cuttable by
// construction (one rip per shelf, then crosscuts). Swap in a free-rectangle
// guillotine packer if waste % ever becomes a complaint.

type SheetSize = Stock['sheet'];

interface Piece {
  panelId: string;
  instance: number;
  xExtent: number; // along sheet width
  yExtent: number; // along sheet length (grain axis)
  rotated: boolean;
  canRotate: boolean;
}

interface Shelf {
  y: number;
  height: number; // y-extent of the shelf band
  xCursor: number; // right edge of last placed piece
}

interface OpenSheet {
  shelves: Shelf[];
  yCursor: number; // bottom edge of last shelf
  pieces: PlacedPiece[];
}

/** Default orientation per grain. Sheet grain runs along its length (y); grain-free stock nests as 'any'. */
function orient(panel: Panel): Pick<Piece, 'xExtent' | 'yExtent' | 'rotated' | 'canRotate'> {
  const grain = panel.stock.hasGrain ? panel.grain : 'any';
  if (grain === 'width') {
    return { xExtent: panel.length, yExtent: panel.width, rotated: true, canRotate: false };
  }
  return { xExtent: panel.width, yExtent: panel.length, rotated: false, canRotate: grain === 'any' };
}

function place(piece: Piece, x: number, y: number, swapped: boolean): PlacedPiece {
  return {
    panelId: piece.panelId,
    instance: piece.instance,
    x,
    y,
    length: swapped ? piece.xExtent : piece.yExtent,
    width: swapped ? piece.yExtent : piece.xExtent,
    rotated: swapped ? !piece.rotated : piece.rotated,
  };
}

function tryShelf(piece: Piece, shelf: Shelf, size: SheetSize, kerf: number): PlacedPiece | null {
  const x = shelf.xCursor === 0 ? 0 : shelf.xCursor + kerf;
  if (piece.yExtent <= shelf.height && x + piece.xExtent <= size.width) {
    shelf.xCursor = x + piece.xExtent;
    return place(piece, x, shelf.y, false);
  }
  if (piece.canRotate && piece.xExtent <= shelf.height && x + piece.yExtent <= size.width) {
    shelf.xCursor = x + piece.yExtent;
    return place(piece, x, shelf.y, true);
  }
  return null;
}

function placePiece(piece: Piece, sheets: OpenSheet[], size: SheetSize, kerf: number): void {
  for (const sheet of sheets) {
    // first-fit: revisit every open shelf
    for (const shelf of sheet.shelves) {
      const placed = tryShelf(piece, shelf, size, kerf);
      if (placed) {
        sheet.pieces.push(placed);
        return;
      }
    }
    // new shelf on this sheet (pieces arrive sorted by yExtent desc)
    const y = sheet.yCursor === 0 ? 0 : sheet.yCursor + kerf;
    if (y + piece.yExtent <= size.length) {
      const shelf: Shelf = { y, height: piece.yExtent, xCursor: piece.xExtent };
      sheet.shelves.push(shelf);
      sheet.yCursor = y + piece.yExtent;
      sheet.pieces.push(place(piece, 0, y, false));
      return;
    }
  }
  // new sheet
  sheets.push({
    shelves: [{ y: 0, height: piece.yExtent, xCursor: piece.xExtent }],
    yCursor: piece.yExtent,
    pieces: [place(piece, 0, 0, false)],
  });
}

/**
 * Pack panels onto their stock's sheets. Panels of different stock never share
 * a sheet. Throws if a panel cannot fit its sheet in any legal orientation —
 * template param limits must prevent that upstream.
 */
export function nest(panels: Panel[], config: NestingConfig = DEFAULT_CONFIG.nesting): NestingResult {
  const groups = new Map<number, { stock: Stock; pieces: Piece[] }>();

  for (const panel of panels) {
    const size = panel.stock.sheet;
    const o = orient(panel);
    const fitsAsIs = o.xExtent <= size.width && o.yExtent <= size.length;
    const fitsSwapped = o.canRotate && o.yExtent <= size.width && o.xExtent <= size.length;
    if (!fitsAsIs && !fitsSwapped) {
      throw new Error(
        `Panel "${panel.id}" (${panel.length}x${panel.width}mm) does not fit a ` +
          `${size.width}x${size.length}mm ${panel.stock.label} sheet`,
      );
    }
    const base = fitsAsIs
      ? o
      : { xExtent: o.yExtent, yExtent: o.xExtent, rotated: !o.rotated, canRotate: o.canRotate };

    const existing = groups.get(panel.stock.id);
    if (existing && existing.stock !== panel.stock) {
      throw new Error(`Stock id ${panel.stock.id} is used by two different stock objects`);
    }
    const group = existing ?? { stock: panel.stock, pieces: [] };
    for (let i = 0; i < panel.qty; i++) {
      group.pieces.push({ panelId: panel.id, instance: i, ...base });
    }
    groups.set(panel.stock.id, group);
  }

  // Thickest first (the case before its back), ties by id so the order is stable.
  const ordered = [...groups.values()].sort(
    (a, b) => b.stock.thickness - a.stock.thickness || a.stock.id - b.stock.id,
  );

  const sheets: SheetLayout[] = [];
  const byStock: StockSummary[] = [];
  for (const { stock, pieces } of ordered) {
    if (pieces.length === 0) continue; // qty 0 panels buy no sheet
    pieces.sort((a, b) => b.yExtent - a.yExtent || b.xExtent - a.xExtent);
    const open: OpenSheet[] = [];
    for (const piece of pieces) placePiece(piece, open, stock.sheet, config.kerf);

    const pieceArea = open
      .flatMap((s) => s.pieces)
      .reduce((sum, p) => sum + p.length * p.width, 0);
    const sheetArea = stock.sheet.width * stock.sheet.length;
    byStock.push({
      stock,
      sheets: open.length,
      wastePercent: (1 - pieceArea / (open.length * sheetArea)) * 100,
    });
    sheets.push(...open.map((s) => ({ stock, pieces: s.pieces })));
  }

  return { sheets, byStock };
}
