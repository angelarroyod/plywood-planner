import type { Stock } from './types.ts';

const SHEET = { length: 2440, width: 1220 };

/**
 * Every board the planner can cut. `id` is what a template's "material" param
 * stores (TemplateParams are numeric), so never renumber an entry — append new
 * ones. `maxSpan` values are the shelf-sag tuning knobs. Band widths exceed the
 * board: 16 mm for 12, 19 mm for 15–16, 22 mm for 18.
 */
export const STOCKS: Stock[] = [
  {
    id: 1,
    label: 'Triplay de pino 12 mm',
    material: 'triplay',
    thickness: 12,
    hasGrain: true,
    sheet: SHEET,
    maxSpan: 500,
    edgeBand: { label: 'Cubrecanto de chapa de pino 16 mm' },
  },
  {
    id: 2,
    label: 'Triplay de pino 15 mm',
    material: 'triplay',
    thickness: 15,
    hasGrain: true,
    sheet: SHEET,
    maxSpan: 650,
    edgeBand: { label: 'Cubrecanto de chapa de pino 19 mm' },
  },
  {
    id: 3,
    label: 'Triplay de pino 18 mm',
    material: 'triplay',
    thickness: 18,
    hasGrain: true,
    sheet: SHEET,
    maxSpan: 800,
    edgeBand: { label: 'Cubrecanto de chapa de pino 22 mm' },
  },
  {
    id: 4,
    label: 'Melamina blanca 16 mm',
    material: 'melamina',
    thickness: 16,
    hasGrain: false,
    sheet: SHEET,
    // ponytail: conservative guess for particleboard under books; retune from real feedback
    maxSpan: 550,
    edgeBand: { label: 'Cubrecanto PVC blanco 19 × 0.45 mm' },
  },
  {
    id: 5,
    label: 'Fibracel 3 mm',
    material: 'fibracel',
    thickness: 3,
    hasGrain: false,
    sheet: SHEET,
    maxSpan: null,
    edgeBand: null,
  },
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
