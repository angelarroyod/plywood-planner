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
import { MIN_DOOR_THICKNESS, doorSet, doorWidth } from '../parts/door.ts';
import { drawerSet } from '../parts/drawer.ts';
import { mergeHardware } from '../parts/merge.ts';
import { spanishList } from '../labels.ts';

const PLINTH = 70; // mm, zoclo height: keeps mop water off the base
const SPLIT = 900; // mm, centre of the fixed shelf: kitchen counter height
const MIN_SHELF_GAP = 150; // mm of clear space between shelves: a can is about 120 mm tall
const BACK_SCREW_SPACING = 200; // mm between back screws
const MAX_SINGLE_DOOR = 600; // mm; a wider single door sags and racks
const MIN_DOOR = 200; // mm; a narrower door is useless
const BRACKET_INSET = 50; // mm from each side to an anti-tip bracket

const LOWER_OPTIONS = [
  { value: 1, label: 'Puertas' },
  { value: 2, label: 'Cajones' },
];

const DOOR_OPTIONS = [
  { value: 0, label: 'Sin puertas' },
  { value: 1, label: 'Una' },
  { value: 2, label: 'Dos' },
];

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 400, max: 900, step: 10, default: 600 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 1500, max: 2400, step: 10, default: 2100 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 300, max: 600, step: 10, default: 400 },
  { kind: 'number', key: 'shelfCount', label: 'Entrepaños arriba', unit: '', min: 1, max: 6, step: 1, default: 4 },
  { kind: 'select', key: 'lower', label: 'Parte baja', unit: '', options: LOWER_OPTIONS, default: 1 },
  { kind: 'number', key: 'drawers', label: 'Cajones', unit: '', min: 2, max: 4, step: 1, default: 3 },
  { kind: 'select', key: 'doors', label: 'Puertas', unit: '', options: DOOR_OPTIONS, default: 1 },
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
 * A tall kitchen pantry on a zoclo: a fixed shelf at counter height splits it into shelves behind
 * upper doors and, below, either a second row of doors over one shelf or a stack of drawers. A Fibracel
 * back, and two brackets that hold it to the wall: full of cans, a tall shallow case tips over.
 * `depth` is the overall depth, back included, doors excluded.
 */
