import { cutTotals } from './cuts.ts';
import { edgeBandTotals, edgeCodes, type EdgeBandTotal } from './edge-banding.ts';
import { hardwareText } from './labels.ts';
import type { Design, EdgeBandingMode, EdgeBands, Hardware, NestingResult, Stock } from './types.ts';

export interface OrderLine {
  n: number; // 1-based, continuous across groups so the yard can say "la 3"
  label: string;
  length: number; // mm, LARGO
  width: number; // mm, ANCHO
  qty: number;
  grain: 'length' | 'width' | null; // null when the stock has no grain or the panel may rotate
  edges: EdgeBands;
}

export interface OrderGroup {
  stock: Stock;
  sheets: number;
  lines: OrderLine[];
}

/** Holes the yard drills in one order line's pieces — every piece of that line alike. */
export interface OrderBoring {
  n: number; // the drilled panel's order line
  label: string;
  qty: number; // pieces drilled alike
  diameter: number; // mm
  depth: number; // mm
  fromEdge: number; // mm, cup center from the hinge-side long edge
  along: number[]; // mm from the piece's top end
}

/** Everything a lumber yard needs to cut, band and drill a design. Derived, never stored. */
export interface Order {
  title: string; // template name
  groups: OrderGroup[]; // one per stock, in layout.byStock order
  cuts: { count: number; meters: number };
  bands: EdgeBandTotal[];
  edgeBanding: EdgeBandingMode;
  hardware: Hardware[];
  boring: OrderBoring[]; // one per drilled panel; empty for most designs
}

/** First-person note to the lumber yard about the band — the order is written by the customer. */
export const ORDER_BAND_NOTE: Record<'yard' | 'diy', string> = {
  yard: 'Por favor enchápenlo en los cantos marcados.',
  diy: 'Solo el material (pre-engomado); yo lo aplico.',
};

/** Said after the drilling lines: the yard drills blank panels, so it needs the face, the pairing and which end is up. */
export const BORING_NOTE =
  'Cazoletas en la cara interior. Si son dos puertas, van en espejo: una con las perforaciones en el canto izquierdo ' +
  'y la otra en el derecho. Marquen ARRIBA en cada puerta: las medidas son desde arriba.';

/** Every hole to drill, counting each piece of a line. */
export function boringHoles(boring: OrderBoring[]): number {
  return boring.reduce((sum, b) => sum + b.qty * b.along.length, 0);
}

export function buildOrder(design: Design, layout: NestingResult, title: string): Order {
  let n = 0;
  const lineOf = new Map<string, number>(); // panel id → its order line
  const groups = layout.byStock.map(({ stock, sheets }) => ({
    stock,
    sheets,
    lines: design.panels
      .filter((p) => p.stock.id === stock.id)
      .map((p) => {
        lineOf.set(p.id, ++n);
        return {
          n,
          label: p.label,
          length: p.length,
          width: p.width,
          qty: p.qty,
          grain: stock.hasGrain && p.grain !== 'any' ? p.grain : null,
          edges: p.edges,
        };
      }),
  }));
  const panelsById = new Map(design.panels.map((p) => [p.id, p]));
  return {
    title,
    groups,
    cuts: cutTotals(layout),
    bands: edgeBandTotals(design.panels),
    edgeBanding: design.edgeBanding,
    hardware: design.hardware,
    boring: design.boring.map((b) => {
      const panel = panelsById.get(b.panelId)!; // templates only bore their own panels
      return {
        n: lineOf.get(b.panelId)!,
        label: panel.label,
        qty: panel.qty,
        diameter: b.diameter,
        depth: b.depth,
        fromEdge: b.fromEdge,
        along: b.along,
      };
    }),
  };
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The order as plain text for WhatsApp or email. Never contains prices: the yard quotes its own. */
export function orderText(order: Order): string {
  const out = [`Pedido para maderería — ${order.title}`, 'Medidas en mm: largo × ancho.'];
  for (const g of order.groups) {
    const { width, length } = g.stock.sheet;
    out.push('', `${g.stock.label} — ${count(g.sheets, 'hoja', 'hojas')} de ${width} × ${length}`);
    for (const l of g.lines) {
      const grain = l.grain === 'length' ? ' — veta a lo largo' : l.grain === 'width' ? ' — veta a lo ancho' : '';
      const codes = edgeCodes(l.edges);
      const band = order.edgeBanding === 'yard' && codes !== '—' ? ` — cubrecanto ${codes}` : '';
      out.push(`${l.n}. ${l.label} — ${l.length} × ${l.width} — ${count(l.qty, 'pza', 'pzas')}${grain}${band}`);
    }
  }
  if (order.boring.length > 0) {
    out.push('');
    for (const b of order.boring) {
      const each = b.qty > 1 ? ' cada una' : '';
      out.push(
        `Barrenado para bisagra de ${b.diameter} mm: pieza ${b.n} (×${b.qty}), ` +
          `${count(b.along.length, 'perforación', 'perforaciones')}${each} a ${b.along.join(' · ')} mm desde arriba, ` +
          `centro a ${b.fromEdge} mm del canto, ${b.depth} mm de profundidad.`,
      );
    }
    out.push(`Total de perforaciones: ${boringHoles(order.boring)}.`);
    out.push(BORING_NOTE);
  }
  out.push('');
  const note = order.edgeBanding === 'none' ? '' : ` ${ORDER_BAND_NOTE[order.edgeBanding]}`;
  for (const b of order.bands) out.push(`${b.label}: ${b.meters.toFixed(1)} m.${note}`);
  out.push(`Cortes: ${order.cuts.count} (${order.cuts.meters.toFixed(1)} m lineales).`);
  if (order.hardware.length > 0) {
    const items = order.hardware.map((h) => `${hardwareText(h)} × ${h.qty}`);
    out.push(`Herrajes: ${items.join(' · ')}`);
  }
  return out.join('\n');
}
