import type {
  Design,
  GenerateResult,
  Panel,
  ParamSpec,
  Placement,
  Step,
  Template,
  TemplateParams,
  ValidationIssue,
} from '../types.ts';
import { DEFAULT_MATERIAL, FIBRACEL_3, MATERIAL_OPTIONS, getStock } from '../stock.ts';
import {
  DEFAULT_EDGE_BANDING,
  EDGE_BANDING_OPTIONS,
  NO_EDGES,
  bandEdges,
  edgeBandingMode,
  ironStep,
  prepSentence,
} from '../edge-banding.ts';
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';
import { spanishList } from '../labels.ts';
import { MIN_DRAWER_FRONT, drawerFrontHeight, drawerSet, type DrawerStack } from '../parts/drawer.ts';
import { mergeHardware } from '../parts/merge.ts';

const PLINTH = 70; // mm, zoclo height
const CABLE_SLOT = 100; // mm the back stops short of the top, so cables pass without a hole saw
const BACK_SCREW_SPACING = 200; // mm between back screws

const BAY_OPTIONS = [
  { value: 1, label: 'Cajones' },
  { value: 2, label: 'Entrepaño' },
];

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 1000, max: 1800, step: 10, default: 1400 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 400, max: 650, step: 10, default: 500 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 350, max: 500, step: 10, default: 400 },
  { kind: 'select', key: 'leftBay', label: 'Bahía izquierda', unit: '', options: BAY_OPTIONS, default: 1 },
  { kind: 'select', key: 'rightBay', label: 'Bahía derecha', unit: '', options: BAY_OPTIONS, default: 2 },
  { kind: 'number', key: 'drawersPerBay', label: 'Cajones por bahía', unit: '', min: 1, max: 3, step: 1, default: 2 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
  {
    kind: 'select',
    key: 'edgeBanding',
    label: 'Cubrecanto',
    unit: '',
    options: EDGE_BANDING_OPTIONS,
    default: DEFAULT_EDGE_BANDING,
  },
];

/**
 * A low TV stand on a zoclo: two bays split by a centre divider, each holding a stack of drawers or
 * an open shelf (open fronts suit electronics: the remote's infrared and ventilation). The Fibracel
 * back stops 100 mm short of the top as a cable slot. `depth` is the overall depth, back included.
 */
