import { describe, expect, it } from 'vitest';
import { doorSet, doorWidth, hingeCount, type DoorSetOptions } from './door.ts';
import { getStock } from '../stock.ts';
import { NO_EDGES } from '../edge-banding.ts';

const PLY18 = getStock(3);
// The default closet front: 800 wide, from the 70 mm zoclo to 2000 mm, case front at z = 275.
const BASE: DoorSetOptions = { count: 2, width: 800, bottom: 70, top: 2000, frontZ: 275, stock: PLY18, mode: 'yard' };

describe('hingeCount', () => {
  it('adds a hinge past 900, 1600 and 2000 mm of door height', () => {
    expect([900, 901, 1600, 1601, 2000, 2001].map(hingeCount)).toEqual([2, 3, 3, 4, 4, 5]);
  });
});

describe('doorWidth', () => {
  it('leaves 2 mm at the outer edges and 3 mm between a pair', () => {
    expect(doorWidth(1, 600)).toBe(596);
    expect(doorWidth(2, 800)).toBe(396); // ⌊793 / 2⌋
  });
});

describe('doorSet', () => {
  it('cuts the doors 4 mm shorter than the covered front, banded all round', () => {
    expect(doorSet(BASE).panels).toEqual([
      {
        id: 'door',
        label: 'Puerta',
        length: 1926,
        width: 396,
        stock: PLY18,
        grain: 'length',
        edges: { L1: true, L2: true, A1: true, A2: true },
        qty: 2,
      },
    ]);
    expect(doorSet({ ...BASE, mode: 'none' }).panels[0]!.edges).toEqual(NO_EDGES);
  });

  it('spaces the hinge cups evenly, 100 mm in from each end', () => {
    expect(doorSet(BASE).boring).toEqual([
      { panelId: 'door', kind: 'hinge-cup', diameter: 35, depth: 12, fromEdge: 22, along: [100, 675, 1251, 1826] },
    ]);
    expect(doorSet({ ...BASE, top: 900 }).boring[0]!.along).toEqual([100, 726]); // 826 mm door: 2 hinges
  });

  it('buys one hinge per cup and one handle per door', () => {
    expect(doorSet(BASE).hardware).toEqual([
      { type: 'hinge', size: '35 mm recta', qty: 8 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
    expect(doorSet({ ...BASE, count: 1, width: 500 }).hardware.map((h) => h.qty)).toEqual([4, 1]);
  });

  it('draws the doors swung open 90°, standing in front of their sides', () => {
    expect(doorSet(BASE).placements).toEqual([
      { panelId: 'door', instance: 0, position: [-391, 1035, 473], size: [18, 1926, 396] },
      { panelId: 'door', instance: 1, position: [391, 1035, 473], size: [18, 1926, 396] },
    ]);
    expect(doorSet({ ...BASE, count: 1, width: 500 }).placements).toEqual([
      { panelId: 'door', instance: 0, position: [-241, 1035, 523], size: [18, 1926, 496] },
    ]);
  });

  it('puts a handle on each open door, 1050 mm up and 40 mm from its closing edge', () => {
    expect(doorSet(BASE).fittings).toEqual([
      { id: 'handle', instance: 0, label: 'Jaladera', position: [-415, 1050, 631], size: [30, 160, 12] },
      { id: 'handle', instance: 1, label: 'Jaladera', position: [415, 1050, 631], size: [30, 160, 12] },
    ]);
  });

  it("keeps a short door's handle 100 mm inside it", () => {
    // door from 72 to 898 mm → handle clamped down to 798
    expect(doorSet({ ...BASE, top: 900 }).fittings[0]!.position[1]).toBe(798);
  });

  it('gives the plate heights from the floor and the DIY drilling fallback', () => {
    const [plates, hang, handles] = doorSet(BASE).steps;
    expect(plates!.title).toBe('Monta las placas');
    expect(plates!.description).toContain('de cada lateral, a 37 mm del frente, a 172 · 747 · 1323 · 1898 mm del piso.');
    expect(plates!.description).toContain('broca Forstner de 35 mm, 12 mm de profundidad, centro a 22 mm del canto.');
    expect(hang).toMatchObject({ title: 'Cuelga las puertas', panelRefs: ['door'], explodeOffsets: { door: [0, 0, 150] } });
    expect(hang!.description).toContain('2 mm de luz alrededor y 3 mm entre las puertas.');
    expect(handles).toMatchObject({ title: 'Pon las jaladeras', panelRefs: ['door', 'handle'] });
    expect(handles!.description).toContain('separados 128 mm, a 40 mm del canto que cierra y centrados a 1050 mm del piso');
  });

  it('words a single door in the singular, hinged on the left side', () => {
    const steps = doorSet({ ...BASE, count: 1, width: 500 }).steps;
    expect(steps.map((s) => s.title)).toEqual(['Monta las placas', 'Cuelga la puerta', 'Pon la jaladera']);
    expect(steps[0]!.description).toContain('del lateral izquierdo');
    expect(steps[1]!.description).not.toContain('entre las puertas');
  });

  it('returns nothing without doors', () => {
    expect(doorSet({ ...BASE, count: 0 })).toEqual({
      panels: [],
      placements: [],
      hardware: [],
      fittings: [],
      boring: [],
      steps: [],
    });
  });
});
