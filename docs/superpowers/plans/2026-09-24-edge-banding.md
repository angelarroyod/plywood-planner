# Phase 4.2 Edge Banding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark which edges of each panel get edge banding (cubrecanto), total the meters per band type, let the user choose none / lumber yard / iron-on, make the first build step fit the material (no sanding advice on melamine), and show all of it in the web and iOS apps.

**Architecture:** Each `Panel` carries `edges: { L1, L2, A1, A2 }` set by its template through `bandEdges(mode, …)`. Each `Stock` names its band (`edgeBand`) and its `material`. A new pure module `src/engine/edge-banding.ts` owns everything shared by both apps:
- the three select options and mode decoding
- the edge codes and the meter totals
- the step copy
- the sheet-space line segments for drawing banded edges

`Design.edgeBanding` carries the decoded mode to views. Banding is 0.45 mm, so cut sizes and nesting do not change.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, React 18 + Tailwind v4 (web), Expo SDK 57 + react-native-svg (iOS).

**Spec:** `docs/superpowers/specs/2026-09-24-edge-banding-design.md`

**Plan refinement over the spec:** the spec put the rotation-aware edge-line mapping in each app's `SheetSvg`. This plan moves it into the engine as `bandSegments(piece, edges, inset)`, so the mapping is written and tested once and both apps draw identical lines. The mapping itself is exactly the spec's.

## Global Constraints

- `src/engine/` stays pure TypeScript: zero imports from React, DOM APIs or three.js.
- UI copy is Spanish (es-MX); code, comments and commit messages are English; conventional commits.
- No new dependencies. No new color tokens: banded-edge lines use `var(--color-piece-label)` on web and `color.plyLabel` on iOS.
- All internal units are millimeters. Banding is 0.45 mm and **never changes cut sizes or nesting**.
- Edge convention: `L1/L2` run along the panel's length, `A1/A2` along its width; templates put the most visible long edge in `L1`.
- Select values: `edgeBanding` 0 = `Sin cubrecanto`, 1 = `Lo aplica la maderería` (default), 2 = `Lo aplico yo (plancha)`.
- Band labels, exactly:

  | Stock | Label |
  |---|---|
  | 1 | `Cubrecanto de chapa de pino 16 mm` |
  | 2 | `Cubrecanto de chapa de pino 19 mm` |
  | 3 | `Cubrecanto de chapa de pino 22 mm` |
  | 4 | `Cubrecanto PVC blanco 19 × 0.45 mm` |
  | 5 | `null` |

  Materials: 1–3 `triplay`, 4 `melamina`, 5 `fibracel`.
