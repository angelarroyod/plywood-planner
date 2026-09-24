import { cutTotals } from './cuts.ts';
import { edgeBandTotals, edgeCodes, type EdgeBandTotal } from './edge-banding.ts';
import { HARDWARE_LABELS } from './labels.ts';
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

/** Everything a lumber yard needs to cut and band a design. Derived, never stored. */
export interface Order {
  title: string; // template name
  groups: OrderGroup[]; // one per stock, in layout.byStock order
  cuts: { count: number; meters: number };
  bands: EdgeBandTotal[];
  edgeBanding: EdgeBandingMode;
  hardware: Hardware[];
}

/** First-person note to the lumber yard about the band — the order is written by the customer. */
export const ORDER_BAND_NOTE: Record<'yard' | 'diy', string> = {
  yard: 'Por favor enchápenlo en los cantos marcados.',
  diy: 'Solo el material (pre-engomado); yo lo aplico.',
};

export function buildOrder(design: Design, layout: NestingResult, title: string): Order {
  let n = 0;
  const groups = layout.byStock.map(({ stock, sheets }) => ({
    stock,
    sheets,
    lines: design.panels
      .filter((p) => p.stock.id === stock.id)
      .map((p) => ({
        n: ++n,
        label: p.label,
        length: p.length,
        width: p.width,
        qty: p.qty,
        grain: stock.hasGrain && p.grain !== 'any' ? p.grain : null,
        edges: p.edges,
      })),
  }));
  return {
    title,
    groups,
    cuts: cutTotals(layout),
    bands: edgeBandTotals(design.panels),
    edgeBanding: design.edgeBanding,
    hardware: design.hardware,
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
      const band = codes === '—' ? '' : ` — cubrecanto ${codes}`;
      out.push(`${l.n}. ${l.label} — ${l.length} × ${l.width} — ${count(l.qty, 'pza', 'pzas')}${grain}${band}`);
    }
  }
  out.push('');
  const note = order.edgeBanding === 'none' ? '' : ` ${ORDER_BAND_NOTE[order.edgeBanding]}`;
  for (const b of order.bands) out.push(`${b.label}: ${b.meters.toFixed(1)} m.${note}`);
  out.push(`Cortes: ${order.cuts.count} (${order.cuts.meters.toFixed(1)} m lineales).`);
  if (order.hardware.length > 0) {
    const items = order.hardware.map((h) => `${HARDWARE_LABELS[h.type]} ${h.size} × ${h.qty}`);
    out.push(`Herrajes: ${items.join(' · ')}`);
  }
  return out.join('\n');
}
