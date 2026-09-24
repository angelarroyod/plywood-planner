# Phase 4.1 Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plywood-only thickness model with a per-panel stock catalog (pine plywood 12/15/18, white melamine 16, Fibracel 3), give the bookshelf a Fibracel back, and price each material separately — in the engine, the web app and the iOS app.

**Architecture:** A `Stock` (material + thickness + sheet size + grain + max span) lives on every `Panel`. Nesting groups by stock and reads the sheet size and grain from it. Templates choose the stock through a numeric `material` select param whose options carry labels. All views derive from `Design` / `NestingResult` as before; nothing is stored.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, React 18 + Tailwind v4 (web), Expo SDK 57 + react-native-svg (iOS).

**Spec:** `docs/superpowers/specs/2026-09-24-materials-design.md`

## Global Constraints

- `src/engine/` stays pure TypeScript: zero imports from React, DOM APIs or three.js.
- UI copy is Spanish (es-MX); code, comments and commit messages are English; conventional commits.
- No new dependencies.
- All internal units are millimeters.
- Stock ids are fixed forever: 1 = Triplay de pino 12 mm, 2 = Triplay de pino 15 mm, 3 = Triplay de pino 18 mm, 4 = Melamina blanca 16 mm, 5 = Fibracel 3 mm. Never renumber; new stocks get new ids at the end.
- Stock labels are exactly: `Triplay de pino 12 mm`, `Triplay de pino 15 mm`, `Triplay de pino 18 mm`, `Melamina blanca 16 mm`, `Fibracel 3 mm`.
- Max spans: 500, 650, 800, 550, `null`. Every sheet is 1220 × 2440 (`{ length: 2440, width: 1220 }`).
- Web styling uses theme tokens only (`bg-panel`, `border-rule`, `text-ink-soft`, `border-cut`, …), never raw `neutral-*` / `amber-*`.
- The iOS app (`mobile/`) uses npm, not pnpm, and imports the engine only through `@/lib/engine`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/materials`.

## File Map

| File | Responsibility | Task |
|---|---|---|
| `src/engine/types.ts` | Data model: `Stock`, `Panel.stock`, labelled select options, `SheetLayout.stock`, `StockSummary`, kerf-only `NestingConfig` | 1, 2 |
| `src/engine/stock.ts` (new) | Stock catalog, `getStock`, `FIBRACEL_3`, `DEFAULT_MATERIAL`, `MATERIAL_OPTIONS` | 1 |
| `src/engine/stock.test.ts` (new) | Catalog tests | 1 |
| `src/engine/index.ts` | Re-export `stock.ts` | 1 |
| `src/engine/nesting.ts` | Group by stock, per-stock sheet size and grain, `byStock`, price-map `estimateCost` | 2 |
| `src/engine/validation.ts` | Labelled select validation, `spanIssue(span, stock)` | 2 |
| `src/engine/ascii.ts`, `scripts/demo.ts` | Dev output per stock | 2 |
| `src/engine/templates/side-table.ts` | `material` param | 2 |
| `src/engine/templates/bookshelf.ts` | `material` param (Task 2), Fibracel back (Task 3) | 2, 3 |
| `src/engine/*.test.ts`, `templates/templates.test.ts` | Updated and new tests | 2, 3 |
| `src/state/store.ts` | `pricesByStock` + `setPrice` | 4 |
| `src/components/ParamForm.tsx` | Vertical labelled select; value badge only for numbers | 4 |
| `src/components/SheetSvg.tsx` | Size from `sheet.stock.sheet`; grain overlay only when `hasGrain` | 4 |
| `src/components/CutDiagram.tsx` | Per-stock captions, waste, price inputs, total | 4 |
| `src/components/PrintReport.tsx` | Per-stock captions and summary, select labels in the param line | 4 |
| `mobile/src/app/measure.tsx` | Vertical labelled select; summary per stock | 5 |
| `mobile/src/components/sheet-svg.tsx` | Size from `sheet.stock.sheet`; grain overlay only when `hasGrain` | 5 |
| `mobile/src/screens/result/stats.tsx` | Waste card per stock | 5 |
| `mobile/src/screens/result/cuts.tsx` | Shopping list and captions per stock | 5 |
| `mobile/src/screens/result/index.tsx` | Header meta shows the material label | 5 |
| `CLAUDE.md` | Engine conventions + phase status | 6 |

**Typecheck note:** after Task 2, `pnpm typecheck` fails only in `src/components/` and `src/state/` (fixed in Task 4), and `npx tsc --noEmit` in `mobile/` fails (fixed in Task 5). Engine tests are the gate for Tasks 2–3.

---

### Task 1: Stock catalog

**Files:**
- Modify: `src/engine/types.ts` (add the `Stock` interface after the header comment)
- Create: `src/engine/stock.ts`
- Create: `src/engine/stock.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Stock { id: number; label: string; thickness: number; hasGrain: boolean; sheet: { length: number; width: number }; maxSpan: number | null }` in `types.ts`
  - `STOCKS: Stock[]`
  - `getStock(id: number): Stock` (throws on unknown id)
  - `FIBRACEL_3: Stock`
  - `DEFAULT_MATERIAL: number` (= 3)
  - `MATERIAL_OPTIONS: { value: number; label: string }[]`

  All are exported from `src/engine/stock.ts` and re-exported from `src/engine/index.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/stock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_MATERIAL, FIBRACEL_3, MATERIAL_OPTIONS, STOCKS, getStock } from './stock.ts';

describe('stock catalog', () => {
  it('has unique ids', () => {
    expect(new Set(STOCKS.map((s) => s.id)).size).toBe(STOCKS.length);
  });

  it('ships every stock on a 1220 × 2440 sheet', () => {
    for (const s of STOCKS) expect(s.sheet).toEqual({ length: 2440, width: 1220 });
  });

  it('looks stocks up by id', () => {
    expect(getStock(3)).toMatchObject({ label: 'Triplay de pino 18 mm', thickness: 18, maxSpan: 800 });
    expect(getStock(4)).toMatchObject({ label: 'Melamina blanca 16 mm', thickness: 16, hasGrain: false, maxSpan: 550 });
  });

  it('throws on unknown ids', () => {
    expect(() => getStock(999)).toThrow(/999/);
  });

  it('offers only shelf-capable stocks as materials, in catalog order', () => {
    expect(MATERIAL_OPTIONS).toEqual([
      { value: 1, label: 'Triplay de pino 12 mm' },
      { value: 2, label: 'Triplay de pino 15 mm' },
      { value: 3, label: 'Triplay de pino 18 mm' },
      { value: 4, label: 'Melamina blanca 16 mm' },
    ]);
  });

  it('defaults to 18 mm plywood and backs with 3 mm Fibracel', () => {
    expect(getStock(DEFAULT_MATERIAL).thickness).toBe(18);
    expect(FIBRACEL_3).toMatchObject({ id: 5, label: 'Fibracel 3 mm', thickness: 3, hasGrain: false, maxSpan: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/engine/stock.test.ts`
Expected: FAIL — `Failed to resolve import "./stock.ts"`.

- [ ] **Step 3: Add the `Stock` type**

In `src/engine/types.ts`, insert right after the three-line header comment (before `export type PlywoodThickness`):

```ts
/**
 * A board the planner can cut: one material at one thickness, sold in one sheet
 * size. The catalog lives in stock.ts.
 */
export interface Stock {
  id: number; // stable; a template's numeric "material" param stores it
  label: string; // Spanish display name, e.g. 'Triplay de pino 18 mm'
  thickness: number; // mm
  hasGrain: boolean; // false → nesting may rotate any panel
  sheet: { length: number; width: number }; // mm; grain runs along length
  maxSpan: number | null; // max unsupported shelf span, mm; null = never a shelf
}
```

- [ ] **Step 4: Write the catalog**

Create `src/engine/stock.ts`:

```ts
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
```

- [ ] **Step 5: Re-export it**

In `src/engine/index.ts`, add after `export * from './labels.ts';`:

```ts
export * from './stock.ts';
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm test` → all PASS (the new file and every existing test).
Run: `pnpm typecheck` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/stock.ts src/engine/stock.test.ts src/engine/index.ts
git commit -m "feat(engine): add stock catalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine uses per-panel stock

**Files:**
- Modify (full replacement): `src/engine/types.ts`, `src/engine/nesting.ts`, `src/engine/validation.ts`, `src/engine/ascii.ts`, `src/engine/templates/side-table.ts`, `src/engine/templates/bookshelf.ts`, `scripts/demo.ts`
- Test (full replacement): `src/engine/nesting.test.ts`, `src/engine/validation.test.ts`, `src/engine/ascii.test.ts`, `src/engine/templates/templates.test.ts`

**Interfaces:**
- Consumes: `Stock`, `getStock`, `FIBRACEL_3`, `DEFAULT_MATERIAL`, `MATERIAL_OPTIONS` (Task 1).
- Produces:
  - `Panel.stock: Stock`, which replaces `Panel.thickness`. `PlywoodThickness` is deleted.
  - `ParamSpec` select `options: { value: number; label: string }[]`
  - `NestingConfig = { kerf: number }`
  - `SheetLayout = { stock: Stock; pieces: PlacedPiece[] }`
  - `StockSummary = { stock: Stock; sheets: number; wastePercent: number }`
  - `NestingResult = { sheets: SheetLayout[]; byStock: StockSummary[] }`. The top-level `wastePercent` is removed.
  - `EngineConfig = { nesting: NestingConfig }`
  - `DEFAULT_CONFIG = { nesting: { kerf: 3 } }`
  - `nest(panels: Panel[], config?: NestingConfig): NestingResult`
  - `estimateCost(result: NestingResult, prices: Record<number, number>): number | null`
  - `spanIssue(span: number, stock: Stock): ValidationIssue | null` (throws when `stock.maxSpan === null`)
  - `renderAscii(result: NestingResult): string` (the `config` argument is removed)
  - `generateBookshelf(raw)` and `generateSideTable(raw)` (the `config` argument is removed)
  - Both templates' param key `thickness` becomes `material`.

- [ ] **Step 1: Write the failing nesting tests**

Replace `src/engine/nesting.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { estimateCost, nest } from './nesting.ts';
import { getStock } from './stock.ts';
import { DEFAULT_CONFIG } from './types.ts';
import type { NestingResult, Panel, PlacedPiece, Stock } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';