- Totals: 30 mm trim per banded edge; meters = `Math.ceil(totalMm / 100) / 10`.
- The iOS app (`mobile/`) uses npm, not pnpm, and imports the engine only through `@/lib/engine`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/edge-banding`.

## File Map

| File | Responsibility | Task |
|---|---|---|
| `src/engine/types.ts` | `EdgeBands`, `EdgeCode`, `EdgeBandingMode`; `Stock.material` / `edgeBand`; `Panel.edges`; `Design.edgeBanding` | 1 |
| `src/engine/stock.ts`, `stock.test.ts` | Material + band per stock | 1 |
| `src/engine/edge-banding.ts` (new), `edge-banding.test.ts` (new) | Options, mode, `bandEdges`, `edgeCodes`, totals, step copy, `bandSegments` | 1 |
| `src/engine/index.ts` | Re-export edge-banding | 1 |
| `src/engine/nesting.test.ts` | Test helper gains `edges` | 1 |
| `src/engine/templates/*.ts` | Placeholder `NO_EDGES` (Task 1) → real banding, param, steps (Task 2) | 1, 2 |
| `src/engine/templates/templates.test.ts` | Banding tests | 2 |
| `scripts/demo.ts` | Banding totals in JSON | 2 |
| `src/components/SheetSvg.tsx`, `CutDiagram.tsx`, `PrintReport.tsx`, `src/App.tsx` | Web display + header copy | 3 |
| `mobile/src/components/sheet-svg.tsx`, `mobile/src/screens/result/cuts.tsx`, `mobile/src/app/index.tsx` | iOS display + copy | 4 |
| `CLAUDE.md` | Conventions + status | 5 |

Every task leaves `pnpm typecheck`, `pnpm test` and (from Task 4) the iOS `tsc` green.

---

### Task 1: Engine banding model

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/stock.ts`, `src/engine/index.ts`, `src/engine/nesting.test.ts`, `src/engine/templates/bookshelf.ts`, `src/engine/templates/side-table.ts`
- Create: `src/engine/edge-banding.ts`, `src/engine/edge-banding.test.ts`
- Test: `src/engine/stock.test.ts`

**Interfaces:**
- Consumes: `Stock`, `Panel`, `PlacedPiece`, `Step`, `getStock` (existing).
- Produces:
  - Types:
    - `interface EdgeBands { L1: boolean; L2: boolean; A1: boolean; A2: boolean }`
    - `type EdgeCode = keyof EdgeBands`
    - `type EdgeBandingMode = 'none' | 'yard' | 'diy'`
  - New fields:
    - `Stock.material: 'triplay' | 'melamina' | 'fibracel'`
    - `Stock.edgeBand: { label: string } | null`
    - `Panel.edges: EdgeBands`
    - `Design.edgeBanding: EdgeBandingMode`
  - From `edge-banding.ts`:
    - `EDGE_BANDING_OPTIONS: { value: number; label: string }[]`
    - `DEFAULT_EDGE_BANDING = 1`
    - `edgeBandingMode(value: number): EdgeBandingMode` (throws on unknown)
    - `NO_EDGES: EdgeBands`
    - `bandEdges(mode: EdgeBandingMode, ...codes: EdgeCode[]): EdgeBands`
    - `edgeCodes(edges: EdgeBands): string`
    - `EDGE_TRIM = 30`
    - `interface EdgeBandTotal { label: string; meters: number; edges: number }`
    - `edgeBandTotals(panels: Panel[]): EdgeBandTotal[]`
    - `prepSentence(stock: Stock, mode: EdgeBandingMode): string`
    - `ironStep(panelRefs: string[]): Omit<Step, 'order'>`
    - `EDGE_BANDING_NOTE: Record<'yard' | 'diy', string>`
    - `interface Segment { x1: number; y1: number; x2: number; y2: number }`
    - `bandSegments(piece: PlacedPiece, edges: EdgeBands, inset: number): Segment[]`

  All of them are re-exported from `src/engine/index.ts`. Templates temporarily set `edges: NO_EDGES` and `edgeBanding: 'none'`; Task 2 replaces that.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/edge-banding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDGE_BANDING,
  EDGE_BANDING_NOTE,
  EDGE_BANDING_OPTIONS,
  EDGE_TRIM,
  NO_EDGES,
  bandEdges,
  bandSegments,
  edgeBandTotals,
  edgeBandingMode,
  edgeCodes,
  ironStep,
  prepSentence,
} from './edge-banding.ts';
import { getStock } from './stock.ts';
import type { Panel, PlacedPiece } from './types.ts';

const PLY18 = getStock(3);
const MELAMINA = getStock(4);
const FIBRACEL = getStock(5);

function panel(over: Partial<Panel> = {}): Panel {
  return {
    id: 'p',
    label: 'P',
    length: 1000,
    width: 300,
    stock: PLY18,
    grain: 'length',
    edges: NO_EDGES,
    qty: 1,
    ...over,
  };
}

describe('edgeBandingMode', () => {
  it('decodes the Cubrecanto select', () => {
    expect(EDGE_BANDING_OPTIONS).toEqual([
      { value: 0, label: 'Sin cubrecanto' },
      { value: 1, label: 'Lo aplica la maderería' },
      { value: 2, label: 'Lo aplico yo (plancha)' },
    ]);
    expect(DEFAULT_EDGE_BANDING).toBe(1);
    expect([0, 1, 2].map((v) => edgeBandingMode(v))).toEqual(['none', 'yard', 'diy']);
  });

  it('throws on any other value', () => {
    expect(() => edgeBandingMode(3)).toThrow(/3/);
  });
});

describe('bandEdges / edgeCodes', () => {
  it('bands the named edges', () => {
    expect(bandEdges('yard', 'L1', 'A1')).toEqual({ L1: true, L2: false, A1: true, A2: false });
    expect(bandEdges('diy', 'L1', 'L2', 'A1', 'A2')).toEqual({ L1: true, L2: true, A1: true, A2: true });
  });

  it('bands nothing when banding is off', () => {
    expect(bandEdges('none', 'L1', 'A1')).toEqual(NO_EDGES);
  });

  it('lists codes in parts-list order', () => {
    expect(edgeCodes({ L1: false, L2: true, A1: true, A2: false })).toBe('L2 A1');
    expect(edgeCodes(bandEdges('yard', 'A2', 'L1'))).toBe('L1 A2');
    expect(edgeCodes(NO_EDGES)).toBe('—');
  });
});

describe('edgeBandTotals', () => {
  it('adds edge lengths plus trim per edge, times quantity, rounded up to 0.1 m', () => {
    // (1000 + 30) + (300 + 30) = 1360 mm per piece × 2 = 2720 mm → 2.8 m
    expect(EDGE_TRIM).toBe(30);
    expect(edgeBandTotals([panel({ edges: bandEdges('yard', 'L1', 'A1'), qty: 2 })])).toEqual([
      { label: 'Cubrecanto de chapa de pino 22 mm', meters: 2.8, edges: 4 },
    ]);
  });

  it('groups by band label in first-seen order', () => {
    const totals = edgeBandTotals([
      panel({ id: 'mel', stock: MELAMINA, edges: bandEdges('yard', 'L1') }), // 1030
      panel({ id: 'ply', edges: bandEdges('yard', 'L1') }), // 1030
      panel({ id: 'mel2', stock: MELAMINA, edges: bandEdges('yard', 'L1', 'L2') }), // 2060
    ]);
    expect(totals).toEqual([
      { label: 'Cubrecanto PVC blanco 19 × 0.45 mm', meters: 3.1, edges: 3 }, // 3090 mm
      { label: 'Cubrecanto de chapa de pino 22 mm', meters: 1.1, edges: 1 }, // 1030 mm
    ]);
  });

  it('skips unbandable stock and panels with no banded edge', () => {
    expect(
      edgeBandTotals([panel({ stock: FIBRACEL, edges: bandEdges('yard', 'L1') }), panel({ edges: NO_EDGES })]),
    ).toEqual([]);
    expect(edgeBandTotals([])).toEqual([]);
  });
});

describe('prepSentence', () => {
  it('sands plywood and reminds that the yard applied the band', () => {
    expect(prepSentence(PLY18, 'yard')).toBe(
      'Lija todas las piezas con grano 180. ' +
        'Revisa que la maderería haya enchapado los cantos marcados en la lista de cortes.',
    );
  });

  it('never sands melamine', () => {
    expect(prepSentence(MELAMINA, 'diy')).toBe('Limpia las piezas con un trapo húmedo; la melamina no se lija.');
  });

  it('warns when melamine edges stay raw', () => {
    expect(prepSentence(MELAMINA, 'none')).toBe(
      'Limpia las piezas con un trapo húmedo; la melamina no se lija. ' +
        'Sin cubrecanto, los cantos de melamina absorben humedad y se despostillan: séllalos con pintura o barniz.',
    );
  });

  it('does not warn about raw plywood edges', () => {
    expect(prepSentence(PLY18, 'none')).toBe('Lija todas las piezas con grano 180.');
  });
});

describe('ironStep / EDGE_BANDING_NOTE', () => {
  it('describes applying pre-glued band with an iron', () => {
    expect(ironStep(['top'])).toEqual({
      title: 'Aplica el cubrecanto',
      description:
        'Con la plancha a temperatura media y sin vapor, pasa despacio sobre el cubrecanto pre-engomado ' +
        'en cada canto marcado en la lista de cortes. Deja enfriar y recorta el sobrante con un cúter.',
      panelRefs: ['top'],
    });
  });

  it('says who applies the band', () => {
    expect(EDGE_BANDING_NOTE).toEqual({
      yard: 'Lo aplica la maderería en los cantos marcados.',
      diy: 'Lo aplicas tú con plancha (cubrecanto pre-engomado).',
    });
  });
});

describe('bandSegments', () => {
  const piece: PlacedPiece = { panelId: 'p', instance: 0, x: 100, y: 200, length: 1000, width: 300, rotated: false };

  it('maps unrotated edges: L down the sides, A across the ends', () => {
    expect(bandSegments(piece, bandEdges('yard', 'L1', 'A2'), 7)).toEqual([
      { x1: 107, y1: 200, x2: 107, y2: 1200 }, // L1 = left
      { x1: 100, y1: 1193, x2: 400, y2: 1193 }, // A2 = bottom
    ]);
  });

  it('turns the mapping a quarter for rotated pieces', () => {
    const rotated: PlacedPiece = { ...piece, length: 300, width: 1000, rotated: true };
    expect(bandSegments(rotated, bandEdges('yard', 'L1', 'A1'), 7)).toEqual([
      { x1: 100, y1: 207, x2: 1100, y2: 207 }, // L1 = top
      { x1: 107, y1: 200, x2: 107, y2: 500 }, // A1 = left
    ]);
  });

  it('returns nothing for an unbanded piece', () => {
    expect(bandSegments(piece, NO_EDGES, 7)).toEqual([]);
  });
});
```

In `src/engine/stock.test.ts`, add inside `describe('stock catalog', …)`:

```ts
  it("knows each board's material and band", () => {
    expect(STOCKS.map((s) => [s.id, s.material, s.edgeBand?.label ?? null])).toEqual([
      [1, 'triplay', 'Cubrecanto de chapa de pino 16 mm'],
      [2, 'triplay', 'Cubrecanto de chapa de pino 19 mm'],
      [3, 'triplay', 'Cubrecanto de chapa de pino 22 mm'],
      [4, 'melamina', 'Cubrecanto PVC blanco 19 × 0.45 mm'],
      [5, 'fibracel', null],
    ]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/engine/edge-banding.test.ts src/engine/stock.test.ts`
Expected: FAIL. `edge-banding.test.ts` can't resolve `./edge-banding.ts`, and the new stock test fails (`material` is undefined).

- [ ] **Step 3: Extend the types (`src/engine/types.ts`)**

Replace the `Stock` interface:

```ts
export interface Stock {
  id: number; // stable; a template's numeric "material" param stores it
  label: string; // Spanish display name, e.g. 'Triplay de pino 18 mm'
  thickness: number; // mm
  hasGrain: boolean; // false → nesting may rotate any panel
  sheet: { length: number; width: number }; // mm; grain runs along length
  maxSpan: number | null; // max unsupported shelf span, mm; null = never a shelf
}
```

with:

```ts
export interface Stock {
  id: number; // stable; a template's numeric "material" param stores it
  label: string; // Spanish display name, e.g. 'Triplay de pino 18 mm'
  material: 'triplay' | 'melamina' | 'fibracel'; // drives finishing copy (sand vs wipe)
  thickness: number; // mm
  hasGrain: boolean; // false → nesting may rotate any panel
  sheet: { length: number; width: number }; // mm; grain runs along length
  maxSpan: number | null; // max unsupported shelf span, mm; null = never a shelf
  edgeBand: { label: string } | null; // the band sold for this board; null = never banded
}
```

Right after the `export type Grain = …;` line, add:

```ts

/**
 * Which edges get edge banding (cubrecanto). L1/L2 run along the panel's
 * length, A1/A2 along its width — the columns of a Mexican parts list.
 * Templates put the most visible long edge in L1 (the front).
 */
