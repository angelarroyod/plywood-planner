import type {
  Design,
  Fitting,
  GenerateResult,
  Hardware,
  Panel,
  ParamSpec,
  Placement,
  Step,
  Template,
  TemplateParams,
  ValidationIssue,
  Vec3,
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
import { doorSet, doorWidth } from '../parts/door.ts';

const PLINTH = 70; // mm, zoclo height: keeps mop water off the base
const LUGGAGE = 350; // mm clear between the Maletero and the Tapa
const ROD_DROP = 50; // mm from the Maletero's underside to the rod's center
const HANG_MIN = 1000; // mm of hanging space clothes need under the rod
const ROD_DEPTH_MIN = 500; // mm of depth a hanger needs (a hanger is about 450 mm wide)
const ROD_CLEARANCE = 2; // mm shorter than the inside width so the rod drops into its supports
const MIN_SHELF_GAP = 100; // mm of clear space between shelves
const BACK_SCREW_SPACING = 200; // mm between back screws
const MAX_SINGLE_DOOR = 600; // mm; a wider single door sags and racks
const MIN_DOOR = 200; // mm; a narrower door is useless

const INTERIOR_OPTIONS = [
  { value: 1, label: 'Colgar' },
  { value: 2, label: 'Entrepaños' },
  { value: 3, label: 'Mixto' },
];

const DOOR_OPTIONS = [
  { value: 0, label: 'Sin puertas' },
  { value: 1, label: 'Una' },
  { value: 2, label: 'Dos' },
];

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 400, max: 1000, step: 10, default: 800 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 1200, max: 2400, step: 10, default: 2000 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 400, max: 650, step: 10, default: 550 },
  { kind: 'select', key: 'interior', label: 'Interior', unit: '', options: INTERIOR_OPTIONS, default: 3 },
  { kind: 'number', key: 'shelfCount', label: 'Entrepaños', unit: '', min: 1, max: 8, step: 1, default: 3 },
  { kind: 'select', key: 'doors', label: 'Puertas', unit: '', options: DOOR_OPTIONS, default: 2 },
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