const PLY18 = getStock(3);
const PLY12 = getStock(1);
const MELAMINA = getStock(4);
const FIBRACEL = getStock(5);
const SHEET = PLY18.sheet; // 1220 × 2440
const KERF = DEFAULT_CONFIG.nesting.kerf;

function panel(over: Partial<Panel> = {}): Panel {
  return { id: 'p', label: 'P', length: 600, width: 400, stock: PLY18, grain: 'any', qty: 1, ...over };
}

function allPieces(r: NestingResult): PlacedPiece[] {
  return r.sheets.flatMap((s) => s.pieces);
}

/** Gap between two axis-aligned rects along one axis; negative = overlapping ranges. */
function axisGap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(a0 - b1, b0 - a1);
}

function assertNoOverlapWithKerf(r: NestingResult): void {
  for (const sheet of r.sheets) {
    const ps = sheet.pieces;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]!;
        const b = ps[j]!;
        const xGap = axisGap(a.x, a.x + a.width, b.x, b.x + b.width);
        const yGap = axisGap(a.y, a.y + a.length, b.y, b.y + b.length);
        // separated by at least the kerf along at least one axis
        expect(Math.max(xGap, yGap)).toBeGreaterThanOrEqual(KERF);
      }
    }
  }
}

function bookshelfPanels(): Panel[] {
  const result = bookshelf.generate({});
  if (!result.ok) throw new Error('default bookshelf must validate');
  return result.design.panels;
}

describe('nest', () => {
  it('expands qty into individual instances', () => {
    const r = nest([panel({ qty: 3 })]);
    const pieces = allPieces(r);
    expect(pieces).toHaveLength(3);
    expect(pieces.map((p) => p.instance).sort()).toEqual([0, 1, 2]);
  });

  it('keeps every piece inside its sheet', () => {
    const r = nest(bookshelfPanels());
    for (const sheet of r.sheets) {
      for (const p of sheet.pieces) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width).toBeLessThanOrEqual(sheet.stock.sheet.width);
        expect(p.y + p.length).toBeLessThanOrEqual(sheet.stock.sheet.length);
      }
    }
  });

  it('never overlaps pieces and keeps kerf between them', () => {
    const r = nest([
      ...bookshelfPanels(),
      panel({ id: 'extra1', length: 900, width: 350, qty: 3 }),
      panel({ id: 'extra2', length: 400, width: 400, qty: 5 }),
    ]);
    assertNoOverlapWithKerf(r);
  });

  it("respects grain 'length': never rotated, length along sheet length", () => {
    const r = nest([panel({ grain: 'length', length: 2000, width: 300, qty: 4 })]);
    for (const p of allPieces(r)) {
      expect(p.rotated).toBe(false);
      expect(p.length).toBe(2000);
      expect(p.width).toBe(300);
    }
  });

  it("respects grain 'width': always rotated, width along sheet length", () => {
    const r = nest([panel({ grain: 'width', length: 900, width: 300, qty: 3 })]);
    for (const p of allPieces(r)) {
      expect(p.rotated).toBe(true);
      expect(p.length).toBe(300); // panel width lies along sheet length (grain)
      expect(p.width).toBe(900);
    }
  });

  it('ignores grain on stock that has none', () => {
    // 2000 long across a 1220-wide sheet: impossible with plywood grain, fine on melamine
    const tooWide = { grain: 'width' as const, length: 2000, width: 500 };
    expect(() => nest([panel({ ...tooWide, stock: PLY18 })])).toThrow(/does not fit/);
    expect(nest([panel({ ...tooWide, stock: MELAMINA })]).sheets).toHaveLength(1);
  });

  it('applies kerf between pieces and starts new shelves when the row is full', () => {
    // three 600x600 pieces: two fit per row (600+3+600=1203 ≤ 1220), third opens a new shelf
    const r = nest([panel({ id: 'sq', grain: 'length', length: 600, width: 600, qty: 3 })]);
    expect(r.sheets).toHaveLength(1);
    const positions = allPieces(r)
      .map((p) => [p.x, p.y])
      .sort((a, b) => a[1]! - b[1]! || a[0]! - b[0]!);
    expect(positions).toEqual([
      [0, 0],
      [603, 0],
      [0, 603],
    ]);
  });

  it("uses each stock's own sheet size", () => {
    const wide: Stock = { ...PLY18, id: 99, label: 'Prueba 1830', sheet: { length: 2500, width: 1830 } };
    // two 900-wide pieces share one row on an 1830-wide sheet (900+3+900=1803); on 1220 they could not
    const r = nest([panel({ stock: wide, grain: 'length', length: 1000, width: 900, qty: 2 })]);
    expect(r.sheets).toHaveLength(1);
    expect(allPieces(r).map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [903, 0],
    ]);
  });

  it('never mixes stocks on a sheet, thickest stock first', () => {
    const r = nest([
      panel({ id: 'back', stock: FIBRACEL }),
      panel({ id: 'thin', stock: PLY12 }),
      panel({ id: 'thick', stock: PLY18 }),
    ]);
    expect(r.sheets.map((s) => s.stock.id)).toEqual([3, 1, 5]);
    expect(r.byStock.map((g) => g.stock.id)).toEqual([3, 1, 5]);
    const panelFor: Record<number, string> = { 3: 'thick', 1: 'thin', 5: 'back' };
    for (const sheet of r.sheets) {
      for (const p of sheet.pieces) expect(p.panelId).toBe(panelFor[sheet.stock.id]);
    }
  });

  it('spills onto extra sheets when full', () => {
    // 1100x1100 with fixed grain: one per shelf, two shelves per sheet → 5 pieces = 3 sheets
    const r = nest([panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 })]);
    expect(r.sheets).toHaveLength(3);
    expect(r.byStock).toEqual([expect.objectContaining({ sheets: 3 })]);
    assertNoOverlapWithKerf(r);
  });

  it('computes waste per stock', () => {
    const full = { grain: 'length' as const, length: SHEET.length, width: SHEET.width };
    const half = { grain: 'length' as const, length: SHEET.length / 2, width: SHEET.width };

    const r = nest([
      panel({ id: 'full', ...full, stock: PLY18 }),
      panel({ id: 'half', ...half, stock: FIBRACEL }),
    ]);
    expect(r.byStock).toHaveLength(2);
    expect(r.byStock[0]!.wastePercent).toBeCloseTo(0);
    expect(r.byStock[1]!.wastePercent).toBeCloseTo(50);
  });

  it('returns nothing for no panels or zero quantities', () => {
    expect(nest([])).toEqual({ sheets: [], byStock: [] });
    expect(nest([panel({ qty: 0 })])).toEqual({ sheets: [], byStock: [] });
  });

  it('rotates grain-free pieces to fit when needed', () => {
    // 1500 long does not fit across the 1220 width, but fits along the length once rotated
    const r = nest([panel({ id: 'wide', grain: 'any', length: 1500, width: 1000 })]);
    expect(r.sheets).toHaveLength(1);
    assertNoOverlapWithKerf(r);
  });

  it('throws when a panel cannot fit any sheet orientation', () => {
    expect(() => nest([panel({ grain: 'length', length: 2500, width: 300 })])).toThrow(
      /does not fit/,
    );
  });
});

describe('estimateCost', () => {
  // 3 plywood sheets + 1 Fibracel sheet
  const layout = () =>
    nest([
      panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 }),
      panel({ id: 'back', stock: FIBRACEL }),
    ]);

  it('sums sheets × price per stock', () => {
    expect(estimateCost(layout(), { 3: 950, 5: 180 })).toBe(3 * 950 + 180);
  });

  it('returns null until every stock in the layout has a positive price', () => {
    expect(estimateCost(layout(), { 3: 950 })).toBeNull();
    expect(estimateCost(layout(), { 3: 950, 5: 0 })).toBeNull();
    expect(estimateCost(layout(), {})).toBeNull();
  });

  it('ignores prices for stocks not in the layout', () => {
    const plywoodOnly = nest([panel({ id: 'big', grain: 'length', length: 1100, width: 1100, qty: 5 })]);
    expect(estimateCost(plywoodOnly, { 3: 950, 4: 700 })).toBe(2850);
  });
});
```

- [ ] **Step 2: Write the failing validation tests**

Replace `src/engine/validation.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { paramIssues, resolveParams, spanIssue } from './validation.ts';
import { getStock } from './stock.ts';
import { bookshelf } from './templates/bookshelf.ts';

const specs = bookshelf.params;

describe('resolveParams', () => {
  it('fills missing params with defaults', () => {
    const p = resolveParams(specs, { width: 600 });
    expect(p['width']).toBe(600);
    expect(p['height']).toBe(1200);
    expect(p['material']).toBe(3);
  });

  it('drops unknown keys', () => {
    const p = resolveParams(specs, { bogus: 1, thickness: 18 });
    expect(p['bogus']).toBeUndefined();
    expect(p['thickness']).toBeUndefined();
  });
});