export interface EdgeBands {
  L1: boolean;
  L2: boolean;
  A1: boolean;
  A2: boolean;
}

export type EdgeCode = keyof EdgeBands;

/** Who applies the banding: nobody, the lumber yard's edge bander, or the user with an iron. */
export type EdgeBandingMode = 'none' | 'yard' | 'diy';
```

In `Panel`, replace:

```ts
  stock: Stock; // material, thickness and sheet size
  grain: Grain;
  qty: number;
```

with:

```ts
  stock: Stock; // material, thickness and sheet size
  grain: Grain;
  edges: EdgeBands; // banded edges; all false = none
  qty: number;
```

In `Design`, replace:

```ts
  hardware: Hardware[];
  steps: Step[];
}
```

with:

```ts
  hardware: Hardware[];
  steps: Step[];
  edgeBanding: EdgeBandingMode; // decoded from the template's edgeBanding param
}
```

- [ ] **Step 4: Add material and band to the catalog (`src/engine/stock.ts`)**

Replace the `STOCKS` array with:

```ts
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
```

Also add one line to the doc comment above it, so it reads:

```ts
/**
 * Every board the planner can cut. `id` is what a template's "material" param
 * stores (TemplateParams are numeric), so never renumber an entry — append new
 * ones. `maxSpan` values are the shelf-sag tuning knobs. Band widths exceed the
 * board: 16 mm for 12, 19 mm for 15–16, 22 mm for 18.
 */
```

- [ ] **Step 5: Create `src/engine/edge-banding.ts`**

```ts
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
      'en cada canto marcado en la lista de cortes. Deja enfriar y recorta el sobrante con un cúter.',
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
```

- [ ] **Step 6: Re-export it**

In `src/engine/index.ts`, add after `export * from './stock.ts';`:

```ts
export * from './edge-banding.ts';
```

- [ ] **Step 7: Keep existing panel literals compiling**

`src/engine/nesting.test.ts`: import `NO_EDGES` and give the helper panel no banding. Replace:

```ts
function panel(over: Partial<Panel> = {}): Panel {
  return { id: 'p', label: 'P', length: 600, width: 400, stock: PLY18, grain: 'any', qty: 1, ...over };
}
```

with:

```ts
function panel(over: Partial<Panel> = {}): Panel {
  return { id: 'p', label: 'P', length: 600, width: 400, stock: PLY18, grain: 'any', edges: NO_EDGES, qty: 1, ...over };
}
```

and add below the existing `import { getStock } from './stock.ts';` line:

```ts
import { NO_EDGES } from './edge-banding.ts';
```

`src/engine/templates/bookshelf.ts` (Task 2 replaces this file; this keeps it compiling now):
- Add `import { NO_EDGES } from '../edge-banding.ts';` below the `../stock.ts` import.
- Replace the `panels` array with:

```ts
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', edges: NO_EDGES, qty: 2 },
    { id: 'top', label: 'Tapa', length: span, width: Dc, stock, grain: 'length', edges: NO_EDGES, qty: 1 },
    { id: 'bottom', label: 'Base', length: span, width: Dc, stock, grain: 'length', edges: NO_EDGES, qty: 1 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: Dc, stock, grain: 'length', edges: NO_EDGES, qty: N },
    { id: 'back', label: 'Fondo', length: H, width: W, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: 1 },
  ];
