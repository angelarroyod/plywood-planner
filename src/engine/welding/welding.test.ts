import { describe, expect, it } from 'vitest';
import { overlappingBoxes } from '../templates/testing.ts';
import type { TemplateParams } from '../types.ts';
import { BAR_LENGTH, weldProcess, weldSettings } from './catalog.ts';
import { planBars, shoppingList, shoppingText, toolLabel } from './plan.ts';
import { generateWeldShelf, generateWeldStool, generateWeldTable, weldTemplates } from './templates.ts';
import type { WeldDesign, WeldResult } from './types.ts';

function ok(r: WeldResult): WeldDesign {
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('\n'));
  return r.design;
}

const warns = (d: WeldDesign) => d.suggestions.filter((s) => s.level === 'warn');

describe('weldSettings', () => {
  it('follows ~39 A per mm of wall for wire and TIG', () => {
    expect(weldSettings(weldProcess(1), 1.5)).toMatchObject({ start: 60, amps: [55, 65], wire: '0.8 mm (0.030")' });
    expect(weldSettings(weldProcess(2), 3.0)).toMatchObject({ start: 120, amps: [110, 130], wire: '0.9 mm (0.035")' });
    expect(weldSettings(weldProcess(4), 1.2).start).toBe(45);
  });

  it('picks a 6013 electrode by wall and stays inside its range', () => {
    expect(weldSettings(weldProcess(3), 1.9)).toMatchObject({ start: 75, amps: [50, 80] });
    expect(weldSettings(weldProcess(3), 3.0)).toMatchObject({ start: 100, amps: [80, 120] });
    expect(weldSettings(weldProcess(3), 3.0).consumable).toContain('1/8"');
  });

  it('flux-core runs electrode negative, unlike gas MIG', () => {
    expect(weldSettings(weldProcess(1), 1.5).polarity).toContain('negativo');
    expect(weldSettings(weldProcess(2), 1.5).polarity).toContain('positivo');
  });
});

describe('planBars', () => {
  it('first-fit decreasing with a squared mill end and a kerf after every piece', () => {
    const bars = planBars([
      { id: 'a', label: 'A', length: 3000, ends: 'square', qty: 2 },
      { id: 'b', label: 'B', length: 100, ends: 'square', qty: 1 },
    ]);
    expect(bars).toHaveLength(2);
    expect(bars[0]!.pieces.map((p) => p.offset)).toEqual([13, 3016]);
    expect(bars[0]).toMatchObject({ cuts: 3, remnant: 81 });
  });

  it('skips the last cut when a piece ends exactly at the bar end', () => {
    const [bar] = planBars([{ id: 'a', label: 'A', length: BAR_LENGTH - 13, ends: 'square', qty: 1 }]);
    expect(bar).toMatchObject({ cuts: 1, remnant: 0 });
  });
});

describe.each(weldTemplates)('$name defaults', (t) => {
  const d = ok(t.generate({}));

  it('builds a solid frame with one placement per piece and no overlaps', () => {
    expect(d.placements).toHaveLength(d.members.reduce((n, m) => n + m.qty, 0));
    expect(overlappingBoxes(d)).toEqual([]);
  });

  it('steps only name real members and keep tool demos near the model', () => {
    const ids = new Set(d.members.map((m) => m.id));
    for (const s of d.steps) for (const ref of s.panelRefs) expect(ids).toContain(ref);
    const W = d.params['width']!;
    const D = d.params['depth']!;
    const H = d.params['height']!;
    for (const s of d.steps) {
      if (!s.action) continue;
      for (const [x, y, z] of [s.action.from, s.action.to]) {
        expect(Math.abs(x)).toBeLessThanOrEqual(W / 2 + 300);
        expect(Math.abs(z)).toBeLessThanOrEqual(D / 2 + 300);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(H + 300);
      }
    }
  });

  it('has no warnings out of the box and fits its bars', () => {
    expect(warns(d)).toEqual([]);
    expect(planBars(d.members).length).toBeGreaterThan(0);
    expect(d.tools[0]).toBe('tape');
  });
});