export function generatePantry(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const N = p['shelfCount']!;
  const hasDrawers = p['lower'] === 2; // 1 Puertas, 2 Cajones
  const drawers = p['drawers']!;
  const doors = p['doors']! as 0 | 1 | 2;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const Dc = D - tb; // case depth; the back makes up the rest
  const zc = tb / 2; // case center, shifted forward (+z) so the back sits behind it
  const span = W - 2 * t;
  const upperFloor = SPLIT + t / 2; // the fixed shelf's top face
  const gap = (H - t - upperFloor - N * t) / (N + 1);

  const issues: ValidationIssue[] = [];
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (gap < MIN_SHELF_GAP) {
    issues.push({
      paramKey: 'shelfCount',
      message:
        `No caben ${N} entrepaños arriba: quedarían espacios de ${Math.max(0, Math.round(gap))} mm ` +
        `y el mínimo útil es ${MIN_SHELF_GAP} mm (una lata mide unos 120 mm). Reduce los entrepaños o aumenta el alto.`,
    });
  }
  if (doors === 1 && doorWidth(1, W) > MAX_SINGLE_DOOR) {
    issues.push({
      paramKey: 'doors',
      message:
        `Una sola puerta de ${doorWidth(1, W)} mm pesa y se descuadra; el máximo es ${MAX_SINGLE_DOOR} mm. ` +
        'Usa dos puertas.',
    });
  }
  if (doors === 2 && doorWidth(2, W) < MIN_DOOR) {
    issues.push({
      paramKey: 'doors',
      message: `Dos puertas quedarían de ${doorWidth(2, W)} mm y el mínimo es ${MIN_DOOR} mm. Usa una puerta.`,
    });
  }
  if (doors > 0 && t < MIN_DOOR_THICKNESS) {
    issues.push({
      paramKey: 'material',
      message:
        `Las bisagras de cazoleta necesitan puertas de al menos ${MIN_DOOR_THICKNESS} mm: la cazoleta mide 12 mm ` +
        `de profundidad. Elige un material de ${MIN_DOOR_THICKNESS} mm o más, o quita las puertas.`,
    });
  }
  // ponytail: no drawer-front check — 4 fronts under the fixed 830 mm zone are 204 mm, over MIN_DRAWER_FRONT (the sweep test asserts it)
  if (issues.length > 0) return { ok: false, issues };

  // Shelf undersides, bottom to top: one halfway up behind lower doors, then N spread over the upper section.
  const lowerShelf = hasDrawers ? [] : [PLINTH + t + (SPLIT - t / 2 - (PLINTH + t) - t) / 2];
  const upperShelves = Array.from({ length: N }, (_, i) => upperFloor + (i + 1) * gap + i * t);
  const shelfBottoms = [...lowerShelf, ...upperShelves];

  const flatRanges = [
    { bottom: PLINTH, top: PLINTH + t }, // Base
    { bottom: SPLIT - t / 2, top: SPLIT + t / 2 }, // fixed shelf
    { bottom: H - t, top: H }, // Tapa
    ...shelfBottoms.map((y) => ({ bottom: y, top: y + t })),
  ];
  const doorRow = (count: 0 | 1 | 2, bottom: number, top: number, row?: 'upper' | 'lower') =>
    doorSet({ count, width: W, bottom, top, frontZ: D / 2, stock, mode, avoid: flatRanges, row });
  // Two rows of doors need names; over drawers the upper row is the only one, as in the closet.
  const upper = doorRow(doors, SPLIT, H, hasDrawers ? undefined : 'upper');
  const lower = doorRow(hasDrawers ? 0 : doors, PLINTH, SPLIT, 'lower');
  // Fronts keep 2 mm to the case's outer edges; the boxes run between the sides, under the fixed shelf.
  const drawer = drawerSet({
    count: hasDrawers ? drawers : 0,
    stacks: [{ frontLeft: -W / 2 + 2, frontRight: W / 2 - 2, openingLeft: -W / 2 + t, openingRight: W / 2 - t }],
    bottom: PLINTH,
    top: SPLIT,
    frontZ: D / 2,
    depth: Dc,
    stock,
    mode,
  });

  // Every panel fits a 1220 × 2440 sheet: H ≤ 2400, W ≤ 900, Dc ≤ 597.
  const shelfPanel = (id: string, label: string, qty: number): Panel => ({
    id,
    label,
    length: span,
    width: Dc,
    stock,
    grain: 'length',
    edges: bandEdges(mode, 'L1'),
    qty,
  });
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'A1'), qty: 2 },
    shelfPanel('top', 'Tapa', 1),
    shelfPanel('bottom', 'Base', 1),
    { id: 'plinth', label: 'Zoclo', length: span, width: PLINTH, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    shelfPanel('fixed-shelf', 'Entrepaño fijo', 1),
    shelfPanel('shelf', 'Entrepaño', shelfBottoms.length),
    ...drawer.panels,
    ...upper.panels,
    ...lower.panels,
    { id: 'back', label: 'Fondo', length: H, width: W, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: 1 },
  ];

  const flat = (panelId: string, instance: number, bottomY: number): Placement => ({
    panelId,
    instance,
    position: [0, bottomY + t / 2, zc],
    size: [span, t, Dc],
  });
  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    flat('top', 0, H - t),
    flat('bottom', 0, PLINTH),
    { panelId: 'plinth', instance: 0, position: [0, PLINTH / 2, D / 2 - t / 2], size: [span, PLINTH, t] },
    flat('fixed-shelf', 0, SPLIT - t / 2),
    ...shelfBottoms.map((y, i) => flat('shelf', i, y)),
    ...drawer.placements,
    ...upper.placements,
    ...lower.placements,
    { panelId: 'back', instance: 0, position: [0, H / 2, -D / 2 + tb / 2], size: [W, H, tb] },
  ];

  const shelfLike = 1 + shelfBottoms.length; // fixed shelf + shelves
  const backScrews =
    Math.ceil((2 * (W + H)) / BACK_SCREW_SPACING) + shelfLike * Math.ceil(span / BACK_SCREW_SPACING);
  const hardware = mergeHardware([
    { type: 'confirmat', size: '5x50', qty: (2 + shelfLike) * 4 + 2 },
    { type: 'screw', size: '3.5x16', qty: backScrews },
    { type: 'screw', size: '3.5x13', qty: 4 }, // brackets to the Tapa: 13 mm + a 2 mm bracket stays inside even 12 mm
    { type: 'bracket', size: '2" (50 mm)', qty: 2 },
    { type: 'wall-anchor', size: '1/4"', qty: 4 },
    ...drawer.hardware,
    ...upper.hardware,
    ...lower.hardware,
  ]);

  const round = (y: number) => Math.round(y);
  const marks = [
    `base a ${PLINTH} mm`,
    ...lowerShelf.map((y) => `entrepaño de abajo a ${round(y)} mm`),
    `entrepaño fijo a ${round(SPLIT - t / 2)} mm`,
    `entrepaños a ${upperShelves.map(round).join(' · ')} mm`,
  ];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} ` + `Marca en los laterales la cara de abajo de cada pieza: ${marks.join(', ')}.`,
      panelRefs: ['side'],
    },
    ...(mode === 'diy' ? [ironStep(panels.filter((pn) => Object.values(pn.edges).some(Boolean)).map((pn) => pn.id))] : []),
    {
      title: 'Arma la caja acostada',
      description:
        'Fija la tapa y la base entre los laterales con tornillos confirmat, 2 por lado, y el zoclo bajo la base, ' +
        'al frente, con 1 por lado.',
      panelRefs: ['side', 'top', 'bottom', 'plinth'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0], plinth: [0, 0, 150] },
    },
    {
      title: 'Instala el entrepaño fijo y los entrepaños',
      description: 'Coloca cada pieza en su marca y fíjala con 2 confirmat por lado.',
      panelRefs: ['fixed-shelf', 'shelf'],
      explodeOffsets: { 'fixed-shelf': [0, 0, 200], shelf: [0, 0, 200] },
    },
    {
      title: 'Verifica la escuadra y coloca el fondo',
      description:
        'Con la alacena boca abajo, mide las dos diagonales: deben ser iguales. Atornilla el fondo de fibracel con la ' +
        `cara lisa hacia el frente, cada 20 cm, ${spanishList([
          'a los laterales',
          'a la tapa',
          `a la base (a ${round(PLINTH + t / 2)} mm del borde de abajo)`,
          'al entrepaño fijo',
          'a cada entrepaño',
        ])}. Al pararla gira sobre su diagonal, que mide ${Math.ceil(Math.hypot(H, D))} mm: revisa que libre tu techo.`,
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    },
    {
      title: 'Fija la alacena al muro',
      description:
        `Párala pegada al muro donde va a quedar. Atornilla 2 escuadras sobre la tapa, a ${BRACKET_INSET} mm de cada ` +
        'lateral y contra el muro, con 2 tornillos 3.5×13 cada una. Marca los agujeros en el muro, barrena con broca ' +
        'de 1/4" (para concreto si el muro es de block o tabique), mete los taquetes y atornilla las pijas. Si el techo ' +
        'no deja espacio sobre la tapa, pon las escuadras por dentro, bajo la tapa. Llena, una alacena puede ' +
        'voltearse: no te saltes este paso.',
      panelRefs: ['top'],
    },
    ...drawer.steps,
    ...upper.steps,
    ...lower.steps,
  ];

  const design: Design = {
    templateId: 'pantry',
    params: p,
    panels,
    placements,
    hardware,
    fittings: [...drawer.fittings, ...upper.fittings, ...lower.fittings],
    boring: [...upper.boring, ...lower.boring],
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const pantry: Template = {
  id: 'pantry',
  name: 'Alacena',
  description: 'Alacena alta de cocina con entrepaños, puertas arriba y abajo o cajones abajo; se fija al muro.',
  params,
  generate: (raw) => generatePantry(raw),
};
