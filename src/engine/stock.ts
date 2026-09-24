import type { Stock } from './types.ts';

const SHEET = { length: 2440, width: 1220 };

/**
 * Every board the planner can cut. `id` is what a template's "material" param
 * stores (TemplateParams are numeric), so never renumber an entry — append new
 * ones. `maxSpan` values are the shelf-sag tuning knobs.
 */
export const STOCKS: Stock[] = [
  { id: 1, label: 'Triplay de pino 12 mm', thickness: 12, hasGrain: true, sheet: SHEET, maxSpan: 500 },
  { id: 2, label: 'Triplay de pino 15 mm', thickness: 15, hasGrain: true, sheet: SHEET, maxSpan: 650 },
  { id: 3, label: 'Triplay de pino 18 mm', thickness: 18, hasGrain: true, sheet: SHEET, maxSpan: 800 },
  // ponytail: conservative guess for particleboard under books; retune from real feedback
  { id: 4, label: 'Melamina blanca 16 mm', thickness: 16, hasGrain: false, sheet: SHEET, maxSpan: 550 },
  { id: 5, label: 'Fibracel 3 mm', thickness: 3, hasGrain: false, sheet: SHEET, maxSpan: null },
];

export function getStock(id: number): Stock {
  const stock = STOCKS.find((s) => s.id === id);
  if (!stock) throw new Error(`Unknown stock id ${id}`);
  return stock;
}

/** Back panels. Not a "material" option: it can never carry a shelf. */
export const FIBRACEL_3 = getStock(5);

/** Triplay de pino 18 mm. */
export const DEFAULT_MATERIAL = 3;

/** Options for a template's "Material" select: every stock that can be a shelf, in catalog order. */
export const MATERIAL_OPTIONS = STOCKS.filter((s) => s.maxSpan !== null).map((s) => ({
  value: s.id,
  label: s.label,
}));