```

- In the `design` object, add `edgeBanding: 'none',` on the line after `steps,`.

`src/engine/templates/side-table.ts`:
- Add `import { NO_EDGES } from '../edge-banding.ts';` below the `../stock.ts` import.
- Replace the `panels` array with:

```ts
  const panels: Panel[] = [
    { id: 'top', label: 'Cubierta', length: W, width: D, stock, grain: 'length', edges: NO_EDGES, qty: 1 },
    { id: 'side', label: 'Lateral', length: sideHeight, width: D, stock, grain: 'length', edges: NO_EDGES, qty: 2 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: D, stock, grain: 'length', edges: NO_EDGES, qty: 1 },
  ];
```

- In the `design` object, add `edgeBanding: 'none',` on the line after `steps,`.

- [ ] **Step 8: Run tests and typecheck**

Run: `pnpm test` → all PASS.
Run: `pnpm typecheck` → no errors.
Run (in `mobile/`): `npx tsc --noEmit` → no errors (the new fields are additive).

- [ ] **Step 9: Commit**

```bash
git add src/engine
git commit -m "feat(engine): model edge banding

Stocks name their material and the band sold for them; panels carry
L1/L2/A1/A2 banding flags; designs carry who applies the band. A new
edge-banding module owns the Cubrecanto options, meter totals, finishing
copy and the sheet-space lines both clients draw. Templates band nothing
yet.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Templates band their visible edges

**Files:**
- Modify (full replacement): `src/engine/templates/bookshelf.ts`, `src/engine/templates/side-table.ts`, `scripts/demo.ts`
- Test: `src/engine/templates/templates.test.ts` (add one import and one `describe` block)

**Interfaces:**
- Consumes (Task 1): `DEFAULT_EDGE_BANDING`, `EDGE_BANDING_OPTIONS`, `NO_EDGES`, `bandEdges`, `edgeBandingMode`, `ironStep`, `prepSentence`, `edgeBandTotals`.
- Produces:
  - Both templates gain the param `{ kind: 'select', key: 'edgeBanding', label: 'Cubrecanto', unit: '', options: EDGE_BANDING_OPTIONS, default: DEFAULT_EDGE_BANDING }`, placed after `material`.
  - `design.edgeBanding` is the decoded mode.
  - Panels carry real edges.
  - Step 1 opens with `prepSentence`; `diy` inserts `ironStep` as step 2; steps are numbered `index + 1`.

- [ ] **Step 1: Write the failing tests**

In `src/engine/templates/templates.test.ts`, add below the existing imports:

```ts
import { NO_EDGES, edgeBandTotals } from '../edge-banding.ts';
```

and append at the end of the file:

```ts
describe('edge banding in templates', () => {
  it('defaults to banding applied by the lumber yard', () => {
    expect(designOrThrow(bookshelf).edgeBanding).toBe('yard');
    expect(designOrThrow(sideTable).edgeBanding).toBe('yard');
  });

  it('bands nothing when the user opts out', () => {
    for (const template of [bookshelf, sideTable]) {
      const design = designOrThrow(template, { edgeBanding: 0 });
      expect(design.edgeBanding).toBe('none');
      for (const p of design.panels) expect(p.edges).toEqual(NO_EDGES);
      expect(edgeBandTotals(design.panels)).toEqual([]);
    }
  });

  it('bands the visible edges of the bookshelf', () => {
    const byId = new Map(designOrThrow(bookshelf).panels.map((p) => [p.id, p.edges]));
    expect(byId.get('side')).toEqual({ L1: true, L2: false, A1: true, A2: false }); // front + top end
    for (const id of ['top', 'bottom', 'shelf']) {
      expect(byId.get(id)).toEqual({ L1: true, L2: false, A1: false, A2: false }); // front only
    }
    expect(byId.get('back')).toEqual(NO_EDGES);
  });

  it('bands the visible edges of the side table', () => {
    const byId = new Map(designOrThrow(sideTable).panels.map((p) => [p.id, p.edges]));
    expect(byId.get('top')).toEqual({ L1: true, L2: true, A1: true, A2: true });
    expect(byId.get('side')).toEqual({ L1: true, L2: true, A1: false, A2: false });
    expect(byId.get('shelf')).toEqual({ L1: true, L2: true, A1: false, A2: false });
  });

  it('totals the band at the default sizes', () => {
    // bookshelf: 2·1200 + 2·297 + 5·764 = 6814 mm over 9 edges, + 9·30 = 7084 mm
    expect(edgeBandTotals(designOrThrow(bookshelf).panels)).toEqual([
      { label: 'Cubrecanto de chapa de pino 22 mm', meters: 7.1, edges: 9 },
    ]);
    // side table: 2·500 + 2·350 + 2·2·432 + 2·464 = 4356 mm over 10 edges, + 10·30 = 4656 mm
    expect(edgeBandTotals(designOrThrow(sideTable).panels)).toEqual([
      { label: 'Cubrecanto de chapa de pino 22 mm', meters: 4.7, edges: 10 },
    ]);
  });

  it('adds an ironing step when the user bands at home', () => {
    const shelf = designOrThrow(bookshelf, { edgeBanding: 2 });
    expect(shelf.edgeBanding).toBe('diy');
    expect(shelf.steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shelf.steps[1]).toMatchObject({
      title: 'Aplica el cubrecanto',
      panelRefs: ['side', 'top', 'bottom', 'shelf'],
    });
    expect(shelf.steps.at(-1)).toMatchObject({ order: 6, title: 'Coloca el fondo' });

    const table = designOrThrow(sideTable, { edgeBanding: 2 });
    expect(table.steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
    expect(table.steps[1]).toMatchObject({ title: 'Aplica el cubrecanto', panelRefs: ['top', 'side', 'shelf'] });
  });

  it('opens with finishing advice for the material', () => {
    const plywood = designOrThrow(sideTable, { material: 3 }).steps[0]!.description;
    expect(plywood).toMatch(/^Lija todas las piezas con grano 180\./);

    const melamine = designOrThrow(sideTable, { width: 500, material: 4 }).steps[0]!.description;
    expect(melamine).toMatch(/^Limpia las piezas con un trapo húmedo; la melamina no se lija\./);
    expect(melamine).toContain('Revisa que la maderería haya enchapado');
    expect(melamine).toContain('Marca en los laterales la posición del entrepaño a 100 mm del piso.');

    const shelf = designOrThrow(bookshelf).steps[0]!.description;
    expect(shelf).toContain('Marca en los laterales la posición de la base, la tapa y los 3 entrepaños.');
  });

  it('warns about raw melamine edges', () => {
    const d = designOrThrow(sideTable, { width: 500, material: 4, edgeBanding: 0 });
    expect(d.steps[0]!.description).toContain('séllalos con pintura o barniz');
  });

  it('rejects an unknown banding choice', () => {
    const result = bookshelf.generate({ edgeBanding: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.paramKey).toBe('edgeBanding');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/engine/templates`
