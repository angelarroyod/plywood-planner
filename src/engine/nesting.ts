import type {
  NestingConfig,
  NestingResult,
  Panel,
  PlacedPiece,
  PlywoodThickness,
} from './types.ts';
import { DEFAULT_CONFIG } from './types.ts';

// ponytail: FFDH shelf packing — every layout is guillotine-cuttable by
// construction (one rip per shelf, then crosscuts). Swap in a free-rectangle
// guillotine packer if waste % ever becomes a complaint.

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
  thickness: PlywoodThickness;
  shelves: Shelf[];
  yCursor: number; // bottom edge of last shelf
  pieces: PlacedPiece[];
}

/** Default orientation per grain. Sheet grain runs along sheetLength (y). */
function orient(panel: Panel): Pick<Piece, 'xExtent' | 'yExtent' | 'rotated' | 'canRotate'> {
  if (panel.grain === 'width') {
    return { xExtent: panel.length, yExtent: panel.width, rotated: true, canRotate: false };
  }
  return { xExtent: panel.width, yExtent: panel.length, rotated: false, canRotate: panel.grain === 'any' };
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

function tryShelf(piece: Piece, shelf: Shelf, config: NestingConfig): PlacedPiece | null {
  const x = shelf.xCursor === 0 ? 0 : shelf.xCursor + config.kerf;
  if (piece.yExtent <= shelf.height && x + piece.xExtent <= config.sheetWidth) {
    shelf.xCursor = x + piece.xExtent;
    return place(piece, x, shelf.y, false);
  }
  if (piece.canRotate && piece.xExtent <= shelf.height && x + piece.yExtent <= config.sheetWidth) {
    shelf.xCursor = x + piece.yExtent;
    return place(piece, x, shelf.y, true);
  }
  return null;
}

function placePiece(
  piece: Piece,
  sheets: OpenSheet[],
  thickness: PlywoodThickness,
  config: NestingConfig,
): void {
  for (const sheet of sheets) {
    // first-fit: revisit every open shelf
    for (const shelf of sheet.shelves) {
      const placed = tryShelf(piece, shelf, config);
      if (placed) {
        sheet.pieces.push(placed);
        return;
      }
    }
    // new shelf on this sheet (pieces arrive sorted by yExtent desc)
    const y = sheet.yCursor === 0 ? 0 : sheet.yCursor + config.kerf;
    if (y + piece.yExtent <= config.sheetLength) {
      const shelf: Shelf = { y, height: piece.yExtent, xCursor: piece.xExtent };
      sheet.shelves.push(shelf);
      sheet.yCursor = y + piece.yExtent;
      sheet.pieces.push(place(piece, 0, y, false));
      return;
    }
  }
  // new sheet
  sheets.push({
    thickness,
    shelves: [{ y: 0, height: piece.yExtent, xCursor: piece.xExtent }],
    yCursor: piece.yExtent,
    pieces: [place(piece, 0, 0, false)],
  });
}

/**
 * Pack panels onto standard sheets. Panels of different thickness never share
 * a sheet. Throws if a panel cannot fit a sheet in any legal orientation —
 * template param limits must prevent that upstream.
 */
export function nest(panels: Panel[], config: NestingConfig = DEFAULT_CONFIG.nesting): NestingResult {
  const byThickness = new Map<PlywoodThickness, Piece[]>();

  for (const panel of panels) {
    const o = orient(panel);
    const fitsAsIs = o.xExtent <= config.sheetWidth && o.yExtent <= config.sheetLength;
    const fitsSwapped =
      o.canRotate && o.yExtent <= config.sheetWidth && o.xExtent <= config.sheetLength;
    if (!fitsAsIs && !fitsSwapped) {
      throw new Error(
        `Panel "${panel.id}" (${panel.length}x${panel.width}mm) does not fit a ` +
          `${config.sheetWidth}x${config.sheetLength}mm sheet`,
      );
    }
    const base = fitsAsIs
      ? o
      : { xExtent: o.yExtent, yExtent: o.xExtent, rotated: !o.rotated, canRotate: o.canRotate };

    const list = byThickness.get(panel.thickness) ?? [];
    for (let i = 0; i < panel.qty; i++) {
      list.push({ panelId: panel.id, instance: i, ...base });
    }
    byThickness.set(panel.thickness, list);
  }

  const sheets: OpenSheet[] = [];
  const thicknesses = [...byThickness.keys()].sort((a, b) => b - a);
  for (const thickness of thicknesses) {
    const pieces = byThickness.get(thickness)!;
    pieces.sort((a, b) => b.yExtent - a.yExtent || b.xExtent - a.xExtent);
    const group: OpenSheet[] = [];
    for (const piece of pieces) placePiece(piece, group, thickness, config);
    sheets.push(...group);
  }

  const sheetArea = config.sheetWidth * config.sheetLength;
  const pieceArea = sheets
    .flatMap((s) => s.pieces)
    .reduce((sum, p) => sum + p.length * p.width, 0);
  const wastePercent =
    sheets.length === 0 ? 0 : (1 - pieceArea / (sheets.length * sheetArea)) * 100;

  return {
    sheets: sheets.map((s) => ({ thickness: s.thickness, pieces: s.pieces })),
    wastePercent,
  };
}

/** Sheets × user-provided price. Hardware is listed, not priced, in the MVP. */
export function estimateCost(result: NestingResult, pricePerSheetMXN: number): number {
  return result.sheets.length * pricePerSheetMXN;
}
