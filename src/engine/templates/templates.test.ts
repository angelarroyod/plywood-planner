import { describe, expect, it } from 'vitest';
import { bookshelf } from './bookshelf.ts';
import { sideTable } from './side-table.ts';
import { nest } from '../nesting.ts';
import type { Design, Template } from '../types.ts';
import { FIBRACEL_3 } from '../stock.ts';

function designOrThrow(template: Template, params = {}): Design {
  const result = template.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.design;
}

function totalQty(design: Design): number {
  return design.panels.reduce((sum, p) => sum + p.qty, 0);
}

for (const template of [bookshelf, sideTable]) {
  describe(`${template.id} (shared invariants)`, () => {
    const design = designOrThrow(template);

    it('generates with default params', () => {
      expect(design.templateId).toBe(template.id);
      expect(design.panels.length).toBeGreaterThan(0);
      expect(design.steps.length).toBeGreaterThan(0);
      expect(design.hardware.length).toBeGreaterThan(0);
    });

    it('has one placement per panel instance', () => {
      expect(design.placements).toHaveLength(totalQty(design));
      const counts = new Map<string, number>();
      for (const pl of design.placements) {
        counts.set(pl.panelId, (counts.get(pl.panelId) ?? 0) + 1);
      }
      for (const panel of design.panels) {
        expect(counts.get(panel.id)).toBe(panel.qty);
      }
    });

    it('steps and explode offsets reference existing panel ids', () => {
      const ids = new Set(design.panels.map((p) => p.id));
      for (const step of design.steps) {
        for (const ref of step.panelRefs) expect(ids.has(ref)).toBe(true);
        for (const key of Object.keys(step.explodeOffsets ?? {})) expect(ids.has(key)).toBe(true);
      }
    });

    it('is pure: same params, same design', () => {
      expect(template.generate({})).toEqual(template.generate({}));
    });

    it('produces panels that nest without error', () => {
      const layout = nest(design.panels);
      expect(layout.sheets.length).toBeGreaterThanOrEqual(1);
      for (const g of layout.byStock) {
        expect(g.wastePercent).toBeGreaterThanOrEqual(0);
        expect(g.wastePercent).toBeLessThan(100);
      }
    });

    it('uses the chosen material for its panels', () => {
      const melamine = designOrThrow(template, { width: 500, material: 4 }); // span ≤ 550
      expect(melamine.panels.filter((p) => p.id !== 'back').every((p) => p.stock.id === 4)).toBe(true);
    });
  });
}

