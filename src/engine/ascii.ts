import type { NestingResult } from './types.ts';

const SCALE = 40; // mm per character cell

/** Debug/dev view of a nesting result. Pure string builder, safe anywhere. */
export function renderAscii(result: NestingResult): string {
  const lines: string[] = [];

  result.sheets.forEach((sheet, s) => {
    const { width, length } = sheet.stock.sheet;
    const cols = Math.ceil(width / SCALE);
    const rows = Math.ceil(length / SCALE);
    lines.push(
      `Sheet ${s + 1} — ${sheet.stock.label} (${width}x${length}mm, 1 char = ${SCALE}mm)`,
    );
    const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill('.'));
    const legend: string[] = [];
    sheet.pieces.forEach((piece, i) => {
      const ch = String.fromCharCode(65 + (i % 26));
      const x0 = Math.floor(piece.x / SCALE);
      const y0 = Math.floor(piece.y / SCALE);
      const x1 = Math.min(cols, Math.ceil((piece.x + piece.width) / SCALE));
      const y1 = Math.min(rows, Math.ceil((piece.y + piece.length) / SCALE));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) grid[y]![x] = ch;
      }
      legend.push(
        `  ${ch} = ${piece.panelId}#${piece.instance} ` +
          `${piece.width}x${piece.length}mm at (${piece.x}, ${piece.y})` +
          (piece.rotated ? ' (rotated)' : ''),
      );
    });
    lines.push(...grid.map((row) => row.join('')), ...legend, '');
  });

  lines.push(`Total sheets: ${result.sheets.length}`);
  for (const g of result.byStock) {
    lines.push(`  ${g.stock.label}: ${g.sheets} sheet(s), waste ${g.wastePercent.toFixed(1)}%`);
  }
  return lines.join('\n');
}
