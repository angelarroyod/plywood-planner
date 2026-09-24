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

/** `faltan {n} precios`, or the singular for one. */
export function missingPricesText(n: number): string {
  return n === 1 ? 'falta 1 precio' : `faltan ${n} precios`;
}

function pickFiniteNumbers<K extends string | number>(v: unknown): Record<K, number> {
  const out: Record<string, number> = {};
  if (typeof v === 'object' && v !== null) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
    }
  }
  return out as Record<K, number>;
}

/**
 * A valid `Prices` from whatever `persist` handed back (a hand edit, or a future field
 * the current build doesn't know). Anything malformed falls back to `EMPTY_PRICES`'s shape.
 */
export function normalizePrices(stored: unknown): Prices {
  if (typeof stored !== 'object' || stored === null) return EMPTY_PRICES;
  const s = stored as { sheets?: unknown; cut?: unknown; bands?: unknown; hardware?: unknown };
  const rawCut = typeof s.cut === 'object' && s.cut !== null ? (s.cut as { unit?: unknown; price?: unknown }) : {};
  const unit = rawCut.unit === 'meter' || rawCut.unit === 'cut' ? rawCut.unit : EMPTY_PRICES.cut.unit;
  const price = typeof rawCut.price === 'number' && Number.isFinite(rawCut.price) ? rawCut.price : EMPTY_PRICES.cut.price;
  return {
    sheets: pickFiniteNumbers<number>(s.sheets),
    cut: { unit, price },
    bands: pickFiniteNumbers<string>(s.bands),
    hardware: pickFiniteNumbers<string>(s.hardware),
  };
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