Expected: FAIL in the new `edge banding in templates` block (e.g. `edgeBanding` is `'none'` not `'yard'`; edges are all false; there is no ironing step). The existing tests still pass.

- [ ] **Step 3: Replace `src/engine/templates/bookshelf.ts`**

```ts
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
import { DEFAULT_MATERIAL, FIBRACEL_3, MATERIAL_OPTIONS, getStock } from '../stock.ts';
import {
  DEFAULT_EDGE_BANDING,
  EDGE_BANDING_OPTIONS,
  NO_EDGES,
  bandEdges,
  edgeBandingMode,
  ironStep,
  prepSentence,
} from '../edge-banding.ts';
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';

const MIN_SHELF_GAP = 100; // mm of clear space between shelves
const BACK_SCREW_SPACING = 200; // mm between back screws, around the edge and along each shelf

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 1200, step: 10, default: 800 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 400, max: 2000, step: 10, default: 1200 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 200, max: 400, step: 10, default: 300 },
  { kind: 'number', key: 'shelfCount', label: 'Número de entrepaños', unit: '', min: 1, max: 8, step: 1, default: 3 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
  {
    kind: 'select',
    key: 'edgeBanding',
    label: 'Cubrecanto',
    unit: '',
    options: EDGE_BANDING_OPTIONS,
    default: DEFAULT_EDGE_BANDING,
  },
];

/**
 * Bookshelf: two sides, top, bottom, N fixed shelves, and a Fibracel back that
 * keeps the case from racking. `depth` is the overall depth, back included.
 */
export function generateBookshelf(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const N = p['shelfCount']!;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const Dc = D - tb; // case depth; the back makes up the rest
  const zc = tb / 2; // case center, shifted forward (+z) so the back sits behind it

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

  // W ≤ 1200 and H ≤ 2000 by param limits, so the back always fits a 1220 × 2440 Fibracel sheet.
  // Banded edges are the visible ones: every front, plus the sides' top ends; the back hides the rear edges.
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'A1'), qty: 2 },
    { id: 'top', label: 'Tapa', length: span, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    { id: 'bottom', label: 'Base', length: span, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: N },
    { id: 'back', label: 'Fondo', length: H, width: W, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: 1 },
  ];

  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'bottom', instance: 0, position: [0, t / 2, zc], size: [span, t, Dc] },
    { panelId: 'top', instance: 0, position: [0, H - t / 2, zc], size: [span, t, Dc] },
    { panelId: 'back', instance: 0, position: [0, H / 2, -D / 2 + tb / 2], size: [W, H, tb] },
  ];
  for (let i = 1; i <= N; i++) {
    const y = t + i * gap + (i - 1) * t + t / 2;
    placements.push({ panelId: 'shelf', instance: i - 1, position: [0, y, zc], size: [span, t, Dc] });
  }

  const backScrews =
    Math.ceil((2 * (W + H)) / BACK_SCREW_SPACING) + N * Math.ceil(span / BACK_SCREW_SPACING);

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} ` +
        `Marca en los laterales la posición de la base, la tapa y los ${N} entrepaños.`,
      panelRefs: ['side'],
    },
    ...(mode === 'diy' ? [ironStep(['side', 'top', 'bottom', 'shelf'])] : []),
    {
      title: 'Une la base y la tapa',
      description: 'Fija la base y la tapa entre los dos laterales con tornillos confirmat, 2 por lado.',
      panelRefs: ['side', 'top', 'bottom'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0] },
    },
    {
      title: 'Instala los entrepaños',
      description: 'Coloca cada entrepaño en su marca y fíjalo con 2 confirmat por lado.',
      panelRefs: ['shelf'],
      explodeOffsets: { shelf: [0, 0, 200] },
    },
    {
      title: 'Verifica la escuadra',
      description: 'Mide las dos diagonales del frente: deben ser iguales. Ajusta antes de apretar del todo.',
      panelRefs: [],
    },
    {
      title: 'Coloca el fondo',
      description:
        'Con el librero boca abajo y a escuadra, apoya el fondo de fibracel con la cara lisa hacia el frente ' +
        'y atorníllalo cada 20 cm al contorno y a cada entrepaño. El fondo mantiene la escuadra.',
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    },
  ];

  const design: Design = {
    templateId: 'bookshelf',
    params: p,
    panels,
    placements,
    hardware: [
      { type: 'confirmat', size: '5x50', qty: (N + 2) * 4 },
      { type: 'screw', size: '3.5x16', qty: backScrews },
    ],
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const bookshelf: Template = {
  id: 'bookshelf',
  name: 'Librero',
  description: 'Librero con entrepaños fijos y fondo de fibracel, ideal como primer proyecto.',
  params,
  generate: (raw) => generateBookshelf(raw),
};
```

- [ ] **Step 4: Replace `src/engine/templates/side-table.ts`**

```ts
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
import {
  DEFAULT_EDGE_BANDING,
  EDGE_BANDING_OPTIONS,
  bandEdges,
  edgeBandingMode,
  ironStep,
  prepSentence,
} from '../edge-banding.ts';
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';

const SHELF_CLEARANCE = 100; // lower shelf height off the floor, mm

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 800, step: 10, default: 500 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 250, max: 500, step: 10, default: 350 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 300, max: 900, step: 10, default: 450 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
  {
    kind: 'select',
    key: 'edgeBanding',
    label: 'Cubrecanto',
    unit: '',
    options: EDGE_BANDING_OPTIONS,
    default: DEFAULT_EDGE_BANDING,
  },
];