/** 'a, b y c' */
function spanishList(items: string[]): string {
  return items.length === 1 ? items[0]! : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/**
 * One closet module on a zoclo: sides, Tapa, Base, a Fibracel back, and an interior that
 * hangs clothes (Colgar: Maletero + rod), holds shelves (Entrepaños) or both (Mixto: Maletero
 * + rod over a 1000 mm short-hanging zone, shelves below). A wall is several modules side by
 * side. `depth` is the overall depth, back included, doors excluded.
 */
export function generateCloset(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const interior = p['interior']!; // 1 Colgar, 2 Entrepaños, 3 Mixto
  const N = p['shelfCount']!;
  const doors = p['doors']! as 0 | 1 | 2;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const Dc = D - tb; // case depth; the back makes up the rest
  const zc = tb / 2; // case center, shifted forward (+z) so the back sits behind it
  const span = W - 2 * t;
  const hasRod = interior !== 2;
  const shelves = interior === 1 ? 0 : N;
  const floor = PLINTH + t; // the Base's top face
  const hatBottom = H - t - LUGGAGE - t; // the Maletero's underside
  const rodY = hatBottom - ROD_DROP;
  const zoneTop = rodY - HANG_MIN; // Mixto: top face of the shelf that closes the hanging zone

  const issues: ValidationIssue[] = [];
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (hasRod && D < ROD_DEPTH_MIN) {
    issues.push({
      paramKey: 'depth',
      message:
        `Para colgar ropa el clóset necesita al menos ${ROD_DEPTH_MIN} mm de fondo (un gancho mide unos 450 mm). ` +
        'Aumenta la profundidad o elige Entrepaños.',
    });
  }
  if (interior === 1 && rodY - floor < HANG_MIN) {
    issues.push({
      paramKey: 'height',
      message:
        `Bajo el tubo quedan ${Math.round(rodY - floor)} mm y la ropa necesita al menos ${HANG_MIN} mm. ` +
        'Aumenta el alto o elige Entrepaños.',
    });
  }
  // Entrepaños spread over the whole inside; Mixto spreads N − 1 shelves under the zone's shelf.
  const gap =
    interior === 2 ? (H - PLINTH - 2 * t - N * t) / (N + 1) : (zoneTop - t - floor - (N - 1) * t) / N;
  if (interior === 3 && zoneTop - t - floor < MIN_SHELF_GAP) {
    issues.push({
      paramKey: 'height',
      message: `No caben la zona de colgar de ${HANG_MIN} mm y un espacio útil debajo. Aumenta el alto o elige Colgar.`,
    });
  } else if (interior !== 1 && gap < MIN_SHELF_GAP) {
    issues.push({
      paramKey: 'shelfCount',
      message:
        `No caben ${N} entrepaños: quedarían espacios de ${Math.max(0, Math.round(gap))} mm ` +
        `y el mínimo útil es ${MIN_SHELF_GAP} mm. Reduce los entrepaños o aumenta el alto.`,
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
  if (issues.length > 0) return { ok: false, issues };

  // Shelf undersides, bottom to top.
  const shelfBottoms: number[] = [];
  if (interior === 2) for (let i = 1; i <= N; i++) shelfBottoms.push(floor + i * gap + (i - 1) * t);
  if (interior === 3) {
    for (let i = 1; i < N; i++) shelfBottoms.push(floor + i * gap + (i - 1) * t);
    shelfBottoms.push(zoneTop - t);
  }

  const door = doorSet({ count: doors, width: W, bottom: PLINTH, top: H, frontZ: D / 2, stock, mode });
  const rodLength = span - ROD_CLEARANCE;

  // Every panel fits a 1220 × 2440 sheet: H ≤ 2400, W ≤ 1000, Dc ≤ 647.
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
    ...(hasRod ? [shelfPanel('hat-shelf', 'Maletero', 1)] : []),
    ...(shelves > 0 ? [shelfPanel('shelf', 'Entrepaño', shelves)] : []),
    ...door.panels,
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
    ...(hasRod ? [flat('hat-shelf', 0, hatBottom)] : []),
    ...shelfBottoms.map((y, i) => flat('shelf', i, y)),
    ...door.placements,
    { panelId: 'back', instance: 0, position: [0, H / 2, -D / 2 + tb / 2], size: [W, H, tb] },
  ];

  const rod: Fitting[] = hasRod
    ? [{ id: 'rod', instance: 0, label: 'Tubo', position: [0, rodY, zc], size: [rodLength, 30, 15] }]
    : [];

  const shelfLike = (hasRod ? 1 : 0) + shelves; // Maletero + Entrepaños
  const backScrews =
    Math.ceil((2 * (W + H)) / BACK_SCREW_SPACING) + shelfLike * Math.ceil(span / BACK_SCREW_SPACING);
  const rodHardware: Hardware[] = hasRod
    ? [
        { type: 'rod', size: '15×30 mm', qty: 1, cutTo: rodLength },
        { type: 'rod-support', size: '15×30 mm', qty: 2 },
      ]
    : [];
  const hardware: Hardware[] = [
    { type: 'confirmat', size: '5x50', qty: (2 + shelfLike) * 4 + 2 },
    { type: 'screw', size: '3.5x16', qty: backScrews },
    ...rodHardware,
    ...door.hardware,
  ];

  const marks = [
    `base a ${PLINTH} mm`,
    ...(shelfBottoms.length > 0 ? [`entrepaños a ${shelfBottoms.map((y) => Math.round(y)).join(' · ')} mm`] : []),
    ...(hasRod ? [`maletero a ${hatBottom} mm`] : []),
  ];
  const interiorIds = [...(hasRod ? ['hat-shelf'] : []), ...(shelves > 0 ? ['shelf'] : [])];
  const interiorTitle =
    interior === 1 ? 'Instala el maletero' : interior === 2 ? 'Instala los entrepaños' : 'Instala el maletero y los entrepaños';
  const backTo = ['al contorno', ...(hasRod ? ['al maletero'] : []), ...(shelves > 0 ? ['a cada entrepaño'] : [])];
  const rodSteps: Omit<Step, 'order'>[] = hasRod
    ? [
        {
          title: 'Pon el tubo',
          description:
            `Atornilla los soportes del tubo en los laterales a ${rodY} mm del piso y a ${Math.round(Dc / 2)} mm del frente. ` +
            `Corta el tubo a ${rodLength} mm con segueta y colócalo en los soportes.`,
          panelRefs: ['rod'],
          explodeOffsets: { rod: [0, 0, 200] },
        },
      ]
    : [];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} ` + `Marca en los laterales la cara de abajo de cada pieza: ${marks.join(', ')}.`,
      panelRefs: ['side'],
    },
    ...(mode === 'diy' ? [ironStep(panels.filter((pn) => pn.id !== 'back').map((pn) => pn.id))] : []),
    {
      title: 'Arma la caja acostada',
      description:
        'Fija la tapa y la base entre los laterales con tornillos confirmat, 2 por lado, y el zoclo bajo la base, ' +
        `al frente, con 1 por lado. Al pararlo gira sobre su diagonal, que mide ${Math.ceil(Math.hypot(H, D))} mm: ` +
        'revisa que libre tu techo.',
      panelRefs: ['side', 'top', 'bottom', 'plinth'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0], plinth: [0, 0, 150] },
    },
    {
      title: interiorTitle,
      description: 'Coloca cada pieza en su marca y fíjala con 2 confirmat por lado.',
      panelRefs: interiorIds,
      explodeOffsets: Object.fromEntries(interiorIds.map((id): [string, Vec3] => [id, [0, 0, 200]])),
    },
    {
      title: 'Verifica la escuadra y coloca el fondo',
      description:
        'Mide las dos diagonales del frente: deben ser iguales. Con el clóset boca abajo, atornilla el fondo de ' +
        `fibracel con la cara lisa hacia el frente cada 20 cm ${spanishList(backTo)}.`,
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    },
    ...rodSteps,
    ...door.steps,
  ];

  const design: Design = {
    templateId: 'closet',
    params: p,
    panels,
    placements,
    hardware,
    fittings: [...rod, ...door.fittings],
    boring: door.boring,
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const closet: Template = {
  id: 'closet',
  name: 'Clóset modular',
  description: 'Módulo de clóset con maletero, tubo para colgar y entrepaños; junta varios para cubrir una pared.',
  params,
  generate: (raw) => generateCloset(raw),
};
