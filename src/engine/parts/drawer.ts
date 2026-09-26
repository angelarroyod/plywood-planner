import { NO_EDGES, bandEdges } from '../edge-banding.ts';
import { FIBRACEL_3 } from '../stock.ts';
import type { EdgeBandingMode, Fitting, Hardware, Panel, Placement, Step, Stock, Vec3 } from '../types.ts';
import type { PartSet } from './merge.ts';

const GAP = 2; // mm at the top and bottom of a stack's fronts
const FRONT_GAP = 3; // mm between stacked fronts
const SLIDE_CLEARANCE = 26; // mm the box is narrower than its opening: 12.7 mm per telescopic slide, rounded
const BOX_SHORTER = 40; // mm the box is lower than its front: 20 mm above and 20 mm below
const SLIDE_BACK_CLEARANCE = 10; // mm left behind the slide
const BOTTOM_SCREW_SPACING = 150; // mm between the bottom's screws
const HANDLE_SPACING = 128; // mm between a bar handle's screws
const HANDLE_BOX: Vec3 = [160, 12, 30]; // mm; a horizontal bar standing 30 mm off the front

/** Telescopic ball-bearing slides as sold in Mexico: pairs, 10" to 22". */
export const SLIDES = [
  { inches: 10, mm: 254 },
  { inches: 12, mm: 305 },
  { inches: 14, mm: 356 },
  { inches: 16, mm: 406 },
  { inches: 18, mm: 457 },
  { inches: 20, mm: 508 },
  { inches: 22, mm: 559 },
];

export const MIN_DRAWER_FRONT = 120; // mm; leaves an 80 mm box

/** The longest slide that fits `depth` of inside depth with 10 mm to spare, or null when none does. */
export function slideFor(depth: number): { inches: number; mm: number } | null {
  return [...SLIDES].reverse().find((s) => s.mm <= depth - SLIDE_BACK_CLEARANCE) ?? null;
}

/** Height of each of `count` fronts stacked between `bottom` and `top`: 2 mm at the ends, 3 mm between. */
export function drawerFrontHeight(count: number, bottom: number, top: number): number {
  return Math.floor((top - bottom - 2 * GAP - FRONT_GAP * (count - 1)) / count);
}

/** One column of drawers: the x span its fronts cover and the x span between the walls its boxes run in. */
export interface DrawerStack {
  frontLeft: number;
  frontRight: number;
  openingLeft: number;
  openingRight: number;
}

export interface DrawerSetOptions {
  count: number; // drawers per stack, stacked bottom to top
  stacks: DrawerStack[]; // 1 or 2 columns side by side, all the same size
  bottom: number; // y where the fronts start
  top: number; // y where they end
  frontZ: number; // z of the case front
  depth: number; // inside depth available for the slides
  stock: Stock;
  mode: EdgeBandingMode;
}

/**
 * Drawers on telescopic slides: a screwed box (2 sides, 2 ends, a Fibracel bottom screwed underneath)
 * and a separate front banded all round, fixed last so it can be lined up after the box runs.
 * Drawn pulled out a third of their slide. The block does not validate — templates do.
 */
