import type { Boring, Fitting, Hardware, Panel, Placement, Step } from '../types.ts';

/** What every building block returns: a design fragment a template merges with its own parts. */
export interface PartSet {
  panels: Panel[];
  placements: Placement[];
  hardware: Hardware[];
  fittings: Fitting[];
  boring: Boring[];
  steps: Omit<Step, 'order'>[];
}

/** One line per distinct item (type, size, cut length) with quantities summed, in first-seen order. */
export function mergeHardware(items: Hardware[]): Hardware[] {
  const byKey = new Map<string, Hardware>();
  for (const h of items) {
    const key = `${h.type} ${h.size} ${h.cutTo ?? ''}`;
    const seen = byKey.get(key);
    byKey.set(key, seen ? { ...seen, qty: seen.qty + h.qty } : { ...h });
  }
  return [...byKey.values()];
}
