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
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';

const SHELF_CLEARANCE = 100; // lower shelf height off the floor, mm

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 800, step: 10, default: 500 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 250, max: 500, step: 10, default: 350 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 300, max: 900, step: 10, default: 450 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
];

/** Side table: full-width top over two side panels, plus a low shelf for rigidity. */
export function generateSideTable(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the material id
  const W = p['width']!;
  const D = p['depth']!;
  const H = p['height']!;
  const stock = getStock(p['material']!);
  const t = stock.thickness;

  const issues: ValidationIssue[] = [];
  const span = W - 2 * t; // top's unsupported span between the sides
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (issues.length > 0) return { ok: false, issues };

  const sideHeight = H - t; // top rests on the sides

  const panels: Panel[] = [
    { id: 'top', label: 'Cubierta', length: W, width: D, stock, grain: 'length', qty: 1 },
    { id: 'side', label: 'Lateral', length: sideHeight, width: D, stock, grain: 'length', qty: 2 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: D, stock, grain: 'length', qty: 1 },
  ];

  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'shelf', instance: 0, position: [0, SHELF_CLEARANCE + t / 2, 0], size: [span, t, D] },
    { panelId: 'top', instance: 0, position: [0, H - t / 2, 0], size: [W, t, D] },
  ];

  const steps: Step[] = [
    {
      order: 1,
      title: 'Prepara y marca',
      description: `Lija todas las piezas y marca en los laterales la posición del entrepaño a ${SHELF_CLEARANCE} mm del piso.`,
      panelRefs: ['side'],
    },
    {
      order: 2,
      title: 'Une el entrepaño',
      description: 'Fija el entrepaño entre los dos laterales con 2 tornillos confirmat por lado.',
      panelRefs: ['side', 'shelf'],
      explodeOffsets: { shelf: [0, 0, 200] },
    },
    {
      order: 3,
      title: 'Coloca la cubierta',
      description: 'Centra la cubierta sobre los laterales y fíjala desde arriba con 2 confirmat por lado.',
      panelRefs: ['top'],
      explodeOffsets: { top: [0, 150, 0] },
    },
    {
      order: 4,
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
    steps,
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