describe('paramIssues', () => {
  it('accepts defaults', () => {
    expect(paramIssues(specs, resolveParams(specs, {}))).toEqual([]);
  });

  it('rejects out-of-range number with Spanish message', () => {
    const issues = paramIssues(specs, resolveParams(specs, { width: 5000 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.paramKey).toBe('width');
    expect(issues[0]!.message).toContain('Ancho');
    expect(issues[0]!.message).toContain('entre 300 y 1200 mm');
  });

  it('rejects a material outside the options, listing their labels', () => {
    const issues = paramIssues(specs, resolveParams(specs, { material: 99 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.paramKey).toBe('material');
    expect(issues[0]!.message).toBe(
      '«Material» debe ser uno de: Triplay de pino 12 mm, Triplay de pino 15 mm, ' +
        'Triplay de pino 18 mm, Melamina blanca 16 mm.',
    );
  });

  it('rejects the back-only Fibracel as a material', () => {
    expect(paramIssues(specs, resolveParams(specs, { material: 5 }))).toHaveLength(1);
  });

  it('rejects non-finite values', () => {
    expect(paramIssues(specs, resolveParams(specs, { width: NaN }))).toHaveLength(1);
  });
});

describe('spanIssue', () => {
  it('allows spans at or under the stock limit', () => {
    expect(spanIssue(800, getStock(3))).toBeNull();
    expect(spanIssue(500, getStock(1))).toBeNull();
    expect(spanIssue(550, getStock(4))).toBeNull();
  });

  it('blocks spans over the limit, naming the material', () => {
    const issue = spanIssue(600, getStock(1));
    expect(issue).not.toBeNull();
    expect(issue!.message).toBe(
      'El claro de 600 mm supera el máximo seguro de 500 mm para triplay de pino 12 mm. ' +
        'Reduce el ancho o elige un material más grueso.',
    );
    expect(spanIssue(768, getStock(4))!.message).toContain('melamina blanca 16 mm');
  });

  it('throws for a stock that can never be a shelf', () => {
    expect(() => spanIssue(100, getStock(5))).toThrow(/Fibracel/);
  });
});
```

- [ ] **Step 3: Write the failing template and ascii tests**

Replace `src/engine/templates/templates.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { bookshelf } from './bookshelf.ts';
import { sideTable } from './side-table.ts';
import { nest } from '../nesting.ts';
import type { Design, Template } from '../types.ts';

function designOrThrow(template: Template, params = {}): Design {
  const result = template.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.design;
}

function totalQty(design: Design): number {
  return design.panels.reduce((sum, p) => sum + p.qty, 0);
}

for (const template of [bookshelf, sideTable]) {
  describe(`${template.id} (shared invariants)`, () => {
    const design = designOrThrow(template);

    it('generates with default params', () => {
      expect(design.templateId).toBe(template.id);
      expect(design.panels.length).toBeGreaterThan(0);
      expect(design.steps.length).toBeGreaterThan(0);
      expect(design.hardware.length).toBeGreaterThan(0);
    });

    it('has one placement per panel instance', () => {
      expect(design.placements).toHaveLength(totalQty(design));
      const counts = new Map<string, number>();
      for (const pl of design.placements) {
        counts.set(pl.panelId, (counts.get(pl.panelId) ?? 0) + 1);
      }
      for (const panel of design.panels) {
        expect(counts.get(panel.id)).toBe(panel.qty);
      }
    });

    it('steps and explode offsets reference existing panel ids', () => {
      const ids = new Set(design.panels.map((p) => p.id));
      for (const step of design.steps) {
        for (const ref of step.panelRefs) expect(ids.has(ref)).toBe(true);
        for (const key of Object.keys(step.explodeOffsets ?? {})) expect(ids.has(key)).toBe(true);
      }
    });

    it('is pure: same params, same design', () => {
      expect(template.generate({})).toEqual(template.generate({}));
    });

    it('produces panels that nest without error', () => {
      const layout = nest(design.panels);
      expect(layout.sheets.length).toBeGreaterThanOrEqual(1);
      for (const g of layout.byStock) {
        expect(g.wastePercent).toBeGreaterThanOrEqual(0);
        expect(g.wastePercent).toBeLessThan(100);
      }
    });

    it('uses the chosen material for its panels', () => {
      const melamine = designOrThrow(template, { width: 500, material: 4 }); // span ≤ 550
      expect(melamine.panels.filter((p) => p.id !== 'back').every((p) => p.stock.id === 4)).toBe(true);
    });
  });
}

describe('bookshelf', () => {
  it('builds the expected panel set', () => {
    const design = designOrThrow(bookshelf, { width: 800, height: 1200, depth: 300, shelfCount: 3, material: 3 });
    const byId = new Map(design.panels.map((p) => [p.id, p]));
    expect(byId.get('side')).toMatchObject({ length: 1200, width: 300, qty: 2 });
    expect(byId.get('top')).toMatchObject({ length: 764, width: 300, qty: 1 }); // 800 - 2*18
    expect(byId.get('bottom')).toMatchObject({ length: 764, qty: 1 });
    expect(byId.get('shelf')).toMatchObject({ length: 764, qty: 3 });
    expect(design.hardware[0]).toMatchObject({ type: 'confirmat', qty: 20 }); // (3+2)*4
  });

  it('rejects unsafe shelf spans in Spanish', () => {
    const result = bookshelf.generate({ width: 1200, material: 1 }); // span 1176 > 500
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('width');
      expect(result.issues[0]!.message).toContain('triplay de pino 12 mm');
    }
  });

  it('holds melamine to its shorter span', () => {
    const result = bookshelf.generate({ width: 800, material: 4 }); // span 768 > 550
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('width');
      expect(result.issues[0]!.message).toContain('768 mm');
      expect(result.issues[0]!.message).toContain('melamina blanca 16 mm');
    }
  });

  it('rejects too many shelves for the height', () => {
    const result = bookshelf.generate({ height: 400, shelfCount: 8 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('shelfCount');
    }
  });

  it('rejects out-of-range params before doing structural checks', () => {
    const result = bookshelf.generate({ width: 9999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.paramKey).toBe('width');
    }
  });

  it('spaces shelves evenly between base and top', () => {
    const design = designOrThrow(bookshelf, { height: 1200, shelfCount: 3, material: 3 });
    const ys = design.placements
      .filter((p) => p.panelId === 'shelf')
      .map((p) => p.position[1])
      .sort((a, b) => a - b);
    expect(ys).toHaveLength(3);
    const gaps = [ys[1]! - ys[0]!, ys[2]! - ys[1]!];
    expect(gaps[0]).toBeCloseTo(gaps[1]!);
  });
});

describe('side table', () => {
  it('builds the expected panel set', () => {
    const design = designOrThrow(sideTable, { width: 500, depth: 350, height: 450, material: 3 });
    const byId = new Map(design.panels.map((p) => [p.id, p]));
    expect(byId.get('top')).toMatchObject({ length: 500, width: 350, qty: 1 });
    expect(byId.get('side')).toMatchObject({ length: 432, width: 350, qty: 2 }); // 450 - 18
    expect(byId.get('shelf')).toMatchObject({ length: 464, qty: 1 }); // 500 - 2*18
  });

  it('rejects unsafe top spans', () => {
    const result = sideTable.generate({ width: 800, material: 1 }); // span 776 > 500
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.paramKey).toBe('width');
      expect(result.issues[0]!.message).toContain('triplay de pino 12 mm');
    }
  });
});
```

Replace `src/engine/ascii.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { renderAscii } from './ascii.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';

describe('renderAscii', () => {
  it('renders the default bookshelf layout', () => {
    const result = bookshelf.generate({});
    if (!result.ok) throw new Error('default bookshelf must validate');
    const output = renderAscii(nest(result.design.panels));

    console.log(output); // visual check in test output

    expect(output).toContain('Sheet 1 — Triplay de pino 18 mm (1220x2440mm');
    expect(output).toContain('A = side#0');
    expect(output).toMatch(/Triplay de pino 18 mm: \d+ sheet\(s\), waste \d+\.\d%/);
  });

  it('renders an empty result', () => {
    expect(renderAscii(nest([]))).toBe('Total sheets: 0');
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm test src/engine`
Expected: FAIL in nesting, validation, ascii and templates tests. For example, `p['material']` is undefined, `r.byStock` is undefined, and `spanIssue` messages still say "triplay de 12 mm". `stock.test.ts` still passes.

- [ ] **Step 5: Replace `src/engine/types.ts`**

```ts
// Core data model. All dimensions in millimeters.
// This module (and everything under src/engine/) must stay pure TypeScript:
// no React, DOM, or three.js imports — it ships to React Native unchanged.

/**
 * A board the planner can cut: one material at one thickness, sold in one sheet
 * size. The catalog lives in stock.ts.
 */
export interface Stock {
  id: number; // stable; a template's numeric "material" param stores it
  label: string; // Spanish display name, e.g. 'Triplay de pino 18 mm'
  thickness: number; // mm
  hasGrain: boolean; // false → nesting may rotate any panel
  sheet: { length: number; width: number }; // mm; grain runs along length
  maxSpan: number | null; // max unsupported shelf span, mm; null = never a shelf
}

/**
 * Grain constraint. Sheet grain runs along the sheet's length axis.
 * 'length' → panel's length dim must lie along sheet grain.
 * 'width'  → panel's width dim must lie along sheet grain.
 * 'any'    → nesting may rotate freely.
 * A panel whose stock has no grain always nests as 'any'.
 */
export type Grain = 'length' | 'width' | 'any';

export interface Panel {
  id: string; // stable slug, e.g. 'side-left'
  label: string; // display text, Spanish: 'Lateral izquierdo'
  length: number; // cut rectangle, long dim
  width: number;
  stock: Stock; // material, thickness and sheet size
  grain: Grain;
  qty: number;
}

export interface Hardware {
  type: 'screw' | 'dowel' | 'confirmat';
  size: string; // '4x40', '5x50'
  qty: number;
}

export type Vec3 = [number, number, number]; // mm, x/y/z

/**
 * One physical panel instance in the assembled model, as an axis-aligned box.
 * Assembly space: x = width (left-right), y = height (up), z = depth. Floor at y=0.
 */
export interface Placement {
  panelId: string;
  instance: number; // 0..qty-1
  position: Vec3; // box center
  size: Vec3; // world-oriented dims (permutation of length/width/thickness)
}

export interface Step {
  order: number;
  title: string; // Spanish
  description: string; // Spanish
  panelRefs: string[]; // Panel.id[]
  explodeOffsets?: Record<string, Vec3>; // panelId → offset for exploded highlight
}

export interface Design {
  templateId: string;
  params: TemplateParams;
  panels: Panel[];
  placements: Placement[]; // Σ qty entries
  hardware: Hardware[];
  steps: Step[];
}

// ---- Templates ----

export type TemplateParams = Record<string, number>; // all params numeric

export type ParamSpec =
  | {
      kind: 'number';
      key: string;
      label: string;
      unit: 'mm' | '';
      min: number;
      max: number;
      step: number;
      default: number;
    }
  | {
      kind: 'select';
      key: string;
      label: string;
      unit: 'mm' | '';
      options: { value: number; label: string }[]; // label is shown, value is stored
      default: number;
    };

export interface ValidationIssue {
  paramKey?: string; // undefined → cross-param issue
  message: string; // Spanish, human-readable
}

export type GenerateResult =
  | { ok: true; design: Design }
  | { ok: false; issues: ValidationIssue[] };

export interface Template {
  id: string;
  name: string; // Spanish
  description: string; // Spanish
  params: ParamSpec[];
  generate: (params: TemplateParams) => GenerateResult; // pure
}

// ---- Nesting ----

export interface NestingConfig {
  kerf: number; // 3, between adjacent pieces (not at sheet edges)
}

/** Sheet coords: origin top-left, x along the sheet's width, y along its length. */
export interface PlacedPiece {
  panelId: string;
  instance: number;
  x: number;
  y: number;
  length: number; // as placed, along sheet length axis
  width: number; // as placed, along sheet width axis
  rotated: boolean; // true → panel length lies along sheet width
}

export interface SheetLayout {
  stock: Stock; // one stock per physical sheet; its size comes from the stock
  pieces: PlacedPiece[];
}

export interface StockSummary {
  stock: Stock;
  sheets: number;
  wastePercent: number; // 0–100 over this stock's sheets, kerf counts as waste
}

export interface NestingResult {
  sheets: SheetLayout[]; // grouped by stock, thickest stock first
  byStock: StockSummary[]; // one entry per group, same order
}

// ---- Config ----

export interface EngineConfig {
  nesting: NestingConfig;
}

// Span limits live on each Stock (stock.ts), not here.
export const DEFAULT_CONFIG: EngineConfig = {
  nesting: { kerf: 3 },
};
```

- [ ] **Step 6: Replace `src/engine/nesting.ts`**

```ts
import type {
  NestingConfig,
  NestingResult,
  Panel,
  PlacedPiece,
  SheetLayout,
  Stock,
  StockSummary,
} from './types.ts';
import { DEFAULT_CONFIG } from './types.ts';

// ponytail: FFDH shelf packing — every layout is guillotine-cuttable by
// construction (one rip per shelf, then crosscuts). Swap in a free-rectangle
// guillotine packer if waste % ever becomes a complaint.

type SheetSize = Stock['sheet'];

interface Piece {
  panelId: string;
  instance: number;
  xExtent: number; // along sheet width
  yExtent: number; // along sheet length (grain axis)
  rotated: boolean;
  canRotate: boolean;
}

interface Shelf {
  y: number;
  height: number; // y-extent of the shelf band
  xCursor: number; // right edge of last placed piece
}

interface OpenSheet {
  shelves: Shelf[];
  yCursor: number; // bottom edge of last shelf
  pieces: PlacedPiece[];
}

/** Default orientation per grain. Sheet grain runs along its length (y); grain-free stock nests as 'any'. */
function orient(panel: Panel): Pick<Piece, 'xExtent' | 'yExtent' | 'rotated' | 'canRotate'> {
  const grain = panel.stock.hasGrain ? panel.grain : 'any';
  if (grain === 'width') {
    return { xExtent: panel.length, yExtent: panel.width, rotated: true, canRotate: false };
  }
  return { xExtent: panel.width, yExtent: panel.length, rotated: false, canRotate: grain === 'any' };
}

function place(piece: Piece, x: number, y: number, swapped: boolean): PlacedPiece {
  return {
    panelId: piece.panelId,
    instance: piece.instance,
    x,
    y,
    length: swapped ? piece.xExtent : piece.yExtent,
    width: swapped ? piece.yExtent : piece.xExtent,
    rotated: swapped ? !piece.rotated : piece.rotated,
  };
}

function tryShelf(piece: Piece, shelf: Shelf, size: SheetSize, kerf: number): PlacedPiece | null {
  const x = shelf.xCursor === 0 ? 0 : shelf.xCursor + kerf;
  if (piece.yExtent <= shelf.height && x + piece.xExtent <= size.width) {
    shelf.xCursor = x + piece.xExtent;
    return place(piece, x, shelf.y, false);
  }
  if (piece.canRotate && piece.xExtent <= shelf.height && x + piece.yExtent <= size.width) {
    shelf.xCursor = x + piece.yExtent;
    return place(piece, x, shelf.y, true);
  }
  return null;
}

function placePiece(piece: Piece, sheets: OpenSheet[], size: SheetSize, kerf: number): void {
  for (const sheet of sheets) {
    // first-fit: revisit every open shelf
    for (const shelf of sheet.shelves) {
      const placed = tryShelf(piece, shelf, size, kerf);
      if (placed) {
        sheet.pieces.push(placed);
        return;
      }
    }
    // new shelf on this sheet (pieces arrive sorted by yExtent desc)
    const y = sheet.yCursor === 0 ? 0 : sheet.yCursor + kerf;
    if (y + piece.yExtent <= size.length) {
      const shelf: Shelf = { y, height: piece.yExtent, xCursor: piece.xExtent };
      sheet.shelves.push(shelf);
      sheet.yCursor = y + piece.yExtent;
      sheet.pieces.push(place(piece, 0, y, false));
      return;
    }
  }
  // new sheet
  sheets.push({
    shelves: [{ y: 0, height: piece.yExtent, xCursor: piece.xExtent }],
    yCursor: piece.yExtent,
    pieces: [place(piece, 0, 0, false)],
  });
}

/**
 * Pack panels onto their stock's sheets. Panels of different stock never share
 * a sheet. Throws if a panel cannot fit its sheet in any legal orientation —
 * template param limits must prevent that upstream.
 */
export function nest(panels: Panel[], config: NestingConfig = DEFAULT_CONFIG.nesting): NestingResult {
  const groups = new Map<number, { stock: Stock; pieces: Piece[] }>();

  for (const panel of panels) {
    const size = panel.stock.sheet;
    const o = orient(panel);
    const fitsAsIs = o.xExtent <= size.width && o.yExtent <= size.length;
    const fitsSwapped = o.canRotate && o.yExtent <= size.width && o.xExtent <= size.length;
    if (!fitsAsIs && !fitsSwapped) {
      throw new Error(
        `Panel "${panel.id}" (${panel.length}x${panel.width}mm) does not fit a ` +
          `${size.width}x${size.length}mm ${panel.stock.label} sheet`,
      );
    }
    const base = fitsAsIs
      ? o
      : { xExtent: o.yExtent, yExtent: o.xExtent, rotated: !o.rotated, canRotate: o.canRotate };

    const group = groups.get(panel.stock.id) ?? { stock: panel.stock, pieces: [] };
    for (let i = 0; i < panel.qty; i++) {
      group.pieces.push({ panelId: panel.id, instance: i, ...base });
    }
    groups.set(panel.stock.id, group);
  }

  // Thickest first (the case before its back), ties by id so the order is stable.
  const ordered = [...groups.values()].sort(
    (a, b) => b.stock.thickness - a.stock.thickness || a.stock.id - b.stock.id,
  );

  const sheets: SheetLayout[] = [];
  const byStock: StockSummary[] = [];
  for (const { stock, pieces } of ordered) {
    if (pieces.length === 0) continue; // qty 0 panels buy no sheet
    pieces.sort((a, b) => b.yExtent - a.yExtent || b.xExtent - a.xExtent);
    const open: OpenSheet[] = [];
    for (const piece of pieces) placePiece(piece, open, stock.sheet, config.kerf);

    const pieceArea = open
      .flatMap((s) => s.pieces)
      .reduce((sum, p) => sum + p.length * p.width, 0);
    const sheetArea = stock.sheet.width * stock.sheet.length;
    byStock.push({
      stock,
      sheets: open.length,
      wastePercent: (1 - pieceArea / (open.length * sheetArea)) * 100,
    });
    sheets.push(...open.map((s) => ({ stock, pieces: s.pieces })));
  }

  return { sheets, byStock };
}

/**
 * Sheets × user-entered price per stock (MXN). Null until every stock in the
 * layout has a positive price, so the UI never shows a partial total.
 */
export function estimateCost(result: NestingResult, prices: Record<number, number>): number | null {
  let total = 0;
  for (const { stock, sheets } of result.byStock) {
    const price = prices[stock.id];
    if (!(price && price > 0)) return null;
    total += sheets * price;
  }
  return total;
}
```

- [ ] **Step 7: Replace `src/engine/validation.ts`**

```ts
import type { ParamSpec, Stock, TemplateParams, ValidationIssue } from './types.ts';

/** Merge user params over spec defaults. Unknown keys are dropped. */
export function resolveParams(specs: ParamSpec[], params: TemplateParams): TemplateParams {
  const resolved: TemplateParams = {};
  for (const spec of specs) {
    resolved[spec.key] = params[spec.key] ?? spec.default;
  }
  return resolved;
}

/** Range/option checks for every param. Empty array means all good. */
export function paramIssues(specs: ParamSpec[], params: TemplateParams): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const spec of specs) {
    const value = params[spec.key] ?? spec.default;
    if (spec.kind === 'number') {
      const unit = spec.unit ? ` ${spec.unit}` : '';
      if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
        issues.push({
          paramKey: spec.key,
          message: `«${spec.label}» debe estar entre ${spec.min} y ${spec.max}${unit}.`,
        });
      }
    } else if (!spec.options.some((o) => o.value === value)) {
      issues.push({
        paramKey: spec.key,
        message: `«${spec.label}» debe ser uno de: ${spec.options.map((o) => o.label).join(', ')}.`,
      });
    }
  }
  return issues;
}

/** Max unsupported span check for a horizontal panel. Null when safe. */
export function spanIssue(span: number, stock: Stock): ValidationIssue | null {
  if (stock.maxSpan === null) throw new Error(`${stock.label} can never be a shelf`);
  if (span <= stock.maxSpan) return null;
  return {
    message:
      `El claro de ${span} mm supera el máximo seguro de ${stock.maxSpan} mm ` +
      `para ${stock.label.toLowerCase()}. Reduce el ancho o elige un material más grueso.`,
  };
}
```

- [ ] **Step 8: Replace `src/engine/templates/side-table.ts`**

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
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';

const SHELF_CLEARANCE = 100; // lower shelf height off the floor, mm

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 800, step: 10, default: 500 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 250, max: 500, step: 10, default: 350 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 300, max: 900, step: 10, default: 450 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
];

/** Side table: full-width top over two side panels, plus a low shelf for rigidity. */
export function generateSideTable(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the material id
  const W = p['width']!;
  const D = p['depth']!;
  const H = p['height']!;
  const stock = getStock(p['material']!);
  const t = stock.thickness;

  const issues: ValidationIssue[] = [];
  const span = W - 2 * t; // top's unsupported span between the sides
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (issues.length > 0) return { ok: false, issues };

  const sideHeight = H - t; // top rests on the sides

  const panels: Panel[] = [
    { id: 'top', label: 'Cubierta', length: W, width: D, stock, grain: 'length', qty: 1 },
    { id: 'side', label: 'Lateral', length: sideHeight, width: D, stock, grain: 'length', qty: 2 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: D, stock, grain: 'length', qty: 1 },
  ];

  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, sideHeight / 2, 0], size: [t, sideHeight, D] },
    { panelId: 'shelf', instance: 0, position: [0, SHELF_CLEARANCE + t / 2, 0], size: [span, t, D] },
    { panelId: 'top', instance: 0, position: [0, H - t / 2, 0], size: [W, t, D] },
  ];

  const steps: Step[] = [
    {
      order: 1,
      title: 'Prepara y marca',
      description: `Lija todas las piezas y marca en los laterales la posición del entrepaño a ${SHELF_CLEARANCE} mm del piso.`,
      panelRefs: ['side'],
    },
    {
      order: 2,
      title: 'Une el entrepaño',
      description: 'Fija el entrepaño entre los dos laterales con 2 tornillos confirmat por lado.',
      panelRefs: ['side', 'shelf'],
      explodeOffsets: { shelf: [0, 0, 200] },
    },
    {
      order: 3,
      title: 'Coloca la cubierta',
      description: 'Centra la cubierta sobre los laterales y fíjala desde arriba con 2 confirmat por lado.',
      panelRefs: ['top'],
      explodeOffsets: { top: [0, 150, 0] },
    },
    {
      order: 4,
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
    steps,
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

- [ ] **Step 9: Replace `src/engine/templates/bookshelf.ts` (material only; the back comes in Task 3)**

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
```

- [ ] **Step 10: Replace `src/engine/ascii.ts`**

```ts
import type { NestingResult } from './types.ts';

const SCALE = 40; // mm per character cell

/** Debug/dev view of a nesting result. Pure string builder, safe anywhere. */
export function renderAscii(result: NestingResult): string {
  const lines: string[] = [];

  result.sheets.forEach((sheet, s) => {
    const { width, length } = sheet.stock.sheet;
    const cols = Math.ceil(width / SCALE);
    const rows = Math.ceil(length / SCALE);
    lines.push(
      `Sheet ${s + 1} — ${sheet.stock.label} (${width}x${length}mm, 1 char = ${SCALE}mm)`,
    );
    const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill('.'));
    const legend: string[] = [];
    sheet.pieces.forEach((piece, i) => {
      const ch = String.fromCharCode(65 + (i % 26));
      const x0 = Math.floor(piece.x / SCALE);
      const y0 = Math.floor(piece.y / SCALE);
      const x1 = Math.min(cols, Math.ceil((piece.x + piece.width) / SCALE));
      const y1 = Math.min(rows, Math.ceil((piece.y + piece.length) / SCALE));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) grid[y]![x] = ch;
      }
      legend.push(
        `  ${ch} = ${piece.panelId}#${piece.instance} ` +
          `${piece.width}x${piece.length}mm at (${piece.x}, ${piece.y})` +
          (piece.rotated ? ' (rotated)' : ''),
      );
    });
    lines.push(...grid.map((row) => row.join('')), ...legend, '');
  });

  lines.push(`Total sheets: ${result.sheets.length}`);
  for (const g of result.byStock) {
    lines.push(`  ${g.stock.label}: ${g.sheets} sheet(s), waste ${g.wastePercent.toFixed(1)}%`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 11: Replace `scripts/demo.ts`**

```ts
// Dev-only script: prints the default bookshelf cut layout. Run: pnpm demo
// Lives outside src/engine/ so the engine stays free of Node-specific entry points.
import { nest } from '../src/engine/nesting.ts';
import { renderAscii } from '../src/engine/ascii.ts';
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
    },
    null,
    2,
  ),
);
```

- [ ] **Step 12: Run the engine tests, the demo, and the engine-only typecheck**

Run: `pnpm test` → all PASS.
Run: `pnpm demo` → prints `Sheet 1 — Triplay de pino 18 mm (1220x2440mm, …)`, the grid, and a JSON block with `byStock`. Exit code 0.
Run (Git Bash): `pnpm typecheck 2>&1 | grep "error TS" | grep -v "^src/components/" | grep -v "^src/state/"`
Expected: no output. Errors in `src/components/*` and `src/state/*` are expected until Task 4.

- [ ] **Step 13: Commit**

```bash
git add src/engine scripts/demo.ts
git commit -m "feat(engine): give every panel a stock and nest per stock

Panel.thickness becomes Panel.stock. Nesting groups by stock and takes
sheet size and grain from it, reporting waste per stock. estimateCost
takes a price per stock and returns null until all are set. Span limits
move onto the stock, and both templates swap the thickness select for a
labelled Material select.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Bookshelf Fibracel back

**Files:**
- Modify (full replacement): `src/engine/templates/bookshelf.ts`
- Test: `src/engine/templates/templates.test.ts` (replace the `bookshelf › builds the expected panel set` test and add four tests)

**Interfaces:**
- Consumes: `FIBRACEL_3`, `getStock`, `MATERIAL_OPTIONS`, `DEFAULT_MATERIAL` (Task 1); `spanIssue(span, stock)`, `Panel.stock` (Task 2).
- Produces: bookshelf designs with a `back` panel (`label: 'Fondo'`, Fibracel 3 mm, `length: H`, `width: W`, `grain: 'any'`, qty 1), case panels of width `D − 3`, a second hardware line `{ type: 'screw', size: '3.5x16', qty }`, and step 5 `Coloca el fondo`.

- [ ] **Step 1: Write the failing tests**

In `src/engine/templates/templates.test.ts`, add this import below the existing imports:

```ts
import { FIBRACEL_3 } from '../stock.ts';
```

Replace the whole `it('builds the expected panel set', …)` inside `describe('bookshelf', …)` with:

```ts
  it('builds the expected panel set', () => {
    const design = designOrThrow(bookshelf, { width: 800, height: 1200, depth: 300, shelfCount: 3, material: 3 });
    const byId = new Map(design.panels.map((p) => [p.id, p]));
    expect(byId.get('side')).toMatchObject({ length: 1200, width: 297, qty: 2 }); // 300 - 3 mm back
    expect(byId.get('top')).toMatchObject({ length: 764, width: 297, qty: 1 }); // 800 - 2*18
    expect(byId.get('bottom')).toMatchObject({ length: 764, width: 297, qty: 1 });
    expect(byId.get('shelf')).toMatchObject({ length: 764, width: 297, qty: 3 });
    expect(byId.get('back')).toMatchObject({ label: 'Fondo', length: 1200, width: 800, grain: 'any', qty: 1 });
    expect(byId.get('back')!.stock).toBe(FIBRACEL_3);
    for (const id of ['side', 'top', 'bottom', 'shelf']) expect(byId.get(id)!.stock.id).toBe(3);
    expect(design.hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 20 }, // (3+2)*4
      { type: 'screw', size: '3.5x16', qty: 32 }, // ⌈2·(800+1200)/200⌉ + 3·⌈764/200⌉ = 20 + 12
    ]);
  });

  it('keeps the overall depth, with the back behind a shallower case', () => {
    const D = 300;
    const design = designOrThrow(bookshelf, { depth: D });
    const zMin = Math.min(...design.placements.map((p) => p.position[2] - p.size[2] / 2));
    const zMax = Math.max(...design.placements.map((p) => p.position[2] + p.size[2] / 2));
    expect(zMin).toBeCloseTo(-D / 2);
    expect(zMax).toBeCloseTo(D / 2);

    const back = design.placements.find((p) => p.panelId === 'back')!;
    expect(back.size).toEqual([800, 1200, 3]);
    expect(back.position[2] - back.size[2] / 2).toBeCloseTo(-D / 2); // rear is −z; camera looks from +z
  });

  it('ends with a step that screws on the back', () => {
    const design = designOrThrow(bookshelf);
    expect(design.steps.at(-1)).toMatchObject({
      order: 5,
      title: 'Coloca el fondo',
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    });
  });

  it('nests the back on its own Fibracel sheet', () => {
    const layout = nest(designOrThrow(bookshelf).panels);
    expect(layout.byStock.map((g) => g.stock.id)).toEqual([3, 5]);
    expect(layout.byStock[1]!.sheets).toBe(1);
  });