describe('frame geometry', () => {
  it('a table with a lower frame welds 16 joints all round', () => {
    const d = ok(generateWeldTable({}));
    expect(d.joints).toBe(16);
    expect(d.weldLength).toBe(Math.round(16 * 4 * d.tube.side));
  });

  it('mitered top rails are cut to the full outside size', () => {
    const d = ok(generateWeldTable({ joint: 2, depth: 600 }));
    expect(d.members.find((m) => m.id === 'top-short')).toMatchObject({ length: 600, ends: 'miter' });
    expect(overlappingBoxes(d)).toEqual([]);
  });

  it('a shelf rail fits between the legs', () => {
    const d = ok(generateWeldShelf({ width: 900, size: 2 }));
    expect(d.members.find((m) => m.id === 'shelf-long')!.length).toBe(Math.floor(900 - 2 * 25.4));
  });
});

describe('validation', () => {
  it('rejects a gauge the size is not sold in', () => {
    const r = generateWeldTable({ size: 1, gauge: 11 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.paramKey).toBe('gauge');
  });

  it('rejects shelves packed closer than 200 mm', () => {
    const r = generateWeldShelf({ height: 900, shelves: 6 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.paramKey).toBe('shelves');
  });
});

describe('suggestions', () => {
  const applyFix = (gen: (p: TemplateParams) => WeldResult, params: TemplateParams) => {
    const d = ok(gen(params));
    const fix = warns(d)[0]!.fix!;
    return ok(gen({ ...params, ...fix.params }));
  };

  it('stick on 1.2 mm wall warns and offers a thicker gauge', () => {
    const params = { process: 3, size: 2, gauge: 18, width: 800 };
    expect(warns(ok(generateWeldTable(params)))[0]!.message).toContain('perfora');
    expect(warns(applyFix(generateWeldTable, params))).toEqual([]);
  });

  it('a long table in small tube offers a bigger profile', () => {
    const params = { width: 2000, size: 2, gauge: 14 };
    const fixed = applyFix(generateWeldTable, params);
    expect(fixed.tube.side).toBeGreaterThan(25.4);
    expect(warns(fixed)).toEqual([]);
  });

  it('a tall narrow stool warns about tipping and widens the base', () => {
    const params = { height: 800, width: 300, depth: 300 };
    expect(warns(applyFix(generateWeldStool, params))).toEqual([]);
  });

  it('dropping the lower frame on tall legs asks for it back', () => {
    const d = ok(generateWeldTable({ lower: 0, size: 2, gauge: 14, width: 900 }));
    expect(warns(d)[0]!.fix!.params).toEqual({ lower: 1 });
  });
});

describe('shopping list', () => {
  const lines = (d: WeldDesign) => shoppingList(d, planBars(d.members)).flatMap((g) => g.lines.map((l) => l.label));

  it('buys bars, the process consumable and the chosen paint', () => {
    const d = ok(generateWeldTable({}));
    const labels = lines(d);
    expect(labels[0]).toBe(d.tube.label);
    expect(labels).toContain(d.settings.consumable);
    expect(labels).toContain('Esmalte negro mate');
    expect(labels.some((l) => l.startsWith('Gas'))).toBe(false);
  });

  it('gas processes add a tank; bare steel gets clear coat instead of enamel', () => {
    const labels = lines(ok(generateWeldTable({ process: 2, finish: 8 })));
    expect(labels.some((l) => l.startsWith('Gas'))).toBe(true);
    expect(labels).toContain('Barniz transparente para metal');
    expect(labels.some((l) => l.startsWith('Esmalte'))).toBe(false);
  });

  it('text lists tools with the chosen machine and safety gear', () => {
    const d = ok(generateWeldShelf({ process: 3 }));
    const text = shoppingText(d, 'Estante', planBars(d.members));
    expect(text).toContain(toolLabel(d, 'welder'));
    expect(text).toContain('Soldadora de electrodo');
    expect(text).toContain('SEGURIDAD');
  });
});