describe('bookshelf', () => {
  it('builds the expected panel set', () => {
    const design = designOrThrow(bookshelf, { width: 800, height: 1200, depth: 300, shelfCount: 3, material: 3 });
    const byId = new Map(design.panels.map((p) => [p.id, p]));
    expect(byId.get('side')).toMatchObject({ length: 1200, width: 297, qty: 2 }); // 300 - 3 mm back
    expect(byId.get('top')).toMatchObject({ length: 764, width: 297, qty: 1 }); // 800 - 2*18
    expect(byId.get('bottom')).toMatchObject({ length: 764, width: 297, qty: 1 });
    expect(byId.get('shelf')).toMatchObject({ length: 764, width: 297, qty: 3 });
    expect(byId.get('back')).toMatchObject({ label: 'Fondo', length: 1200, width: 800, grain: 'any', qty: 1 });
    expect(byId.get('back')!.stock).toBe(FIBRACEL_3);
    for (const id of ['side', 'top', 'bottom', 'shelf']) expect(byId.get(id)!.stock.id).toBe(3);
    expect(design.hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 20 }, // (3+2)*4
      { type: 'screw', size: '3.5x16', qty: 32 }, // ⌈2·(800+1200)/200⌉ + 3·⌈764/200⌉ = 20 + 12
    ]);
  });

  it('keeps the overall depth, with the back behind a shallower case', () => {
    for (const D of [200, 300, 400]) {
      const design = designOrThrow(bookshelf, { depth: D });
      const zMin = Math.min(...design.placements.map((p) => p.position[2] - p.size[2] / 2));
      const zMax = Math.max(...design.placements.map((p) => p.position[2] + p.size[2] / 2));
      expect(zMin).toBeCloseTo(-D / 2);
      expect(zMax).toBeCloseTo(D / 2);

      // the case (everything but the back) starts exactly where the back ends
      const caseRear = -D / 2 + FIBRACEL_3.thickness;
      for (const p of design.placements) {
        if (p.panelId === 'back') continue;
        expect(p.position[2] - p.size[2] / 2).toBeCloseTo(caseRear);
        expect(p.position[2] + p.size[2] / 2).toBeCloseTo(D / 2);
      }

      const back = design.placements.find((p) => p.panelId === 'back')!;
      expect(back.size).toEqual([800, 1200, FIBRACEL_3.thickness]);
      expect(back.position[2] - back.size[2] / 2).toBeCloseTo(-D / 2); // rear is −z; camera looks from +z
    }
  });

  it('ends with a step that screws on the back', () => {
    const design = designOrThrow(bookshelf);
    expect(design.steps.at(-1)).toMatchObject({
      order: 5,
      title: 'Coloca el fondo',
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    });
  });

  it('nests the back on its own Fibracel sheet', () => {
    const layout = nest(designOrThrow(bookshelf).panels);
    expect(layout.byStock.map((g) => g.stock.id)).toEqual([3, 5]);
    expect(layout.byStock[1]!.sheets).toBe(1);
  });

  it('rejects unsafe shelf spans in Spanish', () => {
    const result = bookshelf.generate({ width: 1200, material: 1 }); // span 1176 > 500
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('width');
      expect(result.issues[0]!.message).toContain('triplay de pino 12 mm');
    }
  });

  it('holds melamine to its shorter span', () => {
    const result = bookshelf.generate({ width: 800, material: 4 }); // span 768 > 550
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('width');
      expect(result.issues[0]!.message).toContain('768 mm');
      expect(result.issues[0]!.message).toContain('melamina blanca 16 mm');
    }
  });

  it('rejects too many shelves for the height', () => {
    const result = bookshelf.generate({ height: 400, shelfCount: 8 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('shelfCount');
    }
  });

  it('rejects out-of-range params before doing structural checks', () => {
    const result = bookshelf.generate({ width: 9999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.paramKey).toBe('width');
    }
  });

  it('spaces shelves evenly between base and top', () => {
    const design = designOrThrow(bookshelf, { height: 1200, shelfCount: 3, material: 3 });
    const ys = design.placements
      .filter((p) => p.panelId === 'shelf')
      .map((p) => p.position[1])
      .sort((a, b) => a - b);
    expect(ys).toHaveLength(3);
    const gaps = [ys[1]! - ys[0]!, ys[2]! - ys[1]!];
    expect(gaps[0]).toBeCloseTo(gaps[1]!);
  });
});

describe('side table', () => {
  it('builds the expected panel set', () => {
    const design = designOrThrow(sideTable, { width: 500, depth: 350, height: 450, material: 3 });
    const byId = new Map(design.panels.map((p) => [p.id, p]));
    expect(byId.get('top')).toMatchObject({ length: 500, width: 350, qty: 1 });
    expect(byId.get('side')).toMatchObject({ length: 432, width: 350, qty: 2 }); // 450 - 18
    expect(byId.get('shelf')).toMatchObject({ length: 464, qty: 1 }); // 500 - 2*18
  });

  it('has no back panel', () => {
    const design = designOrThrow(sideTable);
    expect(design.panels.some((p) => p.id === 'back')).toBe(false);
  });

  it('rejects unsafe top spans', () => {
    const result = sideTable.generate({ width: 800, material: 1 }); // span 776 > 500
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('width');
      expect(result.issues[0]!.message).toContain('triplay de pino 12 mm');
    }
  });
});
