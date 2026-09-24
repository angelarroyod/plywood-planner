import { describe, expect, it } from 'vitest';
import { buildOrder, orderText } from './order.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';
import { sideTable } from './templates/side-table.ts';
import type { Template } from './types.ts';

function orderFor(template: Template, params = {}, title = 'Librero') {
  const result = template.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return buildOrder(result.design, nest(result.design.panels), title);
}

describe('buildOrder', () => {
  it('groups lines by material and numbers them across groups', () => {
    const order = orderFor(bookshelf);
    expect(order.title).toBe('Librero');
    expect(order.groups.map((g) => [g.stock.id, g.sheets])).toEqual([
      [3, 1],
      [5, 1],
    ]);
    expect(order.groups.flatMap((g) => g.lines.map((l) => [l.n, l.label, l.length, l.width, l.qty]))).toEqual([
      [1, 'Lateral', 1200, 297, 2],
      [2, 'Tapa', 764, 297, 1],
      [3, 'Base', 764, 297, 1],
      [4, 'Entrepaño', 764, 297, 3],
      [5, 'Fondo', 1200, 800, 1],
    ]);
    expect(order.cuts).toEqual({ count: 13, meters: 12.6 });
    expect(order.edgeBanding).toBe('yard');
    expect(order.hardware.map((h) => h.qty)).toEqual([20, 32]);
  });

  it('marks grain only where it matters', () => {
    const order = orderFor(bookshelf);
    expect(order.groups[0]!.lines.every((l) => l.grain === 'length')).toBe(true);
    expect(order.groups[1]!.lines[0]!.grain).toBeNull(); // Fibracel back: no grain

    const melamine = orderFor(sideTable, { width: 500, material: 4 }, 'Mesa auxiliar');
    expect(melamine.groups[0]!.lines.every((l) => l.grain === null)).toBe(true);
  });
});

describe('orderText', () => {
  it('writes the default bookshelf order', () => {
    expect(orderText(orderFor(bookshelf))).toBe(
      [
        'Pedido para maderería — Librero',
        'Medidas en mm: largo × ancho.',
        '',
        'Triplay de pino 18 mm — 1 hoja de 1220 × 2440',
        '1. Lateral — 1200 × 297 — 2 pzas — veta a lo largo — cubrecanto L1 A1',
        '2. Tapa — 764 × 297 — 1 pza — veta a lo largo — cubrecanto L1',
        '3. Base — 764 × 297 — 1 pza — veta a lo largo — cubrecanto L1',
        '4. Entrepaño — 764 × 297 — 3 pzas — veta a lo largo — cubrecanto L1',
        '',
        'Fibracel 3 mm — 1 hoja de 1220 × 2440',
        '5. Fondo — 1200 × 800 — 1 pza',
        '',
        'Cubrecanto de chapa de pino 22 mm: 7.1 m. Por favor enchápenlo en los cantos marcados.',
        'Cortes: 13 (12.6 m lineales).',
        'Herrajes: Tornillo confirmat 5x50 × 20 · Tornillo 3.5x16 × 32',
      ].join('\n'),
    );
  });

  it('drops banding when there is none', () => {
    const text = orderText(orderFor(bookshelf, { edgeBanding: 0 }));
    expect(text.toLowerCase()).not.toContain('cubrecanto');
  });

  it('tells the yard when the customer bands at home', () => {
    const text = orderText(orderFor(bookshelf, { edgeBanding: 2 }));
    expect(text).toContain(
      'Cubrecanto de chapa de pino 22 mm: 7.1 m. Solo el material (pre-engomado); yo lo aplico.',
    );
    expect(text).not.toContain('— cubrecanto L');
  });

  it('never contains prices', () => {
    expect(orderText(orderFor(bookshelf))).not.toMatch(/\$|MXN/);
  });
});
