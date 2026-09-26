import { describe, expect, it } from 'vitest';
import { MIN_DRAWER_FRONT, drawerFrontHeight, drawerSet, slideFor, type DrawerSetOptions } from './drawer.ts';
import { FIBRACEL_3, getStock } from '../stock.ts';
import { NO_EDGES } from '../edge-banding.ts';

const PLY18 = getStock(3);
// The spec's closet example: 800 wide, 2 drawers from the zoclo (70) to the drawer shelf's centre (477), front at z = 275.
const CLOSET: DrawerSetOptions = {
  count: 2,
  stacks: [{ frontLeft: -398, frontRight: 398, openingLeft: -382, openingRight: 382 }],
  bottom: 70,
  top: 477,
  frontZ: 275,
  depth: 547,
  stock: PLY18,
  mode: 'yard',
};
// The TV stand default (1400 × 500 × 400) with drawers in both bays.
const TV_BOTH: DrawerSetOptions = {
  count: 2,
  stacks: [
    { frontLeft: -698, frontRight: -2, openingLeft: -682, openingRight: -9 },
    { frontLeft: 2, frontRight: 698, openingLeft: 9, openingRight: 682 },
  ],
  bottom: 70,
  top: 500,
  frontZ: 200,
  depth: 397,
  stock: PLY18,
  mode: 'yard',
};

describe('slideFor', () => {
  it('picks the longest telescopic slide that leaves 10 mm behind it', () => {
    expect(slideFor(264)).toEqual({ inches: 10, mm: 254 });
    expect(slideFor(263)).toBeNull();
    expect(slideFor(567)).toEqual({ inches: 20, mm: 508 });
    expect(slideFor(569)).toEqual({ inches: 22, mm: 559 });
  });
});

describe('drawerFrontHeight', () => {
  it('leaves 2 mm at the ends and 3 mm between fronts, rounding down', () => {
    expect(drawerFrontHeight(1, 70, 477)).toBe(403);
    expect(drawerFrontHeight(2, 70, 477)).toBe(200);
    expect(drawerFrontHeight(3, 70, 400)).toBe(106);
    expect(MIN_DRAWER_FRONT).toBe(120);
  });
});

describe('drawerSet', () => {
  it('cuts a banded front, two sides, two ends and a Fibracel bottom per drawer', () => {
    const { panels } = drawerSet(CLOSET);
    expect(panels.map((p) => [p.id, p.label, p.length, p.width, p.qty, p.stock.id, p.grain])).toEqual([
      ['drawer-front', 'Frente de cajón', 796, 200, 2, 3, 'length'],
      ['drawer-side', 'Costado de cajón', 508, 160, 4, 3, 'length'],
      ['drawer-end', 'Frente y trasera de cajón', 702, 160, 4, 3, 'length'],
      ['drawer-bottom', 'Fondo de cajón', 508, 738, 2, FIBRACEL_3.id, 'any'],
    ]);
    expect(panels[0]!.edges).toEqual({ L1: true, L2: true, A1: true, A2: true });
    for (const p of panels.slice(1)) expect(p.edges).toEqual(NO_EDGES);
  });

  it('draws each drawer pulled out a third of its slide, with the box centred on its front', () => {
    const { placements } = drawerSet(CLOSET);
    expect(placements.slice(0, 6)).toEqual([
      { panelId: 'drawer-front', instance: 0, position: [0, 172, 453], size: [796, 200, 18] },
      { panelId: 'drawer-side', instance: 0, position: [-360, 172, 190], size: [18, 160, 508] },
      { panelId: 'drawer-side', instance: 1, position: [360, 172, 190], size: [18, 160, 508] },
      { panelId: 'drawer-end', instance: 0, position: [0, 172, 435], size: [702, 160, 18] },
      { panelId: 'drawer-end', instance: 1, position: [0, 172, -55], size: [702, 160, 18] },
      { panelId: 'drawer-bottom', instance: 0, position: [0, 90.5, 190], size: [738, 3, 508] },
    ]);
    expect(placements.filter((p) => p.panelId === 'drawer-front').map((p) => p.position[1])).toEqual([172, 375]);
  });

  it('builds two stacks side by side from one set of panels', () => {
    const d = drawerSet(TV_BOTH);
    expect(d.panels.map((p) => [p.id, p.length, p.width, p.qty])).toEqual([
      ['drawer-front', 696, 211, 4],
      ['drawer-side', 356, 171, 8],
      ['drawer-end', 611, 171, 8],
      ['drawer-bottom', 356, 647, 4],
    ]);
    expect(
      d.placements.filter((p) => p.panelId === 'drawer-front').map((p) => [p.instance, p.position[0], p.position[1]]),
    ).toEqual([
      [0, -350, 177.5],
      [1, -350, 391.5],
      [2, 350, 177.5],
      [3, 350, 391.5],
    ]);
    // 13 mm of slide room on both sides of every box
    expect(d.placements.filter((p) => p.panelId === 'drawer-side').map((p) => p.position[0])).toEqual([
      -660, -31, -660, -31, 31, 660, 31, 660,
    ]);
  });

  it('puts a handle on each front and buys hardware per drawer', () => {
    const d = drawerSet(CLOSET);
    expect(d.fittings).toEqual([
      { id: 'drawer-handle', instance: 0, label: 'Jaladera', position: [0, 172, 477], size: [160, 12, 30] },
      { id: 'drawer-handle', instance: 1, label: 'Jaladera', position: [0, 375, 477], size: [160, 12, 30] },
    ]);
    expect(d.hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 16 },
      { type: 'screw', size: '3.5x16', qty: 34 }, // ⌈2·(738 + 508)/150⌉ = 17 per bottom
      { type: 'screw', size: '3.5x25', qty: 8 },
      { type: 'slide', size: '20" (508 mm)', qty: 2 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
    expect(d.boring).toEqual([]);
  });

  it('gives the slide heights from the floor and ends with the handles', () => {
    const steps = drawerSet(CLOSET).steps;
    expect(steps.map((s) => s.title)).toEqual([
      'Arma las cajas',
      'Monta las correderas',
      'Mete los cajones',
      'Pon los frentes',
      'Pon las jaladeras de los cajones',
    ]);
    expect(steps[1]!.description).toContain('al ras del frente, centrada a 172 · 375 mm del piso');
    expect(steps[3]).toMatchObject({ panelRefs: ['drawer-front'], explodeOffsets: { 'drawer-front': [0, 0, 150] } });
    expect(steps[4]!.panelRefs).toEqual(['drawer-front', 'drawer-handle']);
    expect(drawerSet(TV_BOTH).steps[1]!.description).toContain('centrada a 178 · 392 mm del piso');
  });

  it('returns nothing without drawers or stacks', () => {
    const empty = { panels: [], placements: [], hardware: [], fittings: [], boring: [], steps: [] };
    expect(drawerSet({ ...CLOSET, count: 0 })).toEqual(empty);
    expect(drawerSet({ ...CLOSET, stacks: [] })).toEqual(empty);
  });

  it('refuses a depth no slide fits', () => {
    expect(() => drawerSet({ ...CLOSET, depth: 263 })).toThrow('No drawer slide fits 263 mm of depth');
  });
});
