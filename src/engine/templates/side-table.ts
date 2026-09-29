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
import { DEFAULT_MATERIAL, MATERIAL_OPTIONS, getStock } from '../stock.ts';
import {
  DEFAULT_EDGE_BANDING,
  EDGE_BANDING_OPTIONS,
  bandEdges,
  edgeBandingMode,
  ironStep,
  prepSentence,
} from '../edge-banding.ts';
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';

const SHELF_CLEARANCE = 100; // lower shelf height off the floor, mm

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 800, step: 10, default: 500 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 250, max: 500, step: 10, default: 350 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 300, max: 900, step: 10, default: 450 },
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

/** Side table: full-width top over two side panels, plus a low shelf for rigidity. */
export function generateSideTable(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const D = p['depth']!;
  const H = p['height']!;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;

  const issues: ValidationIssue[] = [];
  const span = W - 2 * t; // top's unsupported span between the sides
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (issues.length > 0) return { ok: false, issues };

  const sideHeight = H - t; // top rests on the sides

  // A side table is seen from every side: the top is banded all round, the sides and
  // shelf front and back. The sides' ends hide under the top and on the floor.
  const panels: Panel[] = [
    { id: 'top', label: 'Cubierta', length: W, width: D, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'L2', 'A1', 'A2'), qty: 1 },
    { id: 'side', label: 'Lateral', length: sideHeight, width: D, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'L2'), qty: 2 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: D, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'L2'), qty: 1 },
  ];

  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'shelf', instance: 0, position: [0, SHELF_CLEARANCE + t / 2, 0], size: [span, t, D] },
    { panelId: 'top', instance: 0, position: [0, H - t / 2, 0], size: [W, t, D] },
  ];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} ` +
        `Marca en los laterales la posición del entrepaño a ${SHELF_CLEARANCE} mm del piso.`,
      panelRefs: ['side'],
    },
    ...(mode === 'diy' ? [ironStep(['top', 'side', 'shelf'])] : []),
    {
      title: 'Une el entrepaño',
      description: 'Fija el entrepaño entre los dos laterales con 2 tornillos confirmat por lado.',
      panelRefs: ['side', 'shelf'],
      explodeOffsets: { shelf: [0, 0, 200] },
    },
    {
      title: 'Coloca la cubierta',
      description: 'Centra la cubierta sobre los laterales y fíjala desde arriba con 2 confirmat por lado.',
      panelRefs: ['top'],
      explodeOffsets: { top: [0, 150, 0] },
    },
    {
      title: 'Verifica la escuadra',
      description: 'Apoya la mesa en el piso y comprueba que no cojee antes de apretar del todo.',
      panelRefs: [],
    },
  ];

  const design: Design = {
    templateId: 'side-table',
    params: p,
    panels,
    placements,
    hardware: [{ type: 'confirmat', size: '5x50', qty: 8 }],
    fittings: [],
    boring: [],
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const sideTable: Template = {
  id: 'side-table',
  name: 'Mesa auxiliar',
  description: 'Mesa lateral sencilla con entrepaño inferior.',
  params,
  generate: (raw) => generateSideTable(raw),
};
