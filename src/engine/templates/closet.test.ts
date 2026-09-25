import { describe, expect, it } from 'vitest';
import { closet } from './closet.ts';
import { nest } from '../nesting.ts';
import { refLabels } from '../labels.ts';
import { FIBRACEL_3, MATERIAL_OPTIONS } from '../stock.ts';
import type { Design, TemplateParams, ValidationIssue } from '../types.ts';

function designOf(params: TemplateParams = {}): Design {
  const result = closet.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.design;
}

function issuesOf(params: TemplateParams): ValidationIssue[] {
  const result = closet.generate(params);
  if (result.ok) throw new Error('expected validation issues');
  return result.issues;
}

const ids = (d: Design) => d.panels.map((p) => p.id);
const shelfYs = (d: Design) => d.placements.filter((p) => p.panelId === 'shelf').map((p) => p.position[1]);

describe('closet', () => {
  it('builds the default Mixto module with two doors', () => {
    const d = designOf();
    expect(d.panels.map((p) => [p.id, p.label, p.length, p.width, p.qty])).toEqual([
      ['side', 'Lateral', 2000, 547, 2],
      ['top', 'Tapa', 764, 547, 1],
      ['bottom', 'Base', 764, 547, 1],
      ['plinth', 'Zoclo', 764, 70, 1],
      ['hat-shelf', 'Maletero', 764, 547, 1],
      ['shelf', 'Entrepaño', 764, 547, 3],
      ['door', 'Puerta', 1926, 396, 2],
      ['back', 'Fondo', 2000, 800, 1],
    ]);
    expect(d.panels.find((p) => p.id === 'back')!.stock).toBe(FIBRACEL_3);
  });

  it('stands the case on a zoclo flush with the front', () => {
    const d = designOf();
    expect(d.placements.find((p) => p.panelId === 'plinth')).toEqual({
      panelId: 'plinth',
      instance: 0,
      position: [0, 35, 266],
      size: [764, 70, 18],
    });
    expect(d.placements.find((p) => p.panelId === 'bottom')!.position[1]).toBe(79); // rests on the zoclo
  });

  it('leaves 350 mm for luggage and hangs the rod 50 mm under the Maletero', () => {
    const d = designOf();
    expect(d.placements.find((p) => p.panelId === 'hat-shelf')!.position[1]).toBe(1623); // top face 1632
    expect(d.fittings.find((f) => f.id === 'rod')).toEqual({
      id: 'rod',
      instance: 0,
      label: 'Tubo',
      position: [0, 1564, 1.5],
      size: [762, 30, 15],
    });
  });

  it('closes a 1000 mm hanging zone with a shelf and spaces the rest below it (Mixto)', () => {
    const ys = shelfYs(designOf());
    expect(ys).toHaveLength(3);
    expect(ys[0]).toBeCloseTo(237.67, 1); // Base top face 88 + gap 140.67 + half a shelf
    expect(ys[1]).toBeCloseTo(396.33, 1);
    expect(ys[2]).toBe(555); // top face 564 = rod 1564 − 1000
  });

  it('spaces shelves evenly with no Maletero or rod (Entrepaños)', () => {
    const d = designOf({ interior: 2 });
    expect(ids(d)).not.toContain('hat-shelf');
    expect(shelfYs(d)).toEqual([557, 1035, 1513]); // gaps of 460
    expect(d.fittings.map((f) => f.id)).toEqual(['handle', 'handle']);
    expect(d.hardware.some((h) => h.type === 'rod')).toBe(false);
  });

  it('hangs clothes under the Maletero with no shelves (Colgar)', () => {
    const d = designOf({ interior: 1 });
    expect(ids(d)).toContain('hat-shelf');
    expect(ids(d)).not.toContain('shelf');
    expect(d.fittings.map((f) => f.id)).toEqual(['rod', 'handle', 'handle']);
  });

  it('buys the screws, the rod cut to size, hinges and handles', () => {
    expect(designOf().hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 26 }, // (Tapa, Base, Maletero, 3 entrepaños)·4 + zoclo 2
      { type: 'screw', size: '3.5x16', qty: 44 }, // ⌈2·(800+2000)/200⌉ + 4·⌈764/200⌉ = 28 + 16
      { type: 'rod', size: '15×30 mm', qty: 1, cutTo: 762 },
      { type: 'rod-support', size: '15×30 mm', qty: 2 },
      { type: 'hinge', size: '35 mm recta', qty: 8 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
  });

  it('asks the yard to drill the doors, and draws them open 90°', () => {
    const d = designOf();
    expect(d.boring).toEqual([
      { panelId: 'door', kind: 'hinge-cup', diameter: 35, depth: 12, fromEdge: 22, along: [100, 675, 1251, 1826] },
    ]);
    expect(d.placements.filter((p) => p.panelId === 'door').map((p) => p.position)).toEqual([
      [-391, 1035, 473],
      [391, 1035, 473],
    ]);
  });

  it('marks the pieces, warns about the diagonal and places the rod', () => {
    const steps = designOf().steps;
    expect(steps.map((s) => [s.order, s.title])).toEqual([
      [1, 'Prepara y marca'],
      [2, 'Arma la caja acostada'],
      [3, 'Instala el maletero y los entrepaños'],
      [4, 'Verifica la escuadra y coloca el fondo'],
      [5, 'Pon el tubo'],
      [6, 'Monta las placas'],
      [7, 'Cuelga las puertas'],
      [8, 'Pon las jaladeras'],
    ]);
    expect(steps[0]!.description).toContain(
      'Marca en los laterales la cara de abajo de cada pieza: base a 70 mm, entrepaños a 229 · 387 · 546 mm, maletero a 1614 mm.',
    );
    expect(steps[1]!.description).toContain('su diagonal, que mide 2075 mm: revisa que libre tu techo.');
    expect(steps[3]!.description).toContain('al contorno, al maletero y a cada entrepaño.');
    expect(steps[4]).toMatchObject({ panelRefs: ['rod'], explodeOffsets: { rod: [0, 0, 200] } });
    expect(steps[4]!.description).toContain('a 1564 mm del piso y a 274 mm del frente');
    expect(steps[4]!.description).toContain('Corta el tubo a 762 mm');
  });

  it('adds the ironing step when banding at home', () => {
    expect(designOf({ edgeBanding: 2 }).steps[1]!.title).toBe('Aplica el cubrecanto');
  });

  it('keeps every hinge plate off the shelves (Mixto, 2000 mm, 4 shelves)', () => {
    // shelves at 189..207, 308..326, 427..445, 546..564: the bottom plate moves from 172 down to 164
    expect(designOf({ shelfCount: 4 }).boring[0]!.along).toEqual([100, 675, 1251, 1834]);
  });

  it('labels every step reference, fittings included', () => {
    const labels = refLabels(designOf());
    expect([labels['side'], labels['rod'], labels['handle']]).toEqual(['Lateral', 'Tubo', 'Jaladera']);
  });

  it('drops the door parts and steps without doors', () => {
    const d = designOf({ doors: 0 });
    expect(ids(d)).not.toContain('door');
    expect(d.steps.at(-1)!.title).toBe('Pon el tubo');
    expect(d.hardware.some((h) => h.type === 'hinge' || h.type === 'handle')).toBe(false);
    expect(d.fittings.map((f) => f.id)).toEqual(['rod']);
  });
});

describe('closet validation', () => {
  it('rejects a span over the material limit', () => {
    expect(issuesOf({ width: 1000 })).toEqual([
      {
        paramKey: 'width',
        message:
          'El claro de 964 mm supera el máximo seguro de 800 mm para triplay de pino 18 mm. ' +
          'Reduce el ancho o elige un material más grueso.',
      },
    ]);
  });

  it('needs 500 mm of depth to hang clothes', () => {
    expect(issuesOf({ depth: 450 })).toEqual([
      {
        paramKey: 'depth',
        message:
          'Para colgar ropa el clóset necesita al menos 500 mm de fondo (un gancho mide unos 450 mm). ' +
          'Aumenta la profundidad o elige Entrepaños.',
      },
    ]);
    expect(closet.generate({ depth: 450, interior: 2 }).ok).toBe(true);
  });

  it('needs 1000 mm under the rod (Colgar)', () => {
    expect(issuesOf({ interior: 1, height: 1500 })).toEqual([
      {
        paramKey: 'height',
        message: 'Bajo el tubo quedan 976 mm y la ropa necesita al menos 1000 mm. Aumenta el alto o elige Entrepaños.',
      },
    ]);
  });

  it('needs room for the hanging zone and a space below it (Mixto)', () => {
    expect(issuesOf({ height: 1600 })).toEqual([
      {
        paramKey: 'height',
        message: 'No caben la zona de colgar de 1000 mm y un espacio útil debajo. Aumenta el alto o elige Colgar.',
      },
    ]);
  });

  it('rejects shelves packed closer than 100 mm', () => {
    expect(issuesOf({ shelfCount: 4, height: 1800 })).toEqual([
      {
        paramKey: 'shelfCount',
        message:
          'No caben 4 entrepaños: quedarían espacios de 51 mm y el mínimo útil es 100 mm. ' +
          'Reduce los entrepaños o aumenta el alto.',
      },
    ]);
  });

  it('limits one door to 600 mm and two doors to 200 mm each', () => {
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
    expect(issuesOf({ material: 1, width: 500, doors: 1, interior: 2 })).toEqual([
      {
        paramKey: 'material',
        message:
          'Las bisagras de cazoleta necesitan puertas de al menos 15 mm: la cazoleta mide 12 mm de profundidad. ' +
          'Elige un material de 15 mm o más, o quita las puertas.',
      },
    ]);
    expect(closet.generate({ material: 1, width: 500, doors: 0, interior: 2 }).ok).toBe(true);
  });
});

/** Every hinge plate (cup height ± 25 mm) clears every horizontal panel, and no two 3D boxes overlap. */
function expectBuildable(d: Design) {
  const flats = d.placements.filter((p) => ['top', 'bottom', 'hat-shelf', 'shelf'].includes(p.panelId));
  const door = d.placements.find((p) => p.panelId === 'door');
  if (door) {
    const doorTop = door.position[1] + door.size[1] / 2;
    for (const a of d.boring[0]!.along) {
      const y = doorTop - a;
      for (const f of flats) {
        const bottom = f.position[1] - f.size[1] / 2;
        const top = f.position[1] + f.size[1] / 2;
        expect(y + 25 <= bottom || y - 25 >= top).toBe(true);
      }
    }
  }
  const boxes = [...d.placements, ...d.fittings];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlaps = [0, 1, 2].every(
        (k) => Math.abs(a.position[k]! - b.position[k]!) < (a.size[k]! + b.size[k]!) / 2 - 0.001,
      );
      expect(overlaps).toBe(false);
    }
}

describe('closet sheet fit', () => {
  it('nests every valid module across the param range', () => {
    let valid = 0;
    for (const material of MATERIAL_OPTIONS.map((o) => o.value))
      for (const width of [400, 500, 700, 830])
        for (const height of [1200, 1800, 2400])
          for (const depth of [400, 650])
            for (const interior of [1, 2, 3])
              for (const shelfCount of [1, 8])
                for (const doors of [0, 1, 2]) {
                  const result = closet.generate({ material, width, height, depth, interior, shelfCount, doors });
                  if (!result.ok) continue;
                  valid++;
                  expect(() => nest(result.design.panels)).not.toThrow();
                  expectBuildable(result.design);
                }
    expect(valid).toBeGreaterThan(100);
  });
});