```

Inside `describe('side table', …)`, add:

```ts
  it('has no back panel', () => {
    const design = designOrThrow(sideTable);
    expect(design.panels.some((p) => p.id === 'back')).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/engine/templates`
Expected: FAIL in `builds the expected panel set` (side width 300 ≠ 297), `keeps the overall depth…`, `ends with a step…` and `nests the back…`. `has no back panel` passes.

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
import { paramIssues, resolveParams, spanIssue } from '../validation.ts';

const MIN_SHELF_GAP = 100; // mm of clear space between shelves
const BACK_SCREW_SPACING = 200; // mm between back screws, around the edge and along each shelf

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 300, max: 1200, step: 10, default: 800 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 400, max: 2000, step: 10, default: 1200 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 200, max: 400, step: 10, default: 300 },
  { kind: 'number', key: 'shelfCount', label: 'Número de entrepaños', unit: '', min: 1, max: 8, step: 1, default: 3 },
  { kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL },
];

/**
 * Bookshelf: two sides, top, bottom, N fixed shelves, and a Fibracel back that
 * keeps the case from racking. `depth` is the overall depth, back included.
 */
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
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', qty: 2 },
    { id: 'top', label: 'Tapa', length: span, width: Dc, stock, grain: 'length', qty: 1 },
    { id: 'bottom', label: 'Base', length: span, width: Dc, stock, grain: 'length', qty: 1 },
    { id: 'shelf', label: 'Entrepaño', length: span, width: Dc, stock, grain: 'length', qty: N },
    { id: 'back', label: 'Fondo', length: H, width: W, stock: FIBRACEL_3, grain: 'any', qty: 1 },
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
    {
      order: 5,
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
    steps,
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test` → all PASS.
Run: `pnpm demo` → output shows `Sheet 2 — Fibracel 3 mm` (or a later sheet number) with `back#0`, and `byStock` has two entries.

- [ ] **Step 5: Commit**

```bash
git add src/engine/templates/bookshelf.ts src/engine/templates/templates.test.ts
git commit -m "feat(engine): add a Fibracel back to the bookshelf

The back panel stops the case racking. Case pieces lose 3 mm of depth so
the overall depth stays what the user entered; the back is screwed on
every 200 mm in a new final step.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Web app

**Files:**
- Modify (full replacement): `src/state/store.ts`, `src/components/SheetSvg.tsx`, `src/components/CutDiagram.tsx`, `src/components/PrintReport.tsx`
- Modify: `src/components/ParamForm.tsx` (two blocks inside `Field`)

**Interfaces:**
- Consumes:
  - `nest(panels): NestingResult` with `sheets[].stock` and `byStock[]`
  - `estimateCost(result, prices): number | null`
  - `Panel.stock`
  - `ParamSpec` select `options: { value; label }[]` (all from Task 2)
- Produces:
  - Store: `pricesByStock: Record<number, number>` and `setPrice(stockId: number, price: number)`, which replace `pricePerSheet` and `setPricePerSheet`.
  - `SheetSvg` props: `{ sheet, labels, className? }`. The `config` prop is removed.

- [ ] **Step 1: Replace `src/state/store.ts`**

```ts
import { create } from 'zustand';
import type { TemplateParams } from '../engine/types.ts';
import { templates } from '../engine/index.ts';

export type View = 'design' | 'cuts' | 'steps';

interface AppState {
  templateId: string;
  paramsByTemplate: Record<string, TemplateParams>; // sparse: only user-touched keys
  exploded: boolean;
  view: View;
  activeStep: number | null; // Step.order, null = no highlight
  pricesByStock: Record<number, number>; // MXN per sheet, keyed by Stock.id; missing = not set
  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  toggleExploded: () => void;
  setView: (view: View) => void;
  setActiveStep: (order: number | null) => void;
  setPrice: (stockId: number, price: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  templateId: templates[0]!.id,
  paramsByTemplate: {},
  exploded: false,
  view: 'design',
  activeStep: null,
  pricesByStock: {},
  setTemplate: (id) => set({ templateId: id, activeStep: null }),
  setParam: (key, value) =>
    set((s) => ({
      paramsByTemplate: {
        ...s.paramsByTemplate,
        [s.templateId]: { ...s.paramsByTemplate[s.templateId], [key]: value },
      },
    })),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded })),
  setView: (view) => set({ view }),
  setActiveStep: (order) => set({ activeStep: order }),
  setPrice: (stockId, price) =>
    set((s) => ({ pricesByStock: { ...s.pricesByStock, [stockId]: Math.max(0, price) } })),
}));
```

Note: PR #2 (`feat/theme-toggle`) also edits this file by adding theme state. Whichever PR merges second keeps both changes.

- [ ] **Step 2: Update `src/components/ParamForm.tsx`**

Inside `Field`, replace the value badge:

```tsx
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums ${
            hasError
              ? 'border-cut/40 bg-cut-tint text-cut'
              : 'border-rule bg-raised text-ply'
          }`}
        >
          {value}
          {spec.unit && <span className="text-ink-faint"> {spec.unit}</span>}
        </span>
```

