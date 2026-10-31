import { describe, expect, it } from 'vitest';
import { pantry } from './pantry.ts';
import { nest } from '../nesting.ts';
import { MIN_DRAWER_FRONT } from '../parts/drawer.ts';
import { drawerBoxClearance, overlappingBoxes } from './testing.ts';
import { FIBRACEL_3, MATERIAL_OPTIONS } from '../stock.ts';
import type { Design, TemplateParams, ValidationIssue } from '../types.ts';

function designOf(params: TemplateParams = {}): Design {
  const result = pantry.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.design;
}

function issuesOf(params: TemplateParams): ValidationIssue[] {
  const result = pantry.generate(params);
  if (result.ok) throw new Error('expected validation issues');
  return result.issues;
}

const ids = (d: Design) => d.panels.map((p) => p.id);
const ys = (d: Design, id: string) => d.placements.filter((p) => p.panelId === id).map((p) => p.position[1]);
const along = (d: Design, id: string) => d.boring.find((b) => b.panelId === id)!.along;
const qty = (d: Design, type: string) => d.hardware.filter((h) => h.type === type).reduce((n, h) => n + h.qty, 0);

describe('pantry', () => {
  it('builds the default: shelves over a counter-height fixed shelf, a door above and a door below', () => {
    const d = designOf();
    expect(d.panels.map((p) => [p.id, p.label, p.length, p.width, p.qty])).toEqual([
      ['side', 'Lateral', 2100, 397, 2],
      ['top', 'Tapa', 564, 397, 1],
      ['bottom', 'Base', 564, 397, 1],
      ['plinth', 'Zoclo', 564, 70, 1],
      ['fixed-shelf', 'Entrepaño fijo', 564, 397, 1],
      ['shelf', 'Entrepaño', 564, 397, 5],
      ['door-upper', 'Puerta alta', 1196, 596, 1],
      ['door-lower', 'Puerta baja', 826, 596, 1],
      ['back', 'Fondo', 2100, 600, 1],
    ]);
    expect(d.panels.find((p) => p.id === 'back')!.stock).toBe(FIBRACEL_3);
  });

  it('centres the fixed shelf at 900 mm, splits the lower section once and spaces the shelves above', () => {
    const d = designOf();
    expect(ys(d, 'fixed-shelf')).toEqual([900]);
    const shelves = ys(d, 'shelf');
    [489.5, 1138.2, 1376.4, 1614.6, 1852.8].forEach((y, i) => expect(shelves[i]).toBeCloseTo(y, 6));
  });

  it('buys the case screws, the anti-tip brackets, hinges and handles', () => {
    expect(designOf().hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 34 }, // (Tapa, Base, fixed shelf, 5 shelves)·4 + zoclo 2
      { type: 'screw', size: '3.5x16', qty: 45 }, // ⌈2·(600+2100)/200⌉ + 6·⌈564/200⌉ = 27 + 18
      { type: 'screw', size: '3.5x13', qty: 4 },
      { type: 'bracket', size: '2" (50 mm)', qty: 2 },
      { type: 'wall-anchor', size: '1/4"', qty: 4 },
      { type: 'hinge', size: '35 mm recta', qty: 5 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
    // a 12 mm board takes the same short bracket screws: 13 mm + a 2 mm bracket stays inside it
    expect(designOf({ material: 1, width: 500, doors: 0 }).hardware).toContainEqual({ type: 'screw', size: '3.5x13', qty: 4 });
  });

  it('counts hinges by door height on each row', () => {
    const d = designOf();
    expect(along(d, 'door-upper')).toEqual([100, 598, 1096]); // 1196 mm: 3 hinges
    expect(along(d, 'door-lower')).toEqual([100, 726]); // 826 mm: 2 hinges
    const pair = designOf({ doors: 2, width: 800 });
    expect(qty(pair, 'hinge')).toBe(10);
    expect(qty(pair, 'handle')).toBe(4);
    expect(along(designOf({ height: 1500, shelfCount: 2 }), 'door-upper')).toEqual([100, 496]); // 596 mm: 2 hinges
    expect(along(designOf({ height: 2400 }), 'door-upper')).toHaveLength(3); // 1496 mm
  });

  it('puts the upper handle at 1050 mm and the lower one 100 mm under its door top', () => {
    const d = designOf();
    expect(d.fittings.map((f) => [f.id, f.position[1]])).toEqual([
      ['handle-upper', 1050],
      ['handle-lower', 798],
    ]);
  });

  it('swaps the lower doors and shelf for drawers under the fixed shelf (Cajones)', () => {
    const d = designOf({ lower: 2 });
    expect(ids(d)).not.toContain('door-lower');
    expect(d.panels.find((p) => p.id === 'shelf')!.qty).toBe(4);
    expect(d.panels.find((p) => p.id === 'door')).toMatchObject({ label: 'Puerta', length: 1196, width: 596, qty: 1 });
    expect(d.panels.find((p) => p.id === 'drawer-front')).toMatchObject({ length: 596, width: 273, qty: 3 });
    expect(d.hardware).toContainEqual({ type: 'slide', size: '14" (356 mm)', qty: 3 });
    expect(d.fittings.map((f) => f.id)).toEqual(['drawer-handle', 'drawer-handle', 'drawer-handle', 'handle']);
  });

  it('marks the pieces, squares the case, fixes it to the wall and hangs both door rows', () => {
    const steps = designOf().steps;
    expect(steps.map((s) => [s.order, s.title])).toEqual([
      [1, 'Prepara y marca'],
      [2, 'Arma la caja acostada'],
      [3, 'Instala el entrepaño fijo y los entrepaños'],
      [4, 'Verifica la escuadra y coloca el fondo'],
      [5, 'Fija la alacena al muro'],
      [6, 'Monta las placas de la puerta alta'],
      [7, 'Cuelga la puerta alta'],
      [8, 'Pon la jaladera de la puerta alta'],
      [9, 'Monta las placas de la puerta baja'],
      [10, 'Cuelga la puerta baja'],
      [11, 'Pon la jaladera de la puerta baja'],
    ]);
    expect(steps[0]!.description).toContain(
      'Marca en los laterales la cara de abajo de cada pieza: base a 70 mm, entrepaño de abajo a 481 mm, ' +
        'entrepaño fijo a 891 mm, entrepaños a 1129 · 1367 · 1606 · 1844 mm.',
    );
    expect(steps[2]!.panelRefs).toEqual(['fixed-shelf', 'shelf']);
    expect(steps[3]!.description).toContain(
      'a los laterales, a la tapa, a la base (a 79 mm del borde de abajo), al entrepaño fijo y a cada entrepaño. ' +
        'Al pararla gira sobre su diagonal, que mide 2138 mm: revisa que libre tu techo.',
    );
    expect(steps[4]).toMatchObject({ panelRefs: ['top'] });
    expect(steps[4]!.description).toContain('2 escuadras sobre la tapa, a 50 mm de cada lateral');
    expect(steps[4]!.description).toContain('con 2 tornillos 3.5×13 cada una');
  });

  it('adds the drawer steps after the wall and before the doors (Cajones)', () => {
    const steps = designOf({ lower: 2 }).steps;
    expect(steps.map((s) => s.title).slice(4)).toEqual([
      'Fija la alacena al muro',
      'Arma las cajas',
      'Monta las correderas',
      'Mete los cajones',
      'Pon los frentes',
      'Pon las jaladeras de los cajones',
      'Monta las placas',
      'Cuelga la puerta',
      'Pon la jaladera',
    ]);
    expect(steps[0]!.description).toContain('base a 70 mm, entrepaño fijo a 891 mm, entrepaños a');
  });

  it('adds the ironing step when banding at home', () => {
    expect(designOf({ edgeBanding: 2 }).steps[1]!.title).toBe('Aplica el cubrecanto');
  });

  it('drops the door parts and steps without doors', () => {
    const d = designOf({ doors: 0 });
    expect(ids(d).some((id) => id.startsWith('door'))).toBe(false);
    expect(d.steps.at(-1)!.title).toBe('Fija la alacena al muro');
    expect(d.fittings).toEqual([]);
    expect(d.boring).toEqual([]);
  });
});

describe('pantry validation', () => {
  it('rejects a span over the material limit', () => {
    expect(issuesOf({ width: 900, doors: 2 })).toEqual([
      {
        paramKey: 'width',
        message:
          'El claro de 864 mm supera el máximo seguro de 800 mm para triplay de pino 18 mm. ' +
          'Reduce el ancho o elige un material más grueso.',
      },
    ]);
  });

  it('keeps upper shelves a can apart', () => {
    expect(issuesOf({ shelfCount: 6, height: 1600 })).toEqual([
      {
        paramKey: 'shelfCount',
        message:
          'No caben 6 entrepaños arriba: quedarían espacios de 81 mm y el mínimo útil es 150 mm ' +
          '(una lata mide unos 120 mm). Reduce los entrepaños o aumenta el alto.',
      },
    ]);
  });

  it('limits one door to 600 mm and two doors to 200 mm each, once for both rows', () => {
    expect(issuesOf({ doors: 1, width: 700 })).toEqual([
      {
        paramKey: 'doors',
        message: 'Una sola puerta de 696 mm pesa y se descuadra; el máximo es 600 mm. Usa dos puertas.',
      },
    ]);
    expect(issuesOf({ doors: 2, width: 400 })).toEqual([
      { paramKey: 'doors', message: 'Dos puertas quedarían de 196 mm y el mínimo es 200 mm. Usa una puerta.' },
    ]);
  });

  it('needs doors of at least 15 mm for the 12 mm hinge cups', () => {
    expect(issuesOf({ material: 1, width: 500 })).toEqual([
      {
        paramKey: 'material',
        message:
          'Las bisagras de cazoleta necesitan puertas de al menos 15 mm: la cazoleta mide 12 mm de profundidad. ' +
          'Elige un material de 15 mm o más, o quita las puertas.',
      },
    ]);
    expect(pantry.generate({ material: 1, width: 500, doors: 0 }).ok).toBe(true);
  });
});

/** Every row's hinge plates (cup height ± 25 mm) clear every horizontal panel; boxes never overlap. */
function expectBuildable(d: Design) {
  const flats = d.placements.filter((p) => ['top', 'bottom', 'fixed-shelf', 'shelf'].includes(p.panelId));
  for (const b of d.boring) {
    const door = d.placements.find((p) => p.panelId === b.panelId)!;
    const doorTop = door.position[1] + door.size[1] / 2;
    for (const a of b.along) {
      const y = doorTop - a;
      for (const f of flats) {
        const bottom = f.position[1] - f.size[1] / 2;
        const top = f.position[1] + f.size[1] / 2;
        expect(y + 25 <= bottom || y - 25 >= top).toBe(true);
      }
    }
  }
  const front = d.panels.find((p) => p.id === 'drawer-front');
  if (front) expect(front.width).toBeGreaterThanOrEqual(MIN_DRAWER_FRONT); // why the template never validates it
  expect(drawerBoxClearance(d)).toBeGreaterThanOrEqual(5);
  expect(overlappingBoxes(d)).toEqual([]);
}

describe('pantry sheet fit', () => {
  it('nests every valid pantry across the param range', () => {
    let valid = 0;
    for (const material of MATERIAL_OPTIONS.map((o) => o.value))
      for (const width of [400, 500, 600, 900])
        for (const height of [1500, 2100, 2400])
          for (const depth of [300, 600])
            for (const shelfCount of [1, 6])
              for (const lower of [1, 2])
                for (const drawers of [2, 4])
                  for (const doors of [0, 1, 2]) {
                    const result = pantry.generate({ material, width, height, depth, shelfCount, lower, drawers, doors });
                    if (!result.ok) continue;
                    valid++;
                    expect(() => nest(result.design.panels)).not.toThrow();
                    expectBuildable(result.design);
                  }
    expect(valid).toBeGreaterThan(150);
  });
});
