import { HARDWARE_LABELS } from './labels.ts';
import type { Order } from './order.ts';
import type { Hardware } from './types.ts';

/** User-entered prices in MXN. Never a price database — nothing here ships with values. */
export interface Prices {
  sheets: Record<number, number>; // Stock.id → per sheet
  cut: { unit: 'meter' | 'cut'; price: number }; // per meter of cut, or per cut
  bands: Record<string, number>; // band label → per meter
  hardware: Record<string, number>; // hardwareKey → per piece
}

export const EMPTY_PRICES: Prices = { sheets: {}, cut: { unit: 'meter', price: 0 }, bands: {}, hardware: {} };

export function hardwareKey(h: Hardware): string {
  return `${h.type} ${h.size}`;
}

export interface CostLine {
  key: string; // `sheet:{id}` | 'cut' | `band:{label}` | `hw:{hardwareKey}`
  label: string;
  qty: number;
  unit: string; // 'hoja' | 'm' | 'corte' | 'pza'
  price: number | null; // null when missing or ≤ 0
  subtotal: number | null;
}

function line(key: string, label: string, qty: number, unit: string, raw: number | undefined): CostLine {
  const price = raw !== undefined && raw > 0 ? raw : null;
  return { key, label, qty, unit, price, subtotal: price === null ? null : qty * price };
}

/** Prices every line of an order. `total` sums the priced lines; `missing` counts the rest. */
export function orderCost(order: Order, prices: Prices): { lines: CostLine[]; total: number; missing: number } {
  const perMeter = prices.cut.unit === 'meter';
  const lines = [
    ...order.groups.map((g) => line(`sheet:${g.stock.id}`, g.stock.label, g.sheets, 'hoja', prices.sheets[g.stock.id])),
    line('cut', 'Corte', perMeter ? order.cuts.meters : order.cuts.count, perMeter ? 'm' : 'corte', prices.cut.price),
    ...order.bands.map((b) => line(`band:${b.label}`, b.label, b.meters, 'm', prices.bands[b.label])),
    ...order.hardware.map((h) =>
      line(`hw:${hardwareKey(h)}`, `${HARDWARE_LABELS[h.type]} ${h.size}`, h.qty, 'pza', prices.hardware[hardwareKey(h)]),
    ),
  ];
  return {
    lines,
    total: lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0),
    missing: lines.filter((l) => l.price === null).length,
  };
}