with (selects already show the choice in their highlighted option):

```tsx
        {spec.kind === 'number' && (
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums ${
              hasError
                ? 'border-cut/40 bg-cut-tint text-cut'
                : 'border-rule bg-raised text-ply'
            }`}
          >
            {value}
            {spec.unit && <span className="text-ink-faint"> {spec.unit}</span>}
          </span>
        )}
```

Then replace the select branch:

```tsx
        <div className="mt-2 flex gap-1.5">
          {spec.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              aria-pressed={opt === value}
              className={`flex-1 rounded border py-1.5 font-mono text-xs tabular-nums transition-colors ${
                opt === value
                  ? 'border-cut bg-cut text-white'
                  : 'border-rule bg-panel text-ink-soft hover:border-ink-soft hover:text-ink'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
```

with:

```tsx
        <div className="mt-2 flex flex-col gap-1.5" role="group" aria-label={spec.label}>
          {spec.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={opt.value === value}
              className={`rounded border px-3 py-1.5 text-left text-xs transition-colors ${
                opt.value === value
                  ? 'border-cut bg-cut text-white'
                  : 'border-rule bg-panel text-ink-soft hover:border-ink-soft hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
```

- [ ] **Step 3: Replace `src/components/SheetSvg.tsx`**

```tsx
import type { SheetLayout } from '../engine/types.ts';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>; // panelId → Spanish label
  className?: string;
}

const MONO = 'Roboto Mono, ui-monospace, monospace';

/** One sheet as SVG, 1 SVG unit = 1 mm, sized by its stock. Shared by screen view and print report. */
export function SheetSvg({ sheet, labels, className }: Props) {
  const { width: w, length: h } = sheet.stock.sheet;
  const tick = 90; // corner registration mark length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={`Plan de corte — ${sheet.stock.label}`}>
      <defs>
        {/* ponytail: fixed id — several sheets render per page but the pattern is identical */}
        <pattern id="ply-grain" width="26" height="26" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="26" stroke="var(--color-grain)" strokeWidth="2.5" />
        </pattern>
      </defs>

      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="var(--color-sheet)"
        stroke="var(--color-sheet-edge)"
        strokeWidth={6}
      />

      {sheet.pieces.map((p) => (
        <g key={`${p.panelId}-${p.instance}`}>
          <rect
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.length}
            fill="var(--color-piece)"
            stroke="var(--color-piece-edge)"
            strokeWidth={5}
          />
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 - 10}
            fontSize={42}
            fontFamily={MONO}
            fontWeight={600}
            textAnchor="middle"
            fill="var(--color-piece-label)"
          >
            {labels[p.panelId] ?? p.panelId} #{p.instance + 1}
          </text>
          <text
            x={p.x + p.width / 2}
            y={p.y + p.length / 2 + 40}
            fontSize={34}
            fontFamily={MONO}
            textAnchor="middle"
            fill="var(--color-piece-dims)"
          >
            {p.width} × {p.length}
          </text>
        </g>
      ))}

      {/* Grain runs the full sheet length and does not stop at cut lines. Grain-free boards get none. */}
      {sheet.stock.hasGrain && (
        <rect x={0} y={0} width={w} height={h} fill="url(#ply-grain)" opacity={0.14} />
      )}

      {[
        [0, 0, 1, 1],
        [w, 0, -1, 1],
        [0, h, 1, -1],
        [w, h, -1, -1],
      ].map(([x, y, sx, sy], i) => (
        <path
          key={i}
          d={`M ${x! + sx! * tick} ${y} H ${x} V ${y! + sy! * tick}`}
          stroke="var(--color-mark)"
          strokeWidth={7}
          fill="none"
        />
      ))}

      {sheet.stock.hasGrain && (
        <text
          x={26}
          y={h / 2}
          fontSize={40}
          fontFamily={MONO}
          fill="var(--color-ink-faint)"
          letterSpacing={10}
          textAnchor="middle"
          transform={`rotate(-90 26 ${h / 2})`}
        >
          ↑ VETA
        </text>
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Replace `src/components/CutDiagram.tsx`**

```tsx
import { useMemo, type ReactNode } from 'react';
import { estimateCost, nest } from '../engine/nesting.ts';
import { DEFAULT_CONFIG } from '../engine/types.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { SheetSvg } from './SheetSvg.tsx';
import { HARDWARE_LABELS } from './labels.ts';

export function CutDiagram({ design }: { design: Design }) {
  const layout = useMemo(() => nest(design.panels), [design]);
  const prices = useAppStore((s) => s.pricesByStock);
  const setPrice = useAppStore((s) => s.setPrice);
  const cost = estimateCost(layout, prices);
  const labels = useMemo(
    () => Object.fromEntries(design.panels.map((p) => [p.id, p.label])),
    [design],
  );

  return (
    <div className="h-full overflow-y-auto bg-panel px-8 py-7">
      <div className="mx-auto max-w-[1400px]">
        <header>
          <h2 className="display text-2xl font-extrabold">Plan de corte</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Medidas en mm · sierra {DEFAULT_CONFIG.nesting.kerf} mm
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Stat
              label="Hojas"
              value={String(layout.sheets.length)}
              unit={layout.byStock.length === 1 ? layout.byStock[0]!.stock.label : `${layout.byStock.length} materiales`}
            />
            {layout.byStock.map((g) => (
              <Stat
                key={g.stock.id}
                label="Desperdicio"
                value={`${g.wastePercent.toFixed(1)}%`}
                unit={g.stock.label}
              >
                <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-rule">
                  <span
                    className="block h-full rounded-full bg-cut"
                    style={{ width: `${Math.min(100, g.wastePercent)}%` }}
                  />
                </span>
              </Stat>
            ))}
            <Stat
              label="Costo material"
              value={cost === null ? '—' : `$${cost.toFixed(0)}`}
              unit={cost === null ? 'define precios' : 'MXN estimado'}
            />
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-start gap-10">
          <section className="flex flex-wrap gap-6">
            {layout.sheets.map((sheet, i) => (
              <figure key={i}>
                <SheetSvg
                  sheet={sheet}
                  labels={labels}
                  className="h-[30rem] rounded-md border border-rule bg-panel shadow-[3px_3px_0_0_var(--color-rule)]"
                />
                <figcaption className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  Hoja {i + 1} — {sheet.stock.label}
                  {sheet.stock.hasGrain ? ' · veta a lo largo' : ''}
                </figcaption>
              </figure>
            ))}
          </section>

          <section className="w-80 shrink-0 space-y-8">
            <div>
              <h3 className="rule-label">Lista de cortes</h3>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                    <th className="pb-1.5 font-medium">Pieza</th>
                    <th className="pb-1.5 font-medium">mm</th>
                    <th className="pb-1.5 text-right font-medium">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {design.panels.map((p) => (
                    <tr key={p.id} className="border-b border-rule/70">
                      <td className="py-1.5 pr-2">{p.label}</td>
                      <td className="py-1.5 font-mono text-xs tabular-nums text-ink-soft">
                        {p.length} × {p.width} × {p.stock.thickness}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs tabular-nums">{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="rule-label">Tornillería</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {design.hardware.map((h, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span>
                      {HARDWARE_LABELS[h.type]}{' '}
                      <span className="font-mono text-xs text-ink-soft">{h.size}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-ply-deep">×{h.qty}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="rule-label">Costo</h3>
              {layout.byStock.map((g) => {
                const id = `price-${g.stock.id}`;
                const price = prices[g.stock.id] ?? 0;
                return (
                  <div key={g.stock.id} className="mt-3">
                    <label
                      className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                      htmlFor={id}
                    >
                      Precio por hoja — {g.stock.label} (MXN)
                    </label>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      value={price || ''}
                      onChange={(e) => setPrice(g.stock.id, Number(e.target.value) || 0)}
                      className="mt-1.5 w-full rounded-md border border-rule bg-panel px-2.5 py-2 font-mono text-sm tabular-nums transition-colors focus:border-cut focus:outline-none"
                      placeholder="0"
                    />
                    {price > 0 && (
                      <p className="mt-1 font-mono text-xs tabular-nums text-ink-soft">
                        {g.sheets} × ${price} = ${(g.sheets * price).toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
              {cost !== null && (
                <p className="mt-3 text-sm text-ink-soft">
                  Total: <strong className="font-mono text-ink">${cost.toFixed(2)} MXN</strong>
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: string;
  unit: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-[10rem] flex-1 rounded-lg border border-rule bg-panel px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</div>
      <div className="display mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="font-mono text-[10px] text-ink-faint">{unit}</div>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/components/PrintReport.tsx`**

```tsx
import { useMemo } from 'react';
import { estimateCost, nest } from '../engine/nesting.ts';
import { templates } from '../engine/index.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { SheetSvg } from './SheetSvg.tsx';
import { HARDWARE_LABELS } from './labels.ts';

/** Full build report. Hidden on screen; becomes the document when printing (Exportar PDF). */
export function PrintReport({ design }: { design: Design | null }) {
  const prices = useAppStore((s) => s.pricesByStock);
  const layout = useMemo(() => (design ? nest(design.panels) : null), [design]);
  if (!design || !layout) return null;

  const cost = estimateCost(layout, prices);
  const template = templates.find((t) => t.id === design.templateId);
  const labels = Object.fromEntries(design.panels.map((p) => [p.id, p.label]));
  const paramLine = template?.params
    .map((s) => {
      const v = design.params[s.key] ?? s.default;
      const shown =
        s.kind === 'select'
          ? (s.options.find((o) => o.value === v)?.label ?? String(v))
          : `${v}${s.unit ? ` ${s.unit}` : ''}`;
      return `${s.label}: ${shown}`;
    })
    .join(' · ');

  return (
    <div className="hidden print:block">
      <h1 className="display text-3xl font-extrabold">{template?.name ?? design.templateId}</h1>
      <p className="mt-1 font-mono text-[11px] text-ink-soft">{paramLine}</p>

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Lista de cortes</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <th className="py-1">Pieza</th>
            <th>Largo × ancho × grosor (mm)</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {design.panels.map((p) => (
            <tr key={p.id} className="border-b border-rule">
              <td className="py-1">{p.label}</td>
              <td className="font-mono text-xs tabular-nums">
                {p.length} × {p.width} × {p.stock.thickness}
              </td>
              <td className="font-mono text-xs tabular-nums">{p.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Tornillería</h2>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {design.hardware.map((h, i) => (
          <li key={i}>
            {HARDWARE_LABELS[h.type]} {h.size} — {h.qty} piezas
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm">
        Hojas:{' '}
        {layout.byStock
          .map(
            (g) =>
              `${g.sheets} de ${g.stock.label.toLowerCase()} (${g.stock.sheet.width} × ${g.stock.sheet.length} mm, ` +
              `desperdicio ${g.wastePercent.toFixed(1)}%)`,
          )
          .join(' · ')}
        {cost !== null ? ` · costo estimado de material $${cost.toFixed(2)} MXN` : ''}
      </p>

      <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Plan de corte</h2>
      <div className="mt-2 flex flex-wrap gap-4">
        {layout.sheets.map((sheet, i) => (
          <figure key={i} className="break-inside-avoid">
            <SheetSvg sheet={sheet} labels={labels} className="h-[26rem] border border-rule" />
            <figcaption className="mt-1 text-xs">
              Hoja {i + 1} — {sheet.stock.label}
              {sheet.stock.hasGrain ? ' · veta a lo largo' : ''}
            </figcaption>
          </figure>
        ))}
      </div>

      <h2 className="mt-7 break-before-page border-b border-ink pb-1 display text-lg font-bold">Pasos de armado</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {design.steps.map((st) => (
          <li key={st.order} className="break-inside-avoid">
            <span className="font-medium">{st.title}.</span> {st.description}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck and test**

Run: `pnpm typecheck` → no errors.
Run: `pnpm test` → all PASS.

- [ ] **Step 7: Check in the browser**

Start the `dev` preview from `.claude/launch.json` (`pnpm dev`, port 5173) and open `http://localhost:5173`. Check:

1. **Librero, Medidas:** "Material" shows four stacked buttons (`Triplay de pino 12 mm` … `Melamina blanca 16 mm`), with `Triplay de pino 18 mm` highlighted. The Material row has no value badge; number fields still have theirs.
2. Click `Melamina blanca 16 mm` with Ancho = 800. The error "El claro de 768 mm supera el máximo seguro de 550 mm para melamina blanca 16 mm…" appears under Ancho, and the 3D view dims. Set Ancho to 580 and the error clears.
3. **3D view:** a thin back panel sits at the rear (away from the camera).
4. **Plan de corte (plywood 18):**
   - Sheet captions read `Hoja 1 — Triplay de pino 18 mm · veta a lo largo` and `Hoja 2 — Fibracel 3 mm`. The Fibracel sheet has no grain lines and no "↑ VETA".
   - There are two Desperdicio stats, one per material.
   - The Costo section has two price inputs, and "Costo material" shows `—` / `define precios` until both are filled. After both are filled, the stat and the Total line show the same sum.
5. **Pasos:** step 5 "Coloca el fondo" highlights the back.
6. **Exportar PDF (print preview):** the param line reads `Material: Triplay de pino 18 mm`, the "Hojas:" line lists both materials, and the sheet captions match the screen.
7. **Mesa auxiliar:** it has the Material select, one sheet, and no back.

Also check the console for errors (`read_console_messages`); there should be none.

- [ ] **Step 8: Commit**

```bash
git add src/state/store.ts src/components/ParamForm.tsx src/components/SheetSvg.tsx src/components/CutDiagram.tsx src/components/PrintReport.tsx
git commit -m "feat(ui): show materials, per-material waste and prices on web

The Material select renders as a labelled vertical list. Cut diagrams and
the print report caption each sheet with its stock and draw grain only
where the board has it. Costs take one price per material in the layout.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: iOS app

**Files:**
- Modify (full replacement): `mobile/src/components/sheet-svg.tsx`, `mobile/src/screens/result/stats.tsx`
- Modify: `mobile/src/app/measure.tsx`, `mobile/src/screens/result/cuts.tsx`, `mobile/src/screens/result/index.tsx`

**Interfaces:**
- Consumes (through `@/lib/engine`, which re-exports `src/engine/index.ts`):
  - `nest(panels): NestingResult` with `sheets[].stock` and `byStock[]`
  - `getStock(id): Stock`
  - `ParamSpec` select `options: { value; label }[]`
- Produces: nothing new for other tasks.

- [ ] **Step 1: Update `mobile/src/app/measure.tsx`**

Replace the `summary` memo body:

```tsx
  const summary = useMemo(() => {
    if (!design) return null;
    const layout = nest(design.panels);
    const pieces = design.panels.reduce((n, p) => n + p.qty, 0);
    const s = layout.sheets.length;
    return `Con estas medidas salen ${pieces} piezas en ${s} hoja${s > 1 ? 's' : ''} de triplay, con ${layout.wastePercent.toFixed(0)}% de desperdicio.`;
  }, [design]);
```

with:

```tsx
  const summary = useMemo(() => {
    if (!design) return null;
    const layout = nest(design.panels);
    const pieces = design.panels.reduce((n, p) => n + p.qty, 0);
    const sheets = layout.byStock
      .map((g) => `${g.sheets} hoja${g.sheets > 1 ? 's' : ''} de ${g.stock.label.toLowerCase()}`)
      .join(' y ');
    return `Con estas medidas salen ${pieces} piezas en ${sheets}.`;
  }, [design]);
```

Replace the value chip:

```tsx
                <View style={[styles.chip, bad && styles.chipBad]}>
                  <Text style={[styles.chipValue, bad && { color: color.errChip }]}>
                    {value}
                    <Text style={styles.chipUnit}>{spec.unit ? ` ${spec.unit}` : ''}</Text>
                  </Text>
                </View>
```

with (selects show the choice in their highlighted option):

```tsx
                {spec.kind === 'number' && (
                  <View style={[styles.chip, bad && styles.chipBad]}>
                    <Text style={[styles.chipValue, bad && { color: color.errChip }]}>
                      {value}
                      <Text style={styles.chipUnit}>{spec.unit ? ` ${spec.unit}` : ''}</Text>
                    </Text>
                  </View>
                )}
```

Replace the options map:

```tsx
                  {spec.options.map((opt) => {
                    const on = opt === value;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => setParam(spec.key, opt)}
```

with:

```tsx
                  {spec.options.map((opt) => {
                    const on = opt.value === value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setParam(spec.key, opt.value)}
```

and the option text:

```tsx
                        <Mono tone={on ? color.white : color.textMuted} size={15}>
                          {opt}
                        </Mono>
```

with:

```tsx
                        <Mono tone={on ? color.white : color.textMuted} size={13}>
                          {opt.label}
                        </Mono>
```

In `styles`, replace `options` and `option`:

```tsx
  options: { flexDirection: 'row', gap: 8, marginTop: 10 },
  option: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
```

with:

```tsx
  options: { gap: 8, marginTop: 10 },
  option: {
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 14,
```

(The rest of the `option` style — `borderRadius`, `borderWidth`, `borderColor`, `backgroundColor` — stays.)

- [ ] **Step 2: Replace `mobile/src/components/sheet-svg.tsx`**

```tsx
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import type { SheetLayout } from '@/lib/engine';
import { color, piece as pieceTone } from '@/theme';

interface Props {
  sheet: SheetLayout;
  labels: Record<string, string>;
  /** `${panelId}#${instance}` ids already cut — they grey out on the sheet. */
  checked: string[];
  height?: number;
}

/** One sheet, 1 SVG unit = 1 mm, sized by its stock — same geometry the web app draws. */
export function SheetSvg({ sheet, labels, checked, height = 330 }: Props) {
  const { width: W, length: H } = sheet.stock.sheet;
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} height={height} width={(height * W) / H}>
      <Defs>
        <Pattern id="m-grain" width={26} height={26} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={0} y2={26} stroke={color.plyGrain} strokeWidth={2.5} />
        </Pattern>
      </Defs>

      <Rect x={0} y={0} width={W} height={H} fill={color.sheet} stroke={color.borderStrong} strokeWidth={6} />

      {sheet.pieces.map((p) => {
        const done = checked.includes(`${p.panelId}#${p.instance}`);
        const tone = done ? pieceTone.done : pieceTone.todo;
        const cx = p.x + p.width / 2;
        const cy = p.y + p.length / 2;
        return (
          <G key={`${p.panelId}-${p.instance}`}>
            <Rect
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.length}
              fill={tone.fill}
              stroke={tone.stroke}
              strokeWidth={5}
            />
            <SvgText x={cx} y={cy - 8} fontSize={46} fontWeight="700" textAnchor="middle" fill={tone.label}>
              {`${labels[p.panelId] ?? p.panelId} ${p.instance + 1}`}
            </SvgText>
            <SvgText x={cx} y={cy + 42} fontSize={38} textAnchor="middle" fill={tone.sub}>
              {`${p.width} × ${p.length}`}
            </SvgText>
          </G>
        );
      })}

      {/* Grain runs the full length and does not stop at cut lines. Grain-free boards get none. */}
      {sheet.stock.hasGrain && (
        <Rect x={0} y={0} width={W} height={H} fill="url(#m-grain)" opacity={0.1} />
      )}

      {sheet.stock.hasGrain && (
        <SvgText
          x={30}
          y={H / 2}
          fontSize={44}
          fill={color.textFaint}
          letterSpacing={10}
          textAnchor="middle"
          transform={`rotate(-90 30 ${H / 2})`}
        >
          ↑ VETA
        </SvgText>
      )}
    </Svg>
  );
}
```

- [ ] **Step 3: Replace `mobile/src/screens/result/stats.tsx`**

```tsx
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Display, Mono } from '@/components/ui';
import { nest, type Design } from '@/lib/engine';
import { color, radius } from '@/theme';

/** Hojas / Piezas / Merma per material — the numbers that decide a trip to the maderería. */
export function useStats(design: Design) {
  return useMemo(() => {
    const layout = nest(design.panels);
    const pieces = design.panels.reduce((n, p) => n + p.qty, 0);
    return {
      layout,
      cards: [
        {
          label: 'Hojas',
          value: String(layout.sheets.length),
          sub: layout.byStock.length > 1 ? `${layout.byStock.length} materiales` : 'en total',
        },
        { label: 'Piezas', value: String(pieces), sub: 'cortes' },
        ...layout.byStock.map((g) => ({
          label: 'Merma',
          value: `${g.wastePercent.toFixed(0)}%`,
          sub: g.stock.label,
        })),
      ],
    };
  }, [design]);
}

export function StatCards({ cards }: { cards: { label: string; value: string; sub: string }[] }) {
  return (
    <View style={styles.row}>
      {cards.map((c, i) => (
        <View key={`${c.label}-${i}`} style={styles.card}>
          <Mono tone={color.textSoft} size={9} style={{ letterSpacing: 1.3, textTransform: 'uppercase' }}>
            {c.label}
          </Mono>
          <Display size={26} style={{ marginTop: 3 }}>
            {c.value}
          </Display>
          <Mono tone={color.textFaint} size={9}>
            {c.sub}
          </Mono>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderTopWidth: 2,
    borderTopColor: color.red,
    backgroundColor: color.card,
    padding: 10,
  },
});
```

(Card keys include the index because two "Merma" cards now share a label.)

- [ ] **Step 4: Update `mobile/src/screens/result/cuts.tsx`**

Replace the first `shopping` entry:

```tsx
    {
      name: `Triplay ${design!.params.thickness} mm · 1220 × 2440`,
      qty: `${layout.sheets.length} hoja${layout.sheets.length > 1 ? 's' : ''}`,
    },
```

with one line per stock:

```tsx
    ...layout.byStock.map((g) => ({
      name: `${g.stock.label} · ${g.stock.sheet.width} × ${g.stock.sheet.length}`,
      qty: `${g.sheets} hoja${g.sheets > 1 ? 's' : ''}`,
    })),
```

Replace the header meta:

```tsx
          {`${layout.sheets.length} hoja${layout.sheets.length > 1 ? 's' : ''} · 1220 × 2440 mm · sierra 3 mm`}
```

with:

```tsx
          {`${layout.sheets.length} hoja${layout.sheets.length > 1 ? 's' : ''} · sierra 3 mm`}
```

Replace the sheet caption:

```tsx
              {`Hoja ${i + 1} de ${layout.sheets.length} — ${sheet.thickness} mm`}
```

with:

```tsx
              {`Hoja ${i + 1} de ${layout.sheets.length} — ${sheet.stock.label}`}
```

- [ ] **Step 5: Update `mobile/src/screens/result/index.tsx`**

Change the engine import:

```tsx
import { templates } from '@/lib/engine';
```

to:

```tsx
import { getStock, templates } from '@/lib/engine';
```

and the `meta` return line:

```tsx
    return `${p.width} × ${p.height ?? p.depth} × ${p.depth} · ${p.thickness} mm`;
```

to:

```tsx
    return `${p.width} × ${p.height ?? p.depth} × ${p.depth} · ${getStock(p.material!).label}`;
```

- [ ] **Step 6: Typecheck and export**

Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → the bundle completes. The output goes to the gitignored `mobile/dist/`.
Run (in repo root): `git status --short mobile` → only the five files above show as modified; `dist/` is not listed.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/app/measure.tsx mobile/src/components/sheet-svg.tsx mobile/src/screens/result/stats.tsx mobile/src/screens/result/cuts.tsx mobile/src/screens/result/index.tsx
git commit -m "feat(mobile): show materials and per-material sheets on iOS

The Material select renders as a labelled vertical list. The measure
summary, stat cards, shopping list and sheet captions follow the stock of
each sheet, and grain is drawn only on boards that have it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs, full verification, PR

**Files:**
- Modify: `CLAUDE.md` (Engine conventions, Phase 4.1 status)

**Interfaces:**
- Consumes: everything above.
- Produces: an open PR from `feat/materials` into `docs/roadmap`.

- [ ] **Step 1: Update CLAUDE.md engine conventions**

Replace:

```markdown
- Sheet: 1220 × 2440 mm; grain runs along the 2440 axis. Sheet coords: origin top-left, x along width, y along length.
- Grain: `'length'` → panel length ∥ sheet grain; `'width'` → panel width ∥ sheet grain; `'any'` → free rotation.
```

with:

```markdown
- Stock: every `Panel` carries a `Stock` (material + thickness + sheet size + grain + max span) from the catalog in `src/engine/stock.ts`. Stock ids are stored in the numeric `material` param, so never renumber them — append new stocks. Every current stock is a 1220 × 2440 sheet; grain runs along the sheet's length. Sheet coords: origin top-left, x along width, y along length.
- Grain: `'length'` → panel length ∥ sheet grain; `'width'` → panel width ∥ sheet grain; `'any'` → free rotation. A panel whose stock has `hasGrain: false` always nests as `'any'`.
- Select params carry `{ value, label }` options; the label is shown, the numeric value is stored.
```

Replace:

```markdown
- Panels of different thickness never share a sheet.
```

with:

```markdown
- Panels of different stock never share a sheet. `NestingResult.byStock` reports sheets and waste per stock, thickest first — there is no single overall waste figure.
```

Replace:

```markdown
- Span limits (max unsupported shelf span): 12 mm → 500, 15 mm → 650, 18 mm → 800 (configurable in `DEFAULT_CONFIG`).
```

with:

```markdown
- Span limits (max unsupported shelf span) live on each stock as `maxSpan`: plywood 12 → 500, 15 → 650, 18 → 800, white melamine 16 → 550; `null` (Fibracel) means never a shelf.
```

In the Phase 4 section, append to the end of the `**4.1 Materials**` bullet:

```markdown
 *Implemented; awaiting user approval.*
```

- [ ] **Step 2: Run the full verification**

Run: `pnpm test` → all PASS.
Run: `pnpm typecheck` → no errors.
Run: `pnpm demo` → exit code 0; the output lists plywood and Fibracel sheets.
Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → completes.

If any command fails, fix the cause before continuing. Don't commit over a red check.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record stock conventions for Phase 4.1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/materials
gh pr create --base docs/roadmap --head feat/materials --title "feat: materials catalog and bookshelf back (Phase 4.1)" --body "..."
```

The PR body:
- summarizes the four feature commits (engine stock, bookshelf back, web, iOS)
- lists the verification commands and their results
- notes that the PR retargets to `main` when PR #3 merges and that `src/state/store.ts` will need a trivial merge with PR #2
- ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
