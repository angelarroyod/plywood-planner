import type { EdgeBandingMode, EdgeBands, EdgeCode, Panel, PlacedPiece, Step, Stock } from './types.ts';

/** Options for a template's "Cubrecanto" select. The value is what the numeric param stores. */
export const EDGE_BANDING_OPTIONS = [
  { value: 0, label: 'Sin cubrecanto' },
  { value: 1, label: 'Lo aplica la maderería' },
  { value: 2, label: 'Lo aplico yo (plancha)' },
];

/** Lo aplica la maderería. */
export const DEFAULT_EDGE_BANDING = 1;

const MODES: EdgeBandingMode[] = ['none', 'yard', 'diy'];

/** Decode the edgeBanding param. Params are validated first, so any other value is a bug. */
export function edgeBandingMode(value: number): EdgeBandingMode {
  const mode = MODES[value];
  if (!mode) throw new Error(`Unknown edge banding value ${value}`);
  return mode;
}

export const NO_EDGES: EdgeBands = { L1: false, L2: false, A1: false, A2: false };

const CODES: EdgeCode[] = ['L1', 'L2', 'A1', 'A2'];

/** The given edges banded — or none at all when the user chose no banding. */
export function bandEdges(mode: EdgeBandingMode, ...codes: EdgeCode[]): EdgeBands {
  if (mode === 'none') return NO_EDGES;
  return {
    L1: codes.includes('L1'),
    L2: codes.includes('L2'),
    A1: codes.includes('A1'),
    A2: codes.includes('A2'),
  };
}

/** Banded edges as parts-list codes, e.g. 'L1 A1'; '—' when none. */
export function edgeCodes(edges: EdgeBands): string {
  return CODES.filter((c) => edges[c]).join(' ') || '—';
}

export const EDGE_TRIM = 30; // mm added per banded edge so it can be trimmed flush

export interface EdgeBandTotal {
  label: string; // Stock.edgeBand.label
  meters: number; // rounded up to 0.1 m
  edges: number; // banded edges, counting every instance
}

/**
 * Band to buy, per band label in first-seen order: Σ (edge length + EDGE_TRIM)
 * over every banded edge of every instance, rounded up to 0.1 m. Banding is
 * 0.45 mm, so it never changes cut sizes.
 */
export function edgeBandTotals(panels: Panel[]): EdgeBandTotal[] {
  const byLabel = new Map<string, { mm: number; edges: number }>();
  for (const panel of panels) {
    const band = panel.stock.edgeBand;
    if (!band || panel.qty === 0) continue;
    let mm = 0;
    let edges = 0;
    for (const code of CODES) {
      if (!panel.edges[code]) continue;
      mm += (code.startsWith('L') ? panel.length : panel.width) + EDGE_TRIM;
      edges += 1;
    }
    if (edges === 0) continue;
    const total = byLabel.get(band.label) ?? { mm: 0, edges: 0 };
    total.mm += mm * panel.qty;
    total.edges += edges * panel.qty;
    byLabel.set(band.label, total);
  }
  return [...byLabel].map(([label, t]) => ({ label, meters: Math.ceil(t.mm / 100) / 10, edges: t.edges }));
}

/** Opening of a template's first step: finish the pieces for their material and banding. */
export function prepSentence(stock: Stock, mode: EdgeBandingMode): string {
  const sentences = [
    stock.material === 'triplay'
      ? 'Lija todas las piezas con grano 180.'
      : 'Limpia las piezas con un trapo húmedo; la melamina no se lija.',
  ];
  if (mode === 'yard') {
    sentences.push('Revisa que la maderería haya enchapado los cantos marcados en la lista de cortes.');
  }
  if (mode === 'none' && stock.material === 'melamina') {
    sentences.push(
      'Sin cubrecanto, los cantos de melamina absorben humedad y se despostillan: séllalos con pintura o barniz.',
    );
  }
  return sentences.join(' ');
}

/** The ironing step for home banding; templates insert it as step 2 and number steps afterwards. */
export function ironStep(panelRefs: string[]): Omit<Step, 'order'> {
  return {
    title: 'Aplica el cubrecanto',
    description:
      'Con la plancha a temperatura media y sin vapor, pasa despacio sobre el cubrecanto pre-engomado ' +
      'en cada canto marcado en la lista de cortes; en cubrecanto de PVC pon una hoja de papel entre la ' +
      'plancha y el cubrecanto. Presiona con un taco de madera mientras se enfría y recorta el sobrante ' +
      'con un cúter, cortando siempre hacia afuera de tu cuerpo.',
    panelRefs,
  };
}

/** Shown under the banding totals: who applies the band. */
export const EDGE_BANDING_NOTE: Record<'yard' | 'diy', string> = {
  yard: 'Lo aplica la maderería en los cantos marcados.',
  diy: 'Lo aplicas tú con plancha (cubrecanto pre-engomado).',
};

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Sheet-space lines for a placed piece's banded edges, inset so a stroke of
 * width 2·inset stays inside the piece. Unrotated pieces have the panel's length
 * along the sheet's y: L1 = left, L2 = right, A1 = top, A2 = bottom. Rotated
 * pieces turn that a quarter: L1 = top, L2 = bottom, A1 = left, A2 = right.
 */
export function bandSegments(piece: PlacedPiece, edges: EdgeBands, inset: number): Segment[] {
  const xl = piece.x; // left edge
  const xr = piece.x + piece.width; // right edge
  const yt = piece.y; // top edge
  const yb = piece.y + piece.length; // bottom edge
  const left = { x1: xl + inset, y1: yt, x2: xl + inset, y2: yb };
  const right = { x1: xr - inset, y1: yt, x2: xr - inset, y2: yb };
  const top = { x1: xl, y1: yt + inset, x2: xr, y2: yt + inset };
  const bottom = { x1: xl, y1: yb - inset, x2: xr, y2: yb - inset };
  const at: Record<EdgeCode, Segment> = piece.rotated
    ? { L1: top, L2: bottom, A1: left, A2: right }
    : { L1: left, L2: right, A1: top, A2: bottom };
  return CODES.filter((c) => edges[c]).map((c) => at[c]);
}