export function drawerSet(o: DrawerSetOptions): PartSet {
  const n = o.count * o.stacks.length;
  if (n === 0) return { panels: [], placements: [], hardware: [], fittings: [], boring: [], steps: [] };
  const slide = slideFor(o.depth);
  if (!slide) throw new Error(`No drawer slide fits ${o.depth} mm of depth`);

  const t = o.stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const L = slide.mm;
  const hf = drawerFrontHeight(o.count, o.bottom, o.top);
  const hb = hf - BOX_SHORTER;
  const first = o.stacks[0]!; // ponytail: every stack is the same size
  const wf = first.frontRight - first.frontLeft;
  const wb = Math.floor(first.openingRight - first.openingLeft - SLIDE_CLEARANCE);
  const pull = Math.round(L / 3);
  const frontBottoms = Array.from({ length: o.count }, (_, i) => o.bottom + GAP + i * (hf + FRONT_GAP));
  const centers = frontBottoms.map((y) => Math.round(y + hf / 2));
  const zBox = o.frontZ - L / 2 + pull;

  const placements: Placement[] = [];
  const fittings: Fitting[] = [];
  let k = 0; // drawer number across all stacks
  for (const s of o.stacks) {
    const fx = (s.frontLeft + s.frontRight) / 2;
    const bx = (s.openingLeft + s.openingRight) / 2;
    for (const fy of frontBottoms) {
      const by = fy + BOX_SHORTER / 2; // the box walls' underside
      const cy = by + hb / 2;
      placements.push(
        { panelId: 'drawer-front', instance: k, position: [fx, fy + hf / 2, o.frontZ + t / 2 + pull], size: [wf, hf, t] },
        { panelId: 'drawer-side', instance: 2 * k, position: [bx - wb / 2 + t / 2, cy, zBox], size: [t, hb, L] },
        { panelId: 'drawer-side', instance: 2 * k + 1, position: [bx + wb / 2 - t / 2, cy, zBox], size: [t, hb, L] },
        { panelId: 'drawer-end', instance: 2 * k, position: [bx, cy, o.frontZ - t / 2 + pull], size: [wb - 2 * t, hb, t] },
        { panelId: 'drawer-end', instance: 2 * k + 1, position: [bx, cy, o.frontZ - L + t / 2 + pull], size: [wb - 2 * t, hb, t] },
        { panelId: 'drawer-bottom', instance: k, position: [bx, by - tb / 2, zBox], size: [wb, tb, L] },
      );
      fittings.push({
        id: 'drawer-handle',
        instance: k,
        label: 'Jaladera',
        position: [fx, fy + hf / 2, o.frontZ + t + pull + HANDLE_BOX[2] / 2],
        size: [...HANDLE_BOX],
      });
      k++;
    }
  }

  const panels: Panel[] = [
    {
      id: 'drawer-front',
      label: 'Frente de cajón',
      length: wf,
      width: hf,
      stock: o.stock,
      grain: 'length',
      edges: bandEdges(o.mode, 'L1', 'L2', 'A1', 'A2'),
      qty: n,
    },
    { id: 'drawer-side', label: 'Costado de cajón', length: L, width: hb, stock: o.stock, grain: 'length', edges: NO_EDGES, qty: 2 * n },
    {
      id: 'drawer-end',
      label: 'Frente y trasera de cajón',
      length: wb - 2 * t,
      width: hb,
      stock: o.stock,
      grain: 'length',
      edges: NO_EDGES,
      qty: 2 * n,
    },
    { id: 'drawer-bottom', label: 'Fondo de cajón', length: L, width: wb, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: n },
  ];

  const hardware: Hardware[] = [
    { type: 'confirmat', size: '5x50', qty: 8 * n },
    { type: 'screw', size: '3.5x16', qty: Math.ceil((2 * (wb + L)) / BOTTOM_SCREW_SPACING) * n },
    { type: 'screw', size: '3.5x25', qty: 4 * n },
    { type: 'slide', size: `${slide.inches}" (${slide.mm} mm)`, qty: n },
    { type: 'handle', size: `${HANDLE_SPACING} mm`, qty: n },
  ];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Arma las cajas',
      description:
        'Arma cada caja con tornillos confirmat, 2 por esquina, con los costados por fuera del frente y la trasera. ' +
        'Mide sus diagonales para dejarla a escuadra y atornilla el fondo de fibracel por debajo cada ' +
        `${BOTTOM_SCREW_SPACING / 10} cm.`,
      panelRefs: ['drawer-side', 'drawer-end', 'drawer-bottom'],
    },
    {
      title: 'Monta las correderas',
      description:
        'Separa cada corredera en sus dos partes. Atornilla la parte fija en las paredes del hueco, al ras del frente, ' +
        `centrada a ${centers.join(' · ')} mm del piso, y la parte móvil en los costados de cada caja, centrada en su alto.`,
      panelRefs: ['drawer-side'],
    },
    {
      title: 'Mete los cajones',
      description: 'Engancha cada caja en sus correderas y revisa que corra suave y cierre al ras del frente.',
      panelRefs: ['drawer-side'],
    },
    {
      title: 'Pon los frentes',
      description:
        `Deja ${FRONT_GAP} mm entre frentes y ${GAP} mm alrededor, con cartón o monedas de separadores. Pega cada ` +
        'frente con cinta doble cara, abre el cajón y atorníllalo desde dentro con 4 tornillos de 3.5×25.',
      panelRefs: ['drawer-front'],
      explodeOffsets: { 'drawer-front': [0, 0, 150] },
    },
    {
      title: 'Pon las jaladeras de los cajones',
      description: `Barrena 2 agujeros de 5 mm separados ${HANDLE_SPACING} mm, centrados en cada frente, y atornilla la jaladera.`,
      panelRefs: ['drawer-front', 'drawer-handle'],
    },
  ];

  return { panels, placements, hardware, fittings, boring: [], steps };
}