/** Side table: full-width top over two side panels, plus a low shelf for rigidity. */
export function generateSideTable(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const D = p['depth']!;
  const H = p['height']!;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;

  const issues: ValidationIssue[] = [];
  const span = W - 2 * t; // top's unsupported span between the sides
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (issues.length > 0) return { ok: false, issues };

  const sideHeight = H - t; // top rests on the sides

  // A side table is seen from every side: the top is banded all round, the sides and
  // shelf front and back. The sides' ends hide under the top and on the floor.
  const panels: Panel[] = [
    { id: 'top', label: 'Cubierta', length: W, width: D, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'L2', 'A1', 'A2'), qty: 1 },
    { id: 'side', label: 'Lateral', length: sideHeight, width: D, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'L2'), qty: 2 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: D, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'L2'), qty: 1 },
  ];

  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'shelf', instance: 0, position: [0, SHELF_CLEARANCE + t / 2, 0], size: [span, t, D] },
    { panelId: 'top', instance: 0, position: [0, H - t / 2, 0], size: [W, t, D] },
  ];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} ` +
        `Marca en los laterales la posición del entrepaño a ${SHELF_CLEARANCE} mm del piso.`,
      panelRefs: ['side'],
    },
    ...(mode === 'diy' ? [ironStep(['top', 'side', 'shelf'])] : []),
    {
      title: 'Une el entrepaño',
      description: 'Fija el entrepaño entre los dos laterales con 2 tornillos confirmat por lado.',
      panelRefs: ['side', 'shelf'],
      explodeOffsets: { shelf: [0, 0, 200] },
    },
    {
      title: 'Coloca la cubierta',
      description: 'Centra la cubierta sobre los laterales y fíjala desde arriba con 2 confirmat por lado.',
      panelRefs: ['top'],
      explodeOffsets: { top: [0, 150, 0] },
    },
    {
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
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
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
```

- [ ] **Step 5: Replace `scripts/demo.ts`**

```ts
// Dev-only script: prints the default bookshelf cut layout. Run: pnpm demo
// Lives outside src/engine/ so the engine stays free of Node-specific entry points.
import { nest } from '../src/engine/nesting.ts';
import { renderAscii } from '../src/engine/ascii.ts';
import { edgeBandTotals } from '../src/engine/edge-banding.ts';
import { bookshelf } from '../src/engine/templates/bookshelf.ts';

const result = bookshelf.generate({});
if (!result.ok) {
  console.error('Validation failed:', JSON.stringify(result.issues, null, 2));
  throw new Error('default params should always validate');
}

const layout = nest(result.design.panels);
console.log(renderAscii(layout));
console.log(
  JSON.stringify(
    {
      panels: result.design.panels.map(
        (p) => `${p.id} ${p.length}x${p.width}x${p.stock.thickness} ${p.stock.label} x${p.qty}`,
      ),
      byStock: layout.byStock.map((g) => ({
        stock: g.stock.label,
        sheets: g.sheets,
        wastePercent: Number(g.wastePercent.toFixed(1)),
      })),
      edgeBanding: edgeBandTotals(result.design.panels),
    },
    null,
    2,
  ),
);
```

- [ ] **Step 6: Run the tests, the demo and the typecheck**

Run: `pnpm test` → all PASS. The existing "ends with a step that screws on the back" test still sees step 5, because the default mode is `yard`.
Run: `pnpm demo` → the JSON ends with `"edgeBanding": [{ "label": "Cubrecanto de chapa de pino 22 mm", "meters": 7.1, "edges": 9 }]` (pretty-printed). Exit code 0.
Run: `pnpm typecheck` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/templates scripts/demo.ts
git commit -m "feat(engine): band the visible edges in both templates

Both templates gain a Cubrecanto select (none / lumber yard / iron-on,
default lumber yard) and band their visible edges. Step 1 now opens with
finishing advice for the material — no sanding on melamine, a sealing
warning when melamine goes unbanded — and banding at home adds an ironing
step, with steps renumbered after assembly.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Web app

**Files:**
- Modify: `src/components/SheetSvg.tsx`, `src/components/CutDiagram.tsx`, `src/components/PrintReport.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes (Tasks 1–2): `Panel.edges`, `Design.edgeBanding`, `bandSegments`, `NO_EDGES`, `edgeCodes`, `edgeBandTotals`, `EDGE_BANDING_NOTE`, type `EdgeBands`.
- Produces: `SheetSvg` takes a new **required** prop `edges: Record<string, EdgeBands>` (panelId → banded edges).

- [ ] **Step 1: `src/components/SheetSvg.tsx`**

Replace the imports and `Props`:

```tsx
import type { SheetLayout } from '../engine/types.ts';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>; // panelId → Spanish label
  className?: string;
}
```

with:

```tsx
import { NO_EDGES, bandSegments } from '../engine/edge-banding.ts';
import type { EdgeBands, SheetLayout } from '../engine/types.ts';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>; // panelId → Spanish label
  edges: Record<string, EdgeBands>; // panelId → banded edges
  className?: string;
}

