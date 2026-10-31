import { describe, expect, it } from 'vitest';
import { overlappingBoxes } from '../templates/testing.ts';
import type { TemplateParams } from '../types.ts';
import { BAR_LENGTH, weldProcess, weldSettings } from './catalog.ts';
import { endPlane } from './geometry.ts';
import { barCutTip, planBars, shoppingList, shoppingText, toolLabel } from './plan.ts';
import { generateWeldShelf, generateWeldStool, generateWeldTable, weldTemplates } from './templates.ts';
import { WELD_REF, type WeldDesign, type WeldResult } from './types.ts';

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

  it('draws every piece exactly as long as its cut', () => {
    for (const p of d.placements) {
      const m = d.members.find((x) => x.id === p.panelId)!;
      expect(p.size[p.axis]).toBe(m.length);
      expect(p.ends).toBe(m.ends);
    }
  });

  it('steps only name real members and keep tool demos near the model', () => {
    const ids = new Set([...d.members.map((m) => m.id), WELD_REF]);
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

  it('mitered top rails are cut to the full outside size and meet on shared 45° planes', () => {
    const d = ok(generateWeldTable({ joint: 2, depth: 600 }));
    expect(d.members.find((m) => m.id === 'top-short')).toMatchObject({ length: 600, ends: 'miter' });
    // the boxes share each corner cube; the miter splits it between the two rails
    expect(overlappingBoxes(d).sort()).toEqual([
      'top-long#0 × top-short#0',
      'top-long#0 × top-short#1',
      'top-long#1 × top-short#0',
      'top-long#1 × top-short#1',
    ]);
    const cuts = d.placements
      .filter((p) => p.ends === 'miter')
      .flatMap((p) => [endPlane(p, 0), endPlane(p, 1)]);
    const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    let seams = 0;
    for (let i = 0; i < cuts.length; i++)
      for (let j = i + 1; j < cuts.length; j++) {
        const [a, b] = [cuts[i]!, cuts[j]!];
        const gap = a.point.map((v, k) => b.point[k]! - v);
        if (dot(a.normal, b.normal) < -0.999999 && Math.abs(dot(gap, a.normal)) < 1e-9 && Math.hypot(...gap) < d.tube.side) seams++;
      }
    expect(seams).toBe(4);
  });

  it('a miter leans back from its long point on the outer face', () => {
    const d = ok(generateWeldTable({ joint: 2, width: 1000 }));
    const front = d.placements.find((p) => p.panelId === 'top-long' && p.position[2] > 0)!;
    const { point, normal } = endPlane(front, 1);
    const s = d.tube.side;
    // on the outer (front) face the cut reaches the full 500 mm; on the inner face it stops a side short
    const along = (zOff: number) => point[0] - (normal[2] * zOff) / normal[0];
    expect(along(s / 2)).toBeCloseTo(500);
    expect(along(-s / 2)).toBeCloseTo(500 - s);
  });

  it('welds every joint all round and plugs every open end', () => {
    const square = ok(generateWeldTable({}));
    expect(square.welds).toHaveLength(square.joints);
    expect(square.caps).toHaveLength(8); // 4 feet + the long rails' 4 open ends
    const miter = ok(generateWeldTable({ joint: 2 }));
    expect(miter.caps).toHaveLength(4); // feet only
    const s = miter.tube.side;
    expect(miter.weldLength).toBe(Math.round(12 * 4 * s + 4 * (2 + 2 * Math.SQRT2) * s));
    const shelf = ok(generateWeldShelf({}));
    expect(shelf.caps).toHaveLength(8); // feet + open leg tops
    const caps = shoppingList(shelf, planBars(shelf.members))[0]!.lines.find((l) => l.label.startsWith('Tapón'));
    expect(caps?.qty).toBe('8 pzas');
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

describe('bar plan copy', () => {
  it('adds the long-point note only when a member is mitered', () => {
    expect(barCutTip(ok(generateWeldTable({ joint: 1 })).members)).not.toContain('45°');
    expect(barCutTip(ok(generateWeldTable({ joint: 2 })).members)).toContain('punta larga a punta larga');
  });
});