export function generateTvStand(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const bays = [p['leftBay']!, p['rightBay']!]; // 1 Cajones, 2 Entrepaño; left first
  const n = p['drawersPerBay']!;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const Dc = D - tb; // case depth; the back makes up the rest
  const zc = tb / 2; // case center, shifted forward (+z) so the back sits behind it
  const span = W - 2 * t; // Tapa, Base and zoclo run between the sides
  const bay = Math.floor((W - 3 * t) / 2); // each bay's inside width, rounded down to whole mm
  const hd = H - PLINTH - 2 * t; // between the Base and the Tapa
  const hasDrawers = bays.includes(1);
  const shelfBays = [0, 1].filter((i) => bays[i] === 2);
  const shelfBottom = PLINTH + t + (hd - t) / 2; // halfway up the bay
  const hf = drawerFrontHeight(n, PLINTH, H);

  const issues: ValidationIssue[] = [];
  const spanProblem = spanIssue(bay, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (hasDrawers && hf < MIN_DRAWER_FRONT) {
    issues.push({
      paramKey: 'drawersPerBay',
      message:
        `Con ${n} cajones por bahía cada frente quedaría de ${hf} mm y el mínimo es ${MIN_DRAWER_FRONT} mm. ` +
        'Usa menos cajones o aumenta el alto.',
    });
  }
  if (issues.length > 0) return { ok: false, issues };

  // Each bay's fronts keep 2 mm to its outer edge and to the centre line; boxes run between a side and the divider.
  const stacks: DrawerStack[] = [];
  if (bays[0] === 1) stacks.push({ frontLeft: -W / 2 + 2, frontRight: -2, openingLeft: -W / 2 + t, openingRight: -t / 2 });
  if (bays[1] === 1) stacks.push({ frontLeft: 2, frontRight: W / 2 - 2, openingLeft: t / 2, openingRight: W / 2 - t });
  const drawer = drawerSet({ count: n, stacks, bottom: PLINTH, top: H, frontZ: D / 2, depth: Dc, stock, mode });

  const flatPanel = (id: string, label: string, length: number, qty: number): Panel => ({
    id,
    label,
    length,
    width: Dc,
    stock,
    grain: 'length',
    edges: bandEdges(mode, 'L1'),
    qty,
  });
  // Every panel fits a 1220 × 2440 sheet: W ≤ 1800, H ≤ 650, Dc ≤ 497.
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'A1'), qty: 2 },
    flatPanel('top', 'Tapa', span, 1),
    flatPanel('bottom', 'Base', span, 1),
    { id: 'plinth', label: 'Zoclo', length: span, width: PLINTH, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    flatPanel('divider', 'Divisor', hd, 1),
    ...(shelfBays.length > 0 ? [flatPanel('shelf', 'Entrepaño', bay, shelfBays.length)] : []),
    ...drawer.panels,
    { id: 'back', label: 'Fondo', length: W, width: H - CABLE_SLOT, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: 1 },
  ];

  const bayCenter = [-(W - t) / 4, (W - t) / 4];
  const flat = (panelId: string, instance: number, x: number, length: number, bottomY: number): Placement => ({
    panelId,
    instance,
    position: [x, bottomY + t / 2, zc],
    size: [length, t, Dc],
  });
  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    flat('top', 0, 0, span, H - t),
    flat('bottom', 0, 0, span, PLINTH),
    { panelId: 'plinth', instance: 0, position: [0, PLINTH / 2, D / 2 - t / 2], size: [span, PLINTH, t] },
    { panelId: 'divider', instance: 0, position: [0, PLINTH + t + hd / 2, zc], size: [t, hd, Dc] },
    ...shelfBays.map((i, k) => flat('shelf', k, bayCenter[i]!, bay, shelfBottom)),
    ...drawer.placements,
    {
      panelId: 'back',
      instance: 0,
      position: [0, (H - CABLE_SLOT) / 2, -D / 2 + tb / 2],
      size: [W, H - CABLE_SLOT, tb],
    },
  ];

  const shelves = shelfBays.length;
  const backScrews =
    Math.ceil((2 * (W + H - CABLE_SLOT)) / BACK_SCREW_SPACING) +
    Math.ceil((H - CABLE_SLOT) / BACK_SCREW_SPACING) + // up the divider
    shelves * Math.ceil(bay / BACK_SCREW_SPACING);
  const hardware = mergeHardware([
    { type: 'confirmat', size: '5x50', qty: 4 * 3 + 2 + 4 * shelves }, // Tapa, Base, divider; zoclo; shelves
    { type: 'screw', size: '3.5x16', qty: backScrews },
    ...drawer.hardware,
  ]);

  const marks = [`base a ${PLINTH} mm`, ...(shelves > 0 ? [`entrepaño a ${Math.round(shelfBottom)} mm`] : [])];
  const backTo = [
    'a los laterales',
    `a la base (a ${Math.round(PLINTH + t / 2)} mm del borde de abajo)`,
    'al divisor',
    ...(shelves === 2 ? ['a cada entrepaño'] : shelves === 1 ? ['al entrepaño'] : []),
  ];
  const shelfSteps: Omit<Step, 'order'>[] =
    shelves > 0
      ? [
          {
            title: shelves === 2 ? 'Instala los entrepaños' : 'Instala el entrepaño',
            description: 'Coloca cada entrepaño en su marca y fíjalo con 2 confirmat por lado.',
            panelRefs: ['shelf'],
            explodeOffsets: { shelf: [0, 0, 200] },
          },
        ]
      : [];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} Marca en los laterales y en el divisor la cara de abajo de cada pieza: ` +
        `${marks.join(', ')}. Marca también el centro de la tapa y de la base para el divisor.`,
      panelRefs: ['side', 'divider'],
    },
    ...(mode === 'diy' ? [ironStep(panels.filter((pn) => pn.stock.id !== FIBRACEL_3.id).map((pn) => pn.id))] : []),
    {
      title: 'Arma la caja',
      description:
        'Fija la base y la tapa entre los laterales con tornillos confirmat, 2 por lado. Antes de poner el zoclo, ' +
        'fija el divisor en las marcas del centro con 2 confirmat a través de la base y 2 a través de la tapa. ' +
        'Luego fija el zoclo bajo la base, al frente, con 1 por lado.',
      panelRefs: ['side', 'top', 'bottom', 'divider', 'plinth'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0], divider: [0, 0, 150], plinth: [0, 0, 150] },
    },
    ...shelfSteps,
    {
      title: 'Verifica la escuadra y coloca el fondo',
      description:
        'Con el mueble boca abajo, mide las dos diagonales: deben ser iguales. Atornilla el fondo de fibracel con la ' +
        `cara lisa hacia el frente, cada 20 cm, desde el borde de abajo: ${spanishList(backTo)}. ` +
        `Deja libres los ${CABLE_SLOT / 10} cm de arriba para pasar los cables.`,
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    },
    ...drawer.steps,
  ];

  const design: Design = {
    templateId: 'tv-stand',
    params: p,
    panels,
    placements,
    hardware,
    fittings: drawer.fittings,
    boring: [],
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const tvStand: Template = {
  id: 'tv-stand',
  name: 'Mueble para TV',
  description: 'Mueble bajo para TV con dos bahías de cajones o entrepaño y paso de cables atrás.',
  params,
  generate: (raw) => generateTvStand(raw),
};
