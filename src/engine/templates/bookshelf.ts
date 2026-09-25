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

const MIN_SHELF_GAP = 100; // mm of clear space between shelves
const BACK_SCREW_SPACING = 200; // mm between back screws, around the edge and along each shelf

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 1200, step: 10, default: 800 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 400, max: 2000, step: 10, default: 1200 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 200, max: 400, step: 10, default: 300 },
  { kind: 'number', key: 'shelfCount', label: 'Número de entrepaños', unit: '', min: 1, max: 8, step: 1, default: 3 },
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
 * Bookshelf: two sides, top, bottom, N fixed shelves, and a Fibracel back that
 * keeps the case from racking. `depth` is the overall depth, back included.
 */
export function generateBookshelf(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const N = p['shelfCount']!;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const Dc = D - tb; // case depth; the back makes up the rest
  const zc = tb / 2; // case center, shifted forward (+z) so the back sits behind it

  const issues: ValidationIssue[] = [];
  const span = W - 2 * t; // shelves rest between the sides
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });

  const freeHeight = H - 2 * t - N * t;
  const gap = freeHeight / (N + 1);
  if (gap < MIN_SHELF_GAP) {
    issues.push({
      paramKey: 'shelfCount',
      message:
        `No caben ${N} entrepaños en ${H} mm de alto: quedarían espacios de ` +
        `${Math.max(0, Math.round(gap))} mm y el mínimo útil es ${MIN_SHELF_GAP} mm. ` +
        `Reduce los entrepaños o aumenta el alto.`,
    });
  }
  if (issues.length > 0) return { ok: false, issues };

  // W ≤ 1200 and H ≤ 2000 by param limits, so the back always fits a 1220 × 2440 Fibracel sheet.
  // Banded edges are the visible ones: every front, plus the sides' top ends; the back hides the rear edges.
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'A1'), qty: 2 },
    { id: 'top', label: 'Tapa', length: span, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    { id: 'bottom', label: 'Base', length: span, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: N },
    { id: 'back', label: 'Fondo', length: H, width: W, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: 1 },
  ];

  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'bottom', instance: 0, position: [0, t / 2, zc], size: [span, t, Dc] },
    { panelId: 'top', instance: 0, position: [0, H - t / 2, zc], size: [span, t, Dc] },
    { panelId: 'back', instance: 0, position: [0, H / 2, -D / 2 + tb / 2], size: [W, H, tb] },
  ];
  for (let i = 1; i <= N; i++) {
    const y = t + i * gap + (i - 1) * t + t / 2;
    placements.push({ panelId: 'shelf', instance: i - 1, position: [0, y, zc], size: [span, t, Dc] });
  }

  const backScrews =
    Math.ceil((2 * (W + H)) / BACK_SCREW_SPACING) + N * Math.ceil(span / BACK_SCREW_SPACING);

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} ` +
        `Marca en los laterales la posición de la base, la tapa y los ${N} entrepaños.`,
      panelRefs: ['side'],
    },
    ...(mode === 'diy' ? [ironStep(['side', 'top', 'bottom', 'shelf'])] : []),
    {
      title: 'Une la base y la tapa',
      description: 'Fija la base y la tapa entre los dos laterales con tornillos confirmat, 2 por lado.',
      panelRefs: ['side', 'top', 'bottom'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0] },
    },
    {
      title: 'Instala los entrepaños',
      description: 'Coloca cada entrepaño en su marca y fíjalo con 2 confirmat por lado.',
      panelRefs: ['shelf'],
      explodeOffsets: { shelf: [0, 0, 200] },
    },
    {
      title: 'Verifica la escuadra',
      description: 'Mide las dos diagonales del frente: deben ser iguales. Ajusta antes de apretar del todo.',
      panelRefs: [],
    },
    {
      title: 'Coloca el fondo',
      description:
        'Con el librero boca abajo y a escuadra, apoya el fondo de fibracel con la cara lisa hacia el frente ' +
        'y atorníllalo cada 20 cm al contorno y a cada entrepaño. El fondo mantiene la escuadra.',
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    },
  ];

  const design: Design = {
    templateId: 'bookshelf',
    params: p,
    panels,
    placements,
    hardware: [
      { type: 'confirmat', size: '5x50', qty: (N + 2) * 4 },
      { type: 'screw', size: '3.5x16', qty: backScrews },
    ],
    fittings: [],
    boring: [],
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const bookshelf: Template = {
  id: 'bookshelf',
  name: 'Librero',
  description: 'Librero con entrepaños fijos y fondo de fibracel, ideal como primer proyecto.',
  params,
  generate: (raw) => generateBookshelf(raw),
};