const BAND_INSET = 7; // mm; banded edges are 14 mm lines that stay inside the piece
```

Change the signature `export function SheetSvg({ sheet, labels, className }: Props) {` to:

```tsx
export function SheetSvg({ sheet, labels, edges, className }: Props) {
```

Inside the piece `<g>`, right after the piece `<rect … strokeWidth={5} />` and before the first `<text>`, add:

```tsx
          {bandSegments(p, edges[p.panelId] ?? NO_EDGES, BAND_INSET).map((s, i) => (
            <line key={i} {...s} stroke="var(--color-piece-label)" strokeWidth={BAND_INSET * 2} />
          ))}
```

- [ ] **Step 2: `src/components/CutDiagram.tsx`**

Add below the existing `../engine/nesting.ts` import:

```tsx
import { EDGE_BANDING_NOTE, edgeBandTotals, edgeCodes } from '../engine/edge-banding.ts';
```

After the `labels` `useMemo`, add:

```tsx
  const edges = useMemo(
    () => Object.fromEntries(design.panels.map((p) => [p.id, p.edges])),
    [design],
  );
  const bandTotals = edgeBandTotals(design.panels);
  const banded = design.edgeBanding !== 'none';
```

Pass edges to the sheet: `<SheetSvg sheet={sheet} labels={labels} className=…` becomes:

```tsx
                <SheetSvg
                  sheet={sheet}
                  labels={labels}
                  edges={edges}
                  className="h-[30rem] rounded-md border border-rule bg-panel shadow-[3px_3px_0_0_var(--color-rule)]"
                />
```

In the cut-list header row, between the `mm` and `Cant.` headers, add:

```tsx
                    {banded && <th className="pb-1.5 font-medium">Cubrecanto</th>}
```

In each body row, between the dimensions cell and the quantity cell, add:

```tsx
                      {banded && (
                        <td className="py-1.5 pr-2 font-mono text-xs text-ink-soft">{edgeCodes(p.edges)}</td>
                      )}
```

After the closing `</div>` of the **Tornillería** block (and before the **Costo** block), add:

```tsx
            {bandTotals.length > 0 && design.edgeBanding !== 'none' && (
              <div>
                <h3 className="rule-label">Cubrecanto</h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {bandTotals.map((t) => (
                    <li key={t.label} className="flex items-baseline justify-between gap-2">
                      <span>{t.label}</span>
                      <span className="font-mono text-xs tabular-nums text-ply-deep">{t.meters.toFixed(1)} m</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-soft">{EDGE_BANDING_NOTE[design.edgeBanding]}</p>
              </div>
            )}
```

- [ ] **Step 3: `src/components/PrintReport.tsx`**

Add below the existing `../engine/nesting.ts` import:

```tsx
import { EDGE_BANDING_NOTE, edgeBandTotals, edgeCodes } from '../engine/edge-banding.ts';
```

After `const labels = Object.fromEntries(design.panels.map((p) => [p.id, p.label]));`, add:

```tsx
  const edges = Object.fromEntries(design.panels.map((p) => [p.id, p.edges]));
  const bandTotals = edgeBandTotals(design.panels);
  const banded = design.edgeBanding !== 'none';
```

In the cut-list header row, between `<th>Largo × ancho × grosor (mm)</th>` and `<th>Cantidad</th>`, add:

```tsx
            {banded && <th>Cubrecanto</th>}
```

In each body row, between the dimensions cell and the quantity cell, add:

```tsx
              {banded && <td className="font-mono text-xs">{edgeCodes(p.edges)}</td>}
```

Right after the `<p className="mt-3 text-sm">Hojas: …</p>` paragraph, add:

```tsx
      {bandTotals.length > 0 && design.edgeBanding !== 'none' && (
        <>
          <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Cubrecanto</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {bandTotals.map((t) => (
              <li key={t.label}>
                {t.label} — {t.meters.toFixed(1)} m
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-soft">{EDGE_BANDING_NOTE[design.edgeBanding]}</p>
        </>
      )}
```

Change `<SheetSvg sheet={sheet} labels={labels} className="h-[26rem] border border-rule" />` to:

```tsx
            <SheetSvg sheet={sheet} labels={labels} edges={edges} className="h-[26rem] border border-rule" />
```

- [ ] **Step 4: `src/App.tsx`**

Replace the header subtitle text `Muebles de triplay` with `Muebles de triplay y melamina` (the `<p>` element and its classes stay unchanged).

- [ ] **Step 5: Typecheck and test**

Run: `pnpm typecheck` → no errors.
Run: `pnpm test` → all PASS.

- [ ] **Step 6: Check in the browser**

Start the `dev` preview from `.claude/launch.json` (`pnpm dev`, port 5173), open `http://localhost:5173`, and check:

1. **Librero, Medidas:** a `Cubrecanto` field shows three stacked buttons, with `Lo aplica la maderería` highlighted. The header subtitle reads `Muebles de triplay y melamina`.
2. **Plan de corte (defaults):**
   - The cut list has a `Cubrecanto` column: `Lateral` `L1 A1`; `Tapa`, `Base`, `Entrepaño` `L1`; `Fondo` `—`.
   - A `Cubrecanto` block lists `Cubrecanto de chapa de pino 22 mm` `7.1 m` and the note `Lo aplica la maderería en los cantos marcados.`
   - On the plywood sheet, each piece has dark lines on its banded edges. The Fibracel sheet has none.
3. **Sin cubrecanto:** the column and the block disappear, and the sheet pieces show no band lines.
4. **Lo aplico yo (plancha):**
   - The note reads `Lo aplicas tú con plancha (cubrecanto pre-engomado).`
   - **Pasos** has 6 steps, and step 2 is `Aplica el cubrecanto`.
5. **Melamina blanca 16 mm** with Ancho 580:
   - Step 1 starts `Limpia las piezas con un trapo húmedo; la melamina no se lija.`
   - The band label is `Cubrecanto PVC blanco 19 × 0.45 mm`.
6. **Mesa auxiliar (defaults):** the band total is `4.7 m`, and `Cubierta` reads `L1 L2 A1 A2`.
7. **Exportar PDF (print view DOM):** the `Cubrecanto` column and section are present and match the screen.

Check `read_console_messages` for errors; there should be none. Stop the preview when done.

- [ ] **Step 7: Commit**

```bash
git add src/components/SheetSvg.tsx src/components/CutDiagram.tsx src/components/PrintReport.tsx src/App.tsx
git commit -m "feat(ui): show edge banding on web

Cut lists gain a Cubrecanto column with L1/L2/A1/A2 codes, sheets draw
banded edges, and a Cubrecanto block totals the band to buy and says who
applies it — on screen and in the print report. The header no longer
says plywood only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: iOS app

**Files:**
- Modify: `mobile/src/components/sheet-svg.tsx`, `mobile/src/screens/result/cuts.tsx`, `mobile/src/app/index.tsx`

**Interfaces:**
- Consumes (through `@/lib/engine`): `bandSegments`, `NO_EDGES`, `edgeCodes`, `edgeBandTotals`, type `EdgeBands`, `Panel.edges`, `Stock.material`.
- Produces: the iOS `SheetSvg` takes a new **required** prop `edges: Record<string, EdgeBands>`.

- [ ] **Step 1: `mobile/src/components/sheet-svg.tsx`**

Replace:

```tsx
import type { SheetLayout } from '@/lib/engine';
```

with:

```tsx
import { NO_EDGES, bandSegments, type EdgeBands, type SheetLayout } from '@/lib/engine';
```

In `interface Props`, add after `labels: Record<string, string>;`:

```tsx
  /** panelId → banded edges, drawn as dark lines inside the piece. */
  edges: Record<string, EdgeBands>;
```

Below the `Props` interface, add:

```tsx
const BAND_INSET = 7; // mm; banded edges are 14 mm lines that stay inside the piece
```

Change the signature `export function SheetSvg({ sheet, labels, checked, height = 330 }: Props) {` to:

```tsx
export function SheetSvg({ sheet, labels, edges, checked, height = 330 }: Props) {
```

Inside the piece `<G>`, right after the piece `<Rect … strokeWidth={5} />` and before the first `<SvgText>`, add:

```tsx
            {bandSegments(p, edges[p.panelId] ?? NO_EDGES, BAND_INSET).map((s, i) => (
              <Line key={i} {...s} stroke={color.plyLabel} strokeWidth={BAND_INSET * 2} />
            ))}
```

(`Line` is already imported from `react-native-svg`, and `color` from `@/theme`.)

- [ ] **Step 2: `mobile/src/screens/result/cuts.tsx`**

Replace the engine import:

```tsx
import { HARDWARE_LABELS } from '@/lib/engine';
```

with:

```tsx
import { HARDWARE_LABELS, edgeBandTotals, edgeCodes } from '@/lib/engine';
```

After the `labels` `useMemo`, add:

```tsx
  const edges = useMemo(
    () => Object.fromEntries(design!.panels.map((p) => [p.id, p.edges])),
    [design],
  );
```

Replace the whole `shopping` array:

```tsx
  const shopping = [
    ...layout.byStock.map((g) => ({
      name: `${g.stock.label} · ${g.stock.sheet.width} × ${g.stock.sheet.length}`,
      qty: `${g.sheets} hoja${g.sheets > 1 ? 's' : ''}`,
    })),
    ...design!.hardware.map((h) => ({
      name: `${HARDWARE_LABELS[h.type]} ${h.size}`,
      qty: `${h.qty} pzas`,
    })),
    { name: 'Lija grano 180', qty: '2 pliegos' },
  ];
```

with:

```tsx
  const shopping = [
    ...layout.byStock.map((g) => ({
      name: `${g.stock.label} · ${g.stock.sheet.width} × ${g.stock.sheet.length}`,
      qty: `${g.sheets} hoja${g.sheets > 1 ? 's' : ''}`,
    })),
    ...edgeBandTotals(design!.panels).map((t) => ({ name: t.label, qty: `${t.meters.toFixed(1)} m` })),
    ...design!.hardware.map((h) => ({
      name: `${HARDWARE_LABELS[h.type]} ${h.size}`,
      qty: `${h.qty} pzas`,
    })),
    // melamine is wiped, not sanded
    ...(design!.panels.some((p) => p.stock.material === 'triplay')
      ? [{ name: 'Lija grano 180', qty: '2 pliegos' }]
      : []),
  ];
```

Change `<SheetSvg sheet={sheet} labels={labels} checked={checked} />` to:

```tsx
              <SheetSvg sheet={sheet} labels={labels} edges={edges} checked={checked} />
```

In the checklist `allPieces.map((p) => {` callback, after `const isDone = checked.includes(id);`, add:

```tsx
            const band = edges[p.panelId];
            const codes = band ? edgeCodes(band) : '—';
```

and replace the dimensions line:

```tsx
                    {`${p.width} × ${p.length} mm`}
```

with:

```tsx
                    {`${p.width} × ${p.length} mm${codes === '—' ? '' : ` · ${codes}`}`}
```

- [ ] **Step 3: `mobile/src/app/index.tsx`**

Replace `Un mueble de triplay bien planeado, sin cuentas a mano ni desperdicio de más.` with `Un mueble bien planeado, sin cuentas a mano ni desperdicio de más.`

- [ ] **Step 4: Typecheck and export**

Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → the bundle completes (output goes to the gitignored `mobile/dist/`).
Run (repo root): `git status --short mobile` → only the three files above.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/sheet-svg.tsx mobile/src/screens/result/cuts.tsx mobile/src/app/index.tsx
git commit -m "feat(mobile): show edge banding on iOS

Sheets draw banded edges, checklist rows show their L1/L2/A1/A2 codes,
and the shopping list adds meters per band type. Sandpaper is listed
only when the design has plywood, and the landing tagline no longer says
plywood only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs and full verification (no push)

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the conventions and status in CLAUDE.md. Push and PR are done by the controller after the final review.

- [ ] **Step 1: CLAUDE.md**

In "## Engine conventions", replace the line:

```markdown
- Templates must produce panels that always fit a sheet within their param limits; `nest()` throws otherwise.
```

with:

```markdown
- Edge banding: `Panel.edges` flags `L1/L2` (along the length) and `A1/A2` (along the width), the columns of a Mexican parts list. Templates set them for visible edges via `bandEdges(mode, …)`, with L1 the most visible long edge. Banding is 0.45 mm and never changes cut size or nesting. `edgeBandTotals` adds `EDGE_TRIM` (30 mm) per banded edge and rounds up to 0.1 m; stocks with `edgeBand: null` are never banded. Drawing banded edges goes through `bandSegments`, so both clients map rotation the same way.
- Templates must produce panels that always fit a sheet within their param limits; `nest()` throws otherwise.
```

In "## Phase plan and status", on the line starting `  - **4.2 Edge banding**`, replace ` *In progress.*` at the end of the line with ` *Implemented; awaiting user approval.*`.

- [ ] **Step 2: Full verification**

Run: `pnpm test` → all PASS.
Run: `pnpm typecheck` → no errors.
Run: `pnpm demo` → exit code 0; the JSON includes `edgeBanding`.
Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → completes.

If any command fails, don't commit; report the failing command and its output.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record edge banding conventions for Phase 4.2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
