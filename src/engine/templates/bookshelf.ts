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

const MIN_SHELF_GAP = 100; // mm of clear space between shelves

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 1200, step: 10, default: 800 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 400, max: 2000, step: 10, default: 1200 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 200, max: 400, step: 10, default: 300 },
  { kind: 'number', key: 'shelfCount', label: 'Número de entrepaños', unit: '', min: 1, max: 8, step: 1, default: 3 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
];

/** Open bookshelf: two sides, top, bottom, N fixed shelves. */
export function generateBookshelf(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the material id
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const N = p['shelfCount']!;
  const stock = getStock(p['material']!);
  const t = stock.thickness;

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

  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: D, stock, grain: 'length', qty: 2 },
    { id: 'top', label: 'Tapa', length: span, width: D, stock, grain: 'length', qty: 1 },
    { id: 'bottom', label: 'Base', length: span, width: D, stock, grain: 'length', qty: 1 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: D, stock, grain: 'length', qty: N },
  ];

  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, 0], size: [t, H, D] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, 0], size: [t, H, D] },
    { panelId: 'bottom', instance: 0, position: [0, t / 2, 0], size: [span, t, D] },
    { panelId: 'top', instance: 0, position: [0, H - t / 2, 0], size: [span, t, D] },
  ];
  for (let i = 1; i <= N; i++) {
    const y = t + i * gap + (i - 1) * t + t / 2;
    placements.push({ panelId: 'shelf', instance: i - 1, position: [0, y, 0], size: [span, t, D] });
  }

  const steps: Step[] = [
    {
      order: 1,
      title: 'Prepara y marca',
      description: `Lija todas las piezas y marca en los laterales la posición de la base, la tapa y los ${N} entrepaños.`,
      panelRefs: ['side'],
    },
    {
      order: 2,
      title: 'Une la base y la tapa',
      description: 'Fija la base y la tapa entre los dos laterales con tornillos confirmat, 2 por lado.',
      panelRefs: ['side', 'top', 'bottom'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0] },
    },
    {
      order: 3,
      title: 'Instala los entrepaños',
      description: 'Coloca cada entrepaño en su marca y fíjalo con 2 confirmat por lado.',
      panelRefs: ['shelf'],
      explodeOffsets: { shelf: [0, 0, 200] },
    },
    {
      order: 4,
      title: 'Verifica la escuadra',
      description: 'Mide las dos diagonales del frente: deben ser iguales. Ajusta antes de apretar del todo.',
      panelRefs: [],
    },
  ];

  const design: Design = {
    templateId: 'bookshelf',
    params: p,
    panels,
    placements,
    hardware: [{ type: 'confirmat', size: '5x50', qty: (N + 2) * 4 }],
    steps,
  };
  return { ok: true, design };
}

export const bookshelf: Template = {
  id: 'bookshelf',
  name: 'Librero',
  description: 'Librero abierto con entrepaños fijos, ideal como primer proyecto.',
  params,
  generate: (raw) => generateBookshelf(raw),
};
