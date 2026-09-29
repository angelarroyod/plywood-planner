# Phase 4.3 Order + Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a numbered lumber-yard order ("Pedido para maderería") that both apps share as WhatsApp-ready text, and a full cost on web (sheets, cutting per meter or per cut, banding, hardware) from prices the user types in and the browser remembers.

**Architecture:** Three new pure engine modules:
- `cuts.ts`: guillotine cuts derived from the FFDH shelf layout.
- `order.ts`: a structured `Order` plus its plain text.
- `cost.ts`: `orderCost` over an `Order`, replacing `estimateCost`.

Web gains a **Pedido** tab (`OrderPanel`), a read-only cost stat in Cortes, and the order as page 1 of the PDF; prices move into a persisted Zustand slice. iOS turns a placeholder export into a real share through React Native's built-in `Share`.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, React 18 + Tailwind v4 + Zustand 5 (`zustand/middleware` `persist`), Expo SDK 57 / React Native `Share`.

**Spec:** `docs/superpowers/specs/2026-09-24-order-cost-design.md`

## Global Constraints

- `src/engine/` stays pure TypeScript: zero imports from React, DOM APIs or three.js.
- UI copy is Spanish (es-MX); code, comments and commit messages are English; conventional commits.
- No new dependencies. `persist` comes from `zustand/middleware` (already installed); iOS uses `Share` from `react-native`.
- All internal units are millimeters. Cut and band meters round **up** to 0.1 m: `Math.ceil(mm / 100) / 10`.
- `orderText` never contains prices.
- `ORDER_BAND_NOTE`: yard `Por favor enchápenlo en los cantos marcados.`, diy `Solo el material (pre-engomado); yo lo aplico.`
- Prices come only from the user. On web, **only** `prices` persists (`localStorage` key `planificador.prices`, version 1); params and view stay per session.
- `orderCost`:
  - Lines in the order sheets → `Corte` → bands → hardware.
  - Price ≤ 0 or missing → `price: null`.
  - `total` sums the non-null subtotals; `missing` counts null prices.
- Web styling uses theme tokens only (`bg-panel`, `border-rule`, `text-ink-soft`, `border-cut`, `bg-cut`, `bg-raised`, `text-ply-deep`…), never raw `neutral-*` / `amber-*`.
- iOS (`mobile/`) uses npm, not pnpm, and imports the engine only through `@/lib/engine`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/order`.

## File Map

| File | Responsibility | Task |
|---|---|---|
| `src/engine/cuts.ts` (new), `cuts.test.ts` (new) | Guillotine cuts per sheet, totals | 1 |
| `scripts/demo.ts` | Cut totals in JSON | 1 |
| `src/engine/order.ts` (new), `order.test.ts` (new) | `Order`, `buildOrder`, `orderText`, `ORDER_BAND_NOTE` | 2 |
| `src/engine/cost.ts` (new), `cost.test.ts` (new) | `Prices`, `EMPTY_PRICES`, `hardwareKey`, `CostLine`, `orderCost` | 2 |
| `src/engine/index.ts` | Re-export cuts (Task 1), order + cost (Task 2) | 1, 2 |
| `src/engine/nesting.ts`, `nesting.test.ts` | Remove `estimateCost` + its tests | 3 |
| `src/state/store.ts` | `prices` + setters, persisted; `View` adds `'order'` | 3 |
| `src/components/OrderPanel.tsx` (new) | Pedido tab | 3 |
| `src/App.tsx` | Tab + render | 3 |
| `src/components/CutDiagram.tsx` | Read-only cost stat + "Editar precios" | 3 |
| `src/components/PrintReport.tsx` | Order as page 1 | 3 |
| `mobile/src/screens/result/index.tsx` | Real "Pedido para maderería" share | 4 |
| `CLAUDE.md` | Conventions + status | 5 |

Every task leaves `pnpm test`, `pnpm typecheck` and the iOS `tsc` green.

---

### Task 1: Guillotine cuts

**Files:**
- Create: `src/engine/cuts.ts`, `src/engine/cuts.test.ts`
- Modify: `src/engine/index.ts`, `scripts/demo.ts`

**Interfaces:**
- Consumes: `SheetLayout`, `PlacedPiece`, `NestingResult` (types), `nest`, `getStock`, `bookshelf`.
- Produces:
  - `interface Cut { kind: 'rip' | 'cross' | 'trim'; x1: number; y1: number; x2: number; y2: number }`
  - `sheetCuts(sheet: SheetLayout): Cut[]`
  - `cutTotals(layout: NestingResult): { count: number; meters: number }`

  All of them are re-exported from `src/engine/index.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/cuts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cutTotals, sheetCuts } from './cuts.ts';
import { nest } from './nesting.ts';
import { getStock } from './stock.ts';
import type { PlacedPiece, SheetLayout } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';

const PLY18 = getStock(3); // 1220 × 2440

function piece(over: Partial<PlacedPiece>): PlacedPiece {
  return { panelId: 'p', instance: 0, x: 0, y: 0, length: 600, width: 400, rotated: false, ...over };
}

function sheet(...pieces: PlacedPiece[]): SheetLayout {
  return { stock: PLY18, pieces };
}

describe('sheetCuts', () => {
  it('frees a corner piece with one rip and one crosscut', () => {
    expect(sheetCuts(sheet(piece({})))).toEqual([
      { kind: 'rip', x1: 0, y1: 600, x2: 1220, y2: 600 },
      { kind: 'cross', x1: 400, y1: 0, x2: 400, y2: 600 },
    ]);
  });

  it('needs no cut for a piece that fills the sheet', () => {
    expect(sheetCuts(sheet(piece({ length: 2440, width: 1220 })))).toEqual([]);
  });

  it('crosscuts after every piece in a row', () => {
    const cuts = sheetCuts(sheet(piece({ x: 0 }), piece({ instance: 1, x: 403 })));
    expect(cuts.map((c) => c.kind)).toEqual(['rip', 'cross', 'cross']);
    expect(cuts[2]).toEqual({ kind: 'cross', x1: 803, y1: 0, x2: 803, y2: 600 });
  });

  it('trims a piece shorter than its row', () => {
    const cuts = sheetCuts(sheet(piece({ x: 0 }), piece({ instance: 1, x: 403, length: 500 })));
    expect(cuts.filter((c) => c.kind === 'trim')).toEqual([
      { kind: 'trim', x1: 403, y1: 500, x2: 803, y2: 500 },
    ]);
  });

  it('does not rip under a row that reaches the sheet bottom', () => {
    expect(sheetCuts(sheet(piece({ length: 2440 })))).toEqual([
      { kind: 'cross', x1: 400, y1: 0, x2: 400, y2: 2440 },
    ]);
  });

  it('walks rows top to bottom whatever order the pieces come in', () => {
    const cuts = sheetCuts(sheet(piece({ instance: 1, y: 603 }), piece({})));
    expect(cuts.filter((c) => c.kind === 'rip').map((c) => c.y1)).toEqual([600, 1203]);
  });
});

describe('cutTotals', () => {
  it('counts cuts and rounds meters up to 0.1', () => {
    // 1220 + 600 = 1820 mm → 1.9 m
    expect(cutTotals({ sheets: [sheet(piece({}))], byStock: [] })).toEqual({ count: 2, meters: 1.9 });
  });

  it('totals the default bookshelf', () => {
    const result = bookshelf.generate({});
    if (!result.ok) throw new Error('default bookshelf must validate');
    // plywood: 2 rips + 7 crosses + 2 trims = 10 126 mm; Fibracel: 1 rip + 1 cross = 2420 mm → 12 546 mm
    expect(cutTotals(nest(result.design.panels))).toEqual({ count: 13, meters: 12.6 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/engine/cuts.test.ts`
Expected: FAIL — `Failed to resolve import "./cuts.ts"`.

- [ ] **Step 3: Create `src/engine/cuts.ts`**

```ts
import type { NestingResult, PlacedPiece, SheetLayout } from './types.ts';

/** One straight saw pass across a sheet, in sheet mm (origin top-left, x along width, y along length). */
export interface Cut {
  kind: 'rip' | 'cross' | 'trim';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The guillotine cuts that free a sheet's pieces from its FFDH shelf layout.
 * Pieces sharing a `y` form a row whose height is its tallest piece:
 * - rip: under each row that stops short of the sheet's bottom, across the full width;
 * - cross: after each piece that stops short of the sheet's right edge, down the row;
 * - trim: across each piece shorter than its row.
 */
export function sheetCuts(sheet: SheetLayout): Cut[] {
  const { width: W, length: L } = sheet.stock.sheet;
  const rows = new Map<number, PlacedPiece[]>();
  for (const p of sheet.pieces) rows.set(p.y, [...(rows.get(p.y) ?? []), p]);

  const cuts: Cut[] = [];
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(y)!.sort((a, b) => a.x - b.x);
    const height = Math.max(...row.map((p) => p.length));
    if (y + height < L) cuts.push({ kind: 'rip', x1: 0, y1: y + height, x2: W, y2: y + height });
    for (const p of row) {
      const right = p.x + p.width;
      if (right < W) cuts.push({ kind: 'cross', x1: right, y1: y, x2: right, y2: y + height });
      if (p.length < height) {
        cuts.push({ kind: 'trim', x1: p.x, y1: y + p.length, x2: right, y2: y + p.length });
      }
    }
  }
  return cuts;
}

/** Every cut in the layout: how many, and their total length in meters rounded UP to 0.1 m. */
export function cutTotals(layout: NestingResult): { count: number; meters: number } {
  const cuts = layout.sheets.flatMap((s) => sheetCuts(s));
  const mm = cuts.reduce((sum, c) => sum + Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1), 0);
  return { count: cuts.length, meters: Math.ceil(mm / 100) / 10 };
}
```

- [ ] **Step 4: Re-export and show in the demo**

In `src/engine/index.ts`, add after `export * from './edge-banding.ts';`:

```ts
export * from './cuts.ts';
```

In `scripts/demo.ts`, add the import below the `edge-banding.ts` import:

```ts
import { cutTotals } from '../src/engine/cuts.ts';
```

and in the JSON object, add after the `edgeBanding: edgeBandTotals(result.design.panels),` line:

```ts
      cuts: cutTotals(layout),
```

- [ ] **Step 5: Run the tests, the demo and the typecheck**

Run: `pnpm test` → all PASS.
Run: `pnpm demo` → the JSON includes `"cuts": { "count": 13, "meters": 12.6 }` (pretty-printed). Exit code 0.
Run: `pnpm typecheck` → no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/cuts.ts src/engine/cuts.test.ts src/engine/index.ts scripts/demo.ts
git commit -m "feat(engine): count the guillotine cuts in a layout

Derive the rips, crosscuts and trims that free each sheet's pieces from
its shelf layout, and total their count and meters (rounded up to 0.1 m)
for lumber-yard cutting prices.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Order and cost in the engine

**Files:**
- Create: `src/engine/order.ts`, `src/engine/order.test.ts`, `src/engine/cost.ts`, `src/engine/cost.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes:
  - Task 1: `cutTotals`
  - Existing: `edgeBandTotals`, `edgeCodes`, `EdgeBandTotal`, `HARDWARE_LABELS`, `Design`, `EdgeBandingMode`, `EdgeBands`, `Hardware`, `NestingResult`, `Stock`
- Produces:
  - `order.ts`:
    - `interface OrderLine { n: number; label: string; length: number; width: number; qty: number; grain: 'length' | 'width' | null; edges: EdgeBands }`
    - `interface OrderGroup { stock: Stock; sheets: number; lines: OrderLine[] }`
    - `interface Order { title: string; groups: OrderGroup[]; cuts: { count: number; meters: number }; bands: EdgeBandTotal[]; edgeBanding: EdgeBandingMode; hardware: Hardware[] }`
    - `buildOrder(design: Design, layout: NestingResult, title: string): Order`
    - `orderText(order: Order): string`
    - `ORDER_BAND_NOTE: Record<'yard' | 'diy', string>`
  - `cost.ts`:
    - `interface Prices { sheets: Record<number, number>; cut: { unit: 'meter' | 'cut'; price: number }; bands: Record<string, number>; hardware: Record<string, number> }`
    - `EMPTY_PRICES: Prices`
    - `hardwareKey(h: Hardware): string`
    - `interface CostLine { key: string; label: string; qty: number; unit: string; price: number | null; subtotal: number | null }`
    - `orderCost(order: Order, prices: Prices): { lines: CostLine[]; total: number; missing: number }`
    - `CostLine.key` is one of `sheet:{stockId}`, `cut`, `band:{label}`, `hw:{hardwareKey}`.

  Both modules are re-exported from `src/engine/index.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/order.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildOrder, orderText } from './order.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';
import { sideTable } from './templates/side-table.ts';
import type { Template } from './types.ts';

function orderFor(template: Template, params = {}, title = 'Librero') {
  const result = template.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return buildOrder(result.design, nest(result.design.panels), title);
}

describe('buildOrder', () => {
  it('groups lines by material and numbers them across groups', () => {
    const order = orderFor(bookshelf);
    expect(order.title).toBe('Librero');
    expect(order.groups.map((g) => [g.stock.id, g.sheets])).toEqual([
      [3, 1],
      [5, 1],
    ]);
    expect(order.groups.flatMap((g) => g.lines.map((l) => [l.n, l.label, l.length, l.width, l.qty]))).toEqual([
      [1, 'Lateral', 1200, 297, 2],
      [2, 'Tapa', 764, 297, 1],
      [3, 'Base', 764, 297, 1],
      [4, 'Entrepaño', 764, 297, 3],
      [5, 'Fondo', 1200, 800, 1],
    ]);
    expect(order.cuts).toEqual({ count: 13, meters: 12.6 });
    expect(order.edgeBanding).toBe('yard');
    expect(order.hardware.map((h) => h.qty)).toEqual([20, 32]);
  });

  it('marks grain only where it matters', () => {
    const order = orderFor(bookshelf);
    expect(order.groups[0]!.lines.every((l) => l.grain === 'length')).toBe(true);
    expect(order.groups[1]!.lines[0]!.grain).toBeNull(); // Fibracel back: no grain

    const melamine = orderFor(sideTable, { width: 500, material: 4 }, 'Mesa auxiliar');
    expect(melamine.groups[0]!.lines.every((l) => l.grain === null)).toBe(true);
  });
});

describe('orderText', () => {
  it('writes the default bookshelf order', () => {
    expect(orderText(orderFor(bookshelf))).toBe(
      [
        'Pedido para maderería — Librero',
        'Medidas en mm: largo × ancho.',
        '',
        'Triplay de pino 18 mm — 1 hoja de 1220 × 2440',
        '1. Lateral — 1200 × 297 — 2 pzas — veta a lo largo — cubrecanto L1 A1',
        '2. Tapa — 764 × 297 — 1 pza — veta a lo largo — cubrecanto L1',
        '3. Base — 764 × 297 — 1 pza — veta a lo largo — cubrecanto L1',
        '4. Entrepaño — 764 × 297 — 3 pzas — veta a lo largo — cubrecanto L1',
        '',
        'Fibracel 3 mm — 1 hoja de 1220 × 2440',
        '5. Fondo — 1200 × 800 — 1 pza',
        '',
        'Cubrecanto de chapa de pino 22 mm: 7.1 m. Por favor enchápenlo en los cantos marcados.',
        'Cortes: 13 (12.6 m lineales).',
        'Herrajes: Tornillo confirmat 5x50 × 20 · Tornillo 3.5x16 × 32',
      ].join('\n'),
    );
  });

  it('drops banding when there is none', () => {
    const text = orderText(orderFor(bookshelf, { edgeBanding: 0 }));
    expect(text.toLowerCase()).not.toContain('cubrecanto');
  });

  it('tells the yard when the customer bands at home', () => {
    expect(orderText(orderFor(bookshelf, { edgeBanding: 2 }))).toContain(
      'Cubrecanto de chapa de pino 22 mm: 7.1 m. Solo el material (pre-engomado); yo lo aplico.',
    );
  });

  it('never contains prices', () => {
    expect(orderText(orderFor(bookshelf))).not.toMatch(/\$|MXN/);
  });
});
```

Create `src/engine/cost.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_PRICES, hardwareKey, orderCost, type Prices } from './cost.ts';
import { buildOrder } from './order.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';

function order(params = {}) {
  const result = bookshelf.generate(params);
  if (!result.ok) throw new Error('bookshelf must validate');
  return buildOrder(result.design, nest(result.design.panels), 'Librero');
}

const FULL: Prices = {
  sheets: { 3: 950, 5: 180 },
  cut: { unit: 'meter', price: 4 },
  bands: { 'Cubrecanto de chapa de pino 22 mm': 12 },
  hardware: { 'confirmat 5x50': 2, 'screw 3.5x16': 0.5 },
};

describe('orderCost', () => {
  it('prices sheets, cutting, band and hardware, in that order', () => {
    expect(orderCost(order(), FULL).lines.map((l) => [l.key, l.label, l.qty, l.unit, l.price])).toEqual([
      ['sheet:3', 'Triplay de pino 18 mm', 1, 'hoja', 950],
      ['sheet:5', 'Fibracel 3 mm', 1, 'hoja', 180],
      ['cut', 'Corte', 12.6, 'm', 4],
      ['band:Cubrecanto de chapa de pino 22 mm', 'Cubrecanto de chapa de pino 22 mm', 7.1, 'm', 12],
      ['hw:confirmat 5x50', 'Tornillo confirmat 5x50', 20, 'pza', 2],
      ['hw:screw 3.5x16', 'Tornillo 3.5x16', 32, 'pza', 0.5],
    ]);
  });

  it('adds up every priced line', () => {
    const { total, missing } = orderCost(order(), FULL);
    // 950 + 180 + 12.6·4 + 7.1·12 + 20·2 + 32·0.5 = 950 + 180 + 50.4 + 85.2 + 40 + 16
    expect(total).toBeCloseTo(1321.6);
    expect(missing).toBe(0);
  });

  it('prices cutting per cut when asked', () => {
    const cut = orderCost(order(), { ...FULL, cut: { unit: 'cut', price: 10 } }).lines.find((l) => l.key === 'cut');
    expect(cut).toMatchObject({ qty: 13, unit: 'corte', price: 10, subtotal: 130 });
  });

  it('leaves unpriced lines out of the total and counts them', () => {
    const partial: Prices = { ...EMPTY_PRICES, sheets: { 3: 950, 5: 0 }, hardware: { 'confirmat 5x50': -1 } };
    const { lines, total, missing } = orderCost(order(), partial);
    expect(total).toBe(950);
    expect(missing).toBe(5); // Fibracel (0), cut, band, confirmat (negative), screw
    expect(lines.find((l) => l.key === 'sheet:5')).toMatchObject({ price: null, subtotal: null });
  });

  it('has no band line when nothing is banded', () => {
    expect(orderCost(order({ edgeBanding: 0 }), FULL).lines.some((l) => l.key.startsWith('band:'))).toBe(false);
  });

  it('keys hardware by type and size', () => {
    expect(hardwareKey({ type: 'confirmat', size: '5x50', qty: 20 })).toBe('confirmat 5x50');
  });

  it('starts with no prices', () => {
    expect(EMPTY_PRICES).toEqual({ sheets: {}, cut: { unit: 'meter', price: 0 }, bands: {}, hardware: {} });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/engine/order.test.ts src/engine/cost.test.ts`
Expected: FAIL — `Failed to resolve import "./order.ts"` / `"./cost.ts"`.

- [ ] **Step 3: Create `src/engine/order.ts`**

```ts
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
```

- [ ] **Step 4: Create `src/engine/cost.ts`**

```ts
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
```

- [ ] **Step 5: Re-export**

In `src/engine/index.ts`, add after `export * from './cuts.ts';`:

```ts
export * from './order.ts';
export * from './cost.ts';
```

- [ ] **Step 6: Run the tests and the typecheck**

Run: `pnpm test` → all PASS.
Run: `pnpm typecheck` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/order.ts src/engine/order.test.ts src/engine/cost.ts src/engine/cost.test.ts src/engine/index.ts
git commit -m "feat(engine): build the lumber-yard order and its full cost

A structured order numbers every piece across materials with its size,
grain and banded edges, and totals sheets, cuts, band and hardware. It
renders as price-free plain text for WhatsApp. orderCost prices each line
from user prices (cutting per meter or per cut) and sums what is priced.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Web — Pedido tab, persisted prices, cost everywhere

**Files:**
- Create: `src/components/OrderPanel.tsx`
- Modify (full replacement): `src/state/store.ts`
- Modify: `src/App.tsx`, `src/components/CutDiagram.tsx`, `src/components/PrintReport.tsx`, `src/engine/nesting.ts`, `src/engine/nesting.test.ts`

**Interfaces:**
- Consumes (Tasks 1–2): `buildOrder`, `orderText`, `ORDER_BAND_NOTE`, `orderCost`, `EMPTY_PRICES`, `Prices`, `edgeCodes`, `nest`.
- Produces:
  - Store:
    - `prices: Prices`
    - `setSheetPrice(stockId: number, price: number)`
    - `setCutPrice(price: number)`
    - `setCutUnit(unit: 'meter' | 'cut')`
    - `setBandPrice(label: string, price: number)`
    - `setHardwarePrice(key: string, price: number)`
    - `View = 'design' | 'cuts' | 'steps' | 'order'`
  - `OrderPanel({ design, title }: { design: Design; title: string })`
  - `estimateCost` is deleted.

- [ ] **Step 1: Replace `src/state/store.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TemplateParams } from '../engine/types.ts';
import { templates } from '../engine/index.ts';
import { EMPTY_PRICES, type Prices } from '../engine/cost.ts';

export type View = 'design' | 'cuts' | 'steps' | 'order';

interface AppState {
  templateId: string;
  paramsByTemplate: Record<string, TemplateParams>; // sparse: only user-touched keys
  exploded: boolean;
  view: View;
  activeStep: number | null; // Step.order, null = no highlight
  prices: Prices; // user-entered MXN prices; the only state saved across visits
  setTemplate: (id: string) => void;
  setParam: (key: string, value: number) => void;
  toggleExploded: () => void;
  setView: (view: View) => void;
  setActiveStep: (order: number | null) => void;
  setSheetPrice: (stockId: number, price: number) => void;
  setCutPrice: (price: number) => void;
  setCutUnit: (unit: Prices['cut']['unit']) => void;
  setBandPrice: (label: string, price: number) => void;
  setHardwarePrice: (key: string, price: number) => void;
}

const clamp = (price: number) => Math.max(0, price);

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      templateId: templates[0]!.id,
      paramsByTemplate: {},
      exploded: false,
      view: 'design',
      activeStep: null,
      prices: EMPTY_PRICES,
      setTemplate: (id) => set({ templateId: id, activeStep: null }),
      setParam: (key, value) =>
        set((s) => ({
          paramsByTemplate: {
            ...s.paramsByTemplate,
            [s.templateId]: { ...s.paramsByTemplate[s.templateId], [key]: value },
          },
          // the Cubrecanto choice adds/removes a step, so step numbers shift
          ...(key === 'edgeBanding' ? { activeStep: null } : null),
        })),
      toggleExploded: () => set((s) => ({ exploded: !s.exploded })),
      setView: (view) => set({ view }),
      setActiveStep: (order) => set({ activeStep: order }),
      setSheetPrice: (stockId, price) =>
        set((s) => ({ prices: { ...s.prices, sheets: { ...s.prices.sheets, [stockId]: clamp(price) } } })),
      setCutPrice: (price) => set((s) => ({ prices: { ...s.prices, cut: { ...s.prices.cut, price: clamp(price) } } })),
      setCutUnit: (unit) => set((s) => ({ prices: { ...s.prices, cut: { ...s.prices.cut, unit } } })),
      setBandPrice: (label, price) =>
        set((s) => ({ prices: { ...s.prices, bands: { ...s.prices.bands, [label]: clamp(price) } } })),
      setHardwarePrice: (key, price) =>
        set((s) => ({ prices: { ...s.prices, hardware: { ...s.prices.hardware, [key]: clamp(price) } } })),
    }),
    {
      // ponytail: only prices persist; designs stay derived and params stay per-session
      name: 'planificador.prices',
      version: 1,
      partialize: (s) => ({ prices: s.prices }),
    },
  ),
);
```

Note: PR #2 (`feat/theme-toggle`) also edits this file by adding theme state. Whichever merges second keeps both changes.

- [ ] **Step 2: Create `src/components/OrderPanel.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { orderCost } from '../engine/cost.ts';
import { edgeCodes } from '../engine/edge-banding.ts';
import { nest } from '../engine/nesting.ts';
import { ORDER_BAND_NOTE, buildOrder, orderText } from '../engine/order.ts';
import type { Design } from '../engine/types.ts';
import { useAppStore } from '../state/store.ts';
import { HARDWARE_LABELS } from './labels.ts';

const GRAIN_LABEL = { length: 'largo', width: 'ancho' } as const;

/** The lumber-yard order: what to ask for, shared as text, plus the full cost from the user's prices. */
export function OrderPanel({ design, title }: { design: Design; title: string }) {
  const order = useMemo(() => buildOrder(design, nest(design.panels), title), [design, title]);
  const text = useMemo(() => orderText(order), [order]);
  const prices = useAppStore((s) => s.prices);
  const setSheetPrice = useAppStore((s) => s.setSheetPrice);
  const setCutPrice = useAppStore((s) => s.setCutPrice);
  const setCutUnit = useAppStore((s) => s.setCutUnit);
  const setBandPrice = useAppStore((s) => s.setBandPrice);
  const setHardwarePrice = useAppStore((s) => s.setHardwarePrice);
  const cost = orderCost(order, prices);
  const [status, setStatus] = useState<string | null>(null);

  const canShare = typeof navigator.share === 'function';

  async function share() {
    try {
      await navigator.share({ title: `Pedido — ${title}`, text });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setStatus('No se pudo compartir');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copiado');
    } catch {
      setStatus('No se pudo copiar');
    }
  }

  function setPrice(key: string, value: number) {
    if (key.startsWith('sheet:')) setSheetPrice(Number(key.slice('sheet:'.length)), value);
    else if (key === 'cut') setCutPrice(value);
    else if (key.startsWith('band:')) setBandPrice(key.slice('band:'.length), value);
    else if (key.startsWith('hw:')) setHardwarePrice(key.slice('hw:'.length), value);
  }

  return (
    <div className="h-full overflow-y-auto bg-panel px-8 py-7">
      <div className="mx-auto max-w-[1200px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-2xl font-extrabold">Pedido para maderería</h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              {title} · medidas en mm, largo × ancho
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <span role="status" className="font-mono text-[11px] text-ink-soft">
                {status}
              </span>
            )}
            {canShare && (
              <button
                onClick={share}
                className="rounded-md bg-cut px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white transition-[filter] hover:brightness-110"
              >
                Compartir
              </button>
            )}
            <button
              onClick={copy}
              className="rounded-md border border-rule bg-raised px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink-soft"
            >
              Copiar
            </button>
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-start gap-10">
          <section className="min-w-0 flex-1 space-y-8">
            {order.groups.map((g) => (
              <div key={g.stock.id}>
                <h3 className="rule-label">
                  {g.stock.label} — {g.sheets} {g.sheets === 1 ? 'hoja' : 'hojas'}
                </h3>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      <th className="pb-1.5 font-medium">#</th>
                      <th className="pb-1.5 font-medium">Pieza</th>
                      <th className="pb-1.5 text-right font-medium">Largo</th>
                      <th className="pb-1.5 text-right font-medium">Ancho</th>
                      <th className="pb-1.5 text-right font-medium">Cant.</th>
                      <th className="pb-1.5 pl-4 font-medium">Veta</th>
                      <th className="pb-1.5 font-medium">Cubrecanto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.n} className="border-b border-rule/70">
                        <td className="py-1.5 pr-2 font-mono text-xs tabular-nums text-ink-soft">{l.n}</td>
                        <td className="py-1.5 pr-2">{l.label}</td>
                        <td className="py-1.5 text-right font-mono text-xs tabular-nums">{l.length}</td>
                        <td className="py-1.5 text-right font-mono text-xs tabular-nums">{l.width}</td>
                        <td className="py-1.5 text-right font-mono text-xs tabular-nums">{l.qty}</td>
                        <td className="py-1.5 pl-4 font-mono text-xs text-ink-soft">
                          {l.grain ? GRAIN_LABEL[l.grain] : '—'}
                        </td>
                        <td className="py-1.5 font-mono text-xs text-ink-soft">{edgeCodes(l.edges)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div>
              <h3 className="rule-label">Totales</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {order.bands.map((b) => (
                  <li key={b.label}>
                    {b.label}: <span className="font-mono tabular-nums">{b.meters.toFixed(1)} m</span>
                    {order.edgeBanding !== 'none' && (
                      <span className="text-ink-soft"> — {ORDER_BAND_NOTE[order.edgeBanding]}</span>
                    )}
                  </li>
                ))}
                <li>
                  Cortes:{' '}
                  <span className="font-mono tabular-nums">
                    {order.cuts.count} ({order.cuts.meters.toFixed(1)} m lineales)
                  </span>
                </li>
                {order.hardware.map((h, i) => (
                  <li key={i}>
                    {HARDWARE_LABELS[h.type]} {h.size}: <span className="font-mono tabular-nums">× {h.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="w-96 shrink-0">
            <h3 className="rule-label">Costo</h3>
            <p className="mt-2 text-xs text-ink-soft">Precios de tu maderería en MXN. Se guardan en este navegador.</p>
            <ul className="mt-4 space-y-3">
              {cost.lines.map((l) => (
                <li key={l.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={`price-${l.key}`} className="text-sm">
                      {l.label}
                    </label>
                    {l.key === 'cut' && (
                      <div role="group" aria-label="Cobro del corte" className="flex gap-1">
                        {(['meter', 'cut'] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => setCutUnit(u)}
                            aria-pressed={prices.cut.unit === u}
                            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                              prices.cut.unit === u
                                ? 'border-cut bg-cut text-white'
                                : 'border-rule bg-panel text-ink-soft hover:border-ink-soft'
                            }`}
                          >
                            {u === 'meter' ? 'por metro' : 'por corte'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-ink-soft">$</span>
                    {/* uncontrolled so values like "0.5" can be typed without the store eating the "0." */}
                    <input
                      id={`price-${l.key}`}
                      type="number"
                      min={0}
                      step="any"
                      defaultValue={l.price ?? ''}
                      onChange={(e) => setPrice(l.key, Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 rounded-md border border-rule bg-panel px-2.5 py-1.5 font-mono text-sm tabular-nums transition-colors focus:border-cut focus:outline-none"
                    />
                    <span className="font-mono text-xs text-ink-soft">por {l.unit}</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-ink-soft">
                      × {l.qty}
                      {l.subtotal !== null && <> = ${l.subtotal.toFixed(2)}</>}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-rule pt-3 text-sm">
              Total: <strong className="font-mono text-ink">${cost.total.toFixed(2)} MXN</strong>
              {cost.missing > 0 && <span className="text-ink-soft"> (faltan {cost.missing} precios)</span>}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/App.tsx`**

Add the import below the `StepsPanel` import:

```tsx
import { OrderPanel } from './components/OrderPanel.tsx';
```

Replace the `TABS` array:

```tsx
const TABS: { id: View; label: string; hint: string }[] = [
  { id: 'design', label: 'Diseño', hint: '3D' },
  { id: 'cuts', label: 'Cortes', hint: 'Hojas' },
  { id: 'steps', label: 'Pasos', hint: 'Armado' },
];
```

with:

```tsx
const TABS: { id: View; label: string; hint: string }[] = [
  { id: 'design', label: 'Diseño', hint: '3D' },
  { id: 'cuts', label: 'Cortes', hint: 'Hojas' },
  { id: 'steps', label: 'Pasos', hint: 'Armado' },
  { id: 'order', label: 'Pedido', hint: 'Maderería' },
];
```

After `{design && view === 'steps' && <StepsPanel design={design} stale={!result.ok} />}`, add:

```tsx
            {design && view === 'order' && <OrderPanel design={design} title={template.name} />}
```

- [ ] **Step 4: `src/components/CutDiagram.tsx` — read-only cost**

Replace the first two import lines:

```tsx
import { useMemo, type ReactNode } from 'react';
import { estimateCost, nest } from '../engine/nesting.ts';
```

with:

```tsx
import { useMemo, type ReactNode } from 'react';
import { orderCost } from '../engine/cost.ts';
import { nest } from '../engine/nesting.ts';
import { buildOrder } from '../engine/order.ts';
```

Replace:

```tsx
  const prices = useAppStore((s) => s.pricesByStock);
  const setPrice = useAppStore((s) => s.setPrice);
  const cost = estimateCost(layout, prices);
```

with:

```tsx
  const prices = useAppStore((s) => s.prices);
  const setView = useAppStore((s) => s.setView);
  // title is unused by orderCost; prices are edited in the Pedido tab
  const cost = orderCost(buildOrder(design, layout, ''), prices);
```

Replace the `Costo material` stat:

```tsx
            <Stat
              label="Costo material"
              value={cost === null ? '—' : `$${cost.toFixed(0)}`}
              unit={cost === null ? 'define precios' : 'MXN estimado'}
            />
```

with:

```tsx
            <Stat
              label="Costo"
              value={cost.total > 0 ? `$${Math.round(cost.total)}` : '—'}
              unit={cost.missing > 0 ? `faltan ${cost.missing} precios` : 'MXN estimado'}
            >
              <button
                onClick={() => setView('order')}
                className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft underline decoration-rule underline-offset-2 transition-colors hover:text-ink"
              >
                Editar precios
              </button>
            </Stat>
```

Delete the whole **Costo** block: the `<div>` that starts with `<h3 className="rule-label">Costo</h3>` and contains the per-material price inputs and the `Total:` line, up to its closing `</div>`, just before `</section>`.

- [ ] **Step 5: `src/components/PrintReport.tsx` — order as page 1**

Replace the imports:

```tsx
import { useMemo } from 'react';
import { estimateCost, nest } from '../engine/nesting.ts';
import { EDGE_BANDING_NOTE, edgeBandTotals, edgeCodes } from '../engine/edge-banding.ts';
```

with:

```tsx
import { useMemo } from 'react';
import { orderCost } from '../engine/cost.ts';
import { nest } from '../engine/nesting.ts';
import { ORDER_BAND_NOTE, buildOrder } from '../engine/order.ts';
import { EDGE_BANDING_NOTE, edgeBandTotals, edgeCodes } from '../engine/edge-banding.ts';
```

Replace `const prices = useAppStore((s) => s.pricesByStock);` with:

```tsx
  const prices = useAppStore((s) => s.prices);
```

Replace:

```tsx
  const cost = estimateCost(layout, prices);
  const template = templates.find((t) => t.id === design.templateId);
```

with:

```tsx
  const template = templates.find((t) => t.id === design.templateId);
  const order = buildOrder(design, layout, template?.name ?? design.templateId);
  const cost = orderCost(order, prices);
```

Right after `<div className="hidden print:block">`, insert page 1:

```tsx
      <section className="break-after-page">
        <h1 className="display text-3xl font-extrabold">Pedido para maderería — {order.title}</h1>
        <p className="mt-1 font-mono text-[11px] text-ink-soft">Medidas en mm: largo × ancho.</p>
        {order.groups.map((g) => (
          <div key={g.stock.id} className="break-inside-avoid">
            <h2 className="mt-6 border-b border-ink pb-1 display text-lg font-bold">
              {g.stock.label} — {g.sheets} {g.sheets === 1 ? 'hoja' : 'hojas'} de {g.stock.sheet.width} ×{' '}
              {g.stock.sheet.length}
            </h2>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="py-1">#</th>
                  <th>Pieza</th>
                  <th>Largo</th>
                  <th>Ancho</th>
                  <th>Cant.</th>
                  <th>Veta</th>
                  <th>Cubrecanto</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l) => (
                  <tr key={l.n} className="border-b border-rule">
                    <td className="py-1 font-mono text-xs tabular-nums">{l.n}</td>
                    <td>{l.label}</td>
                    <td className="font-mono text-xs tabular-nums">{l.length}</td>
                    <td className="font-mono text-xs tabular-nums">{l.width}</td>
                    <td className="font-mono text-xs tabular-nums">{l.qty}</td>
                    <td className="font-mono text-xs">
                      {l.grain === 'length' ? 'largo' : l.grain === 'width' ? 'ancho' : '—'}
                    </td>
                    <td className="font-mono text-xs">{edgeCodes(l.edges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <ul className="mt-4 space-y-1 text-sm">
          {order.bands.map((b) => (
            <li key={b.label}>
              {b.label}: {b.meters.toFixed(1)} m
              {order.edgeBanding !== 'none' && ` — ${ORDER_BAND_NOTE[order.edgeBanding]}`}
            </li>
          ))}
          <li>
            Cortes: {order.cuts.count} ({order.cuts.meters.toFixed(1)} m lineales)
          </li>
        </ul>
        {cost.total > 0 && (
          <p className="mt-3 text-sm">
            Costo estimado: ${cost.total.toFixed(2)} MXN
            {cost.missing > 0 && ` (faltan ${cost.missing} precios)`}
          </p>
        )}
      </section>
```

In the sheets paragraph, delete the old cost clause line:

```tsx
        {cost !== null ? ` · costo estimado de material $${cost.toFixed(2)} MXN` : ''}
```

- [ ] **Step 6: Remove `estimateCost`**

In `src/engine/nesting.ts`, delete the `estimateCost` function and its doc comment (the block starting `/**` / ` * Sheets × user-entered price per stock (MXN).` through the function's closing `}`).

In `src/engine/nesting.test.ts`:
- Change the first engine import `import { estimateCost, nest } from './nesting.ts';` to `import { nest } from './nesting.ts';`.
- Delete the whole `describe('estimateCost', () => { … });` block at the end of the file.

Confirm nothing else references it: `grep -rn "estimateCost\|pricesByStock\|setPrice\b" src mobile/src scripts` prints nothing.

- [ ] **Step 7: Typecheck and test**

Run: `pnpm typecheck` → no errors.
Run: `pnpm test` → all PASS.

- [ ] **Step 8: Check in the browser**

Start the `dev` preview from `.claude/launch.json` (`pnpm dev`, port 5173), open `http://localhost:5173`, and check:

1. **Tabs:** there is a 4th tab, **Pedido** (hint `Maderería`).
2. **Pedido (Librero defaults):**
   - Two groups: `Triplay de pino 18 mm — 1 hoja` with rows 1–4 (`Lateral 1200 297 2 largo L1 A1`, …), and `Fibracel 3 mm — 1 hoja` with row 5, `Fondo 1200 800 1 — —`.
   - Totales: `Cubrecanto de chapa de pino 22 mm: 7.1 m — Por favor enchápenlo en los cantos marcados.`, `Cortes: 13 (12.6 m lineales)`, and the two hardware lines.
3. **Copiar:**
   - Shows `Copiado`.
   - If the browser tools allow `navigator.clipboard.readText()`, the clipboard text starts `Pedido para maderería — Librero` and has no `$`.
   - Compartir is shown only if `typeof navigator.share === 'function'` in the preview.
4. **Costo:**
   - There are 6 rows: 2 sheets, Corte, band, 2 hardware.
   - Typing `950` for Triplay shows `× 1 = $950.00`, and the total `$950.00 MXN (faltan 5 precios)`.
   - Typing `0.5` for Tornillo 3.5x16 is accepted (the input keeps `0.5`).
   - Switching `por corte` changes the Corte row to `por corte … × 13`.
5. **Persistence:** reload the page; the prices are still there (`localStorage['planificador.prices']` exists and contains only `prices`).
6. **Cortes:** the `Costo` stat shows `$…` with `faltan N precios`, and has no price inputs. **Editar precios** switches to the Pedido tab.
7. **Print DOM:** the always-rendered `PrintReport` (`.hidden.print\:block`) starts with a `section.break-after-page` holding the order heading `Pedido para maderería — Librero`, the two tables, and the cuts line.

Check `read_console_messages` for errors; there should be none. Stop the preview when done.

- [ ] **Step 9: Commit**

```bash
git add src/state/store.ts src/components/OrderPanel.tsx src/App.tsx src/components/CutDiagram.tsx src/components/PrintReport.tsx src/engine/nesting.ts src/engine/nesting.test.ts
git commit -m "feat(ui): add the Pedido tab with shareable order and full cost

A new Pedido tab lists the numbered order per material with its totals,
shares or copies it as text, and prices every line from user prices the
browser remembers. Cortes keeps a read-only cost with a shortcut to edit
prices, and the order becomes page 1 of the PDF. estimateCost is gone;
orderCost replaces it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: iOS share

**Files:**
- Modify: `mobile/src/screens/result/index.tsx`

**Interfaces:**
- Consumes (through `@/lib/engine`): `buildOrder`, `orderText`, `nest`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Imports**

Replace:

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
```

with:

```tsx
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
```

and:

```tsx
import { getStock, templates } from '@/lib/engine';
```

with:

```tsx
import { buildOrder, getStock, nest, orderText, templates } from '@/lib/engine';
```

- [ ] **Step 2: The export entry**

In `EXPORTS`, replace:

```tsx
  { tag: 'TXT', label: 'Lista de compras', sub: 'Para el mostrador de la maderería' },
```

with:

```tsx
  { tag: 'TXT', label: 'Pedido para maderería', sub: 'Compártelo por WhatsApp o correo' },
```

- [ ] **Step 3: Share the order**

Directly after the line `if (!design) return <View style={styles.root} />;` inside `Result`, add:

```tsx
  const shareOrder = () => {
    Share.share({ message: orderText(buildOrder(design, nest(design.panels), template.name)) }).catch(() =>
      flash('No se pudo compartir'),
    );
  };
```

In the export row's `onPress`, replace:

```tsx
                onPress={() => {
                  setSheetOpen(false);
                  flash(`${e.label} listo`);
                }}
```

with:

```tsx
                onPress={() => {
                  setSheetOpen(false);
                  if (e.tag === 'TXT') shareOrder();
                  else flash(`${e.label} listo`); // the other exports are still fixtures
                }}
```

- [ ] **Step 4: Typecheck and export**

Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → the bundle completes.
Run (repo root): `git status --short mobile` → only `mobile/src/screens/result/index.tsx`.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/result/index.tsx
git commit -m "feat(mobile): share the lumber-yard order from iOS

The Lista de compras export placeholder becomes Pedido para maderería and
opens the system share sheet with the same order text the web shares,
using React Native's built-in Share.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs and full verification (no push)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md**

In "## Engine conventions", replace:

```markdown
- `estimateCost` returns `null` until every stock in the layout has a positive price; `spanIssue` throws for a stock with `maxSpan: null` (templates only offer shelf-capable stocks, so it is unreachable from valid params).
```

with:

```markdown
- `orderCost` prices an `Order` line by line — sheets, cutting (per meter or per cut), bands per meter, hardware per piece; `total` sums the priced lines and `missing` counts unpriced ones. Prices come only from the user; the web saves them (and nothing else) to `localStorage` under `planificador.prices`. `spanIssue` throws for a stock with `maxSpan: null` (templates only offer shelf-capable stocks, so it is unreachable from valid params).
- Cut totals come from `sheetCuts`: one rip under each row that stops short of the sheet bottom, one crosscut after each piece that stops short of the right edge, one trim per piece shorter than its row; meters round up to 0.1. `orderText` is the order sent to the lumber yard and never contains prices.
```

In "## Phase plan and status", on the line starting `  - **4.3 Order + cost**`, replace ` *In progress.*` at the end with ` *Implemented; awaiting user approval.*`.

- [ ] **Step 2: Full verification**

Run: `pnpm test` → all PASS.
Run: `pnpm typecheck` → no errors.
Run: `pnpm demo` → exit code 0; the JSON includes `cuts`.
Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → completes.

If any command fails, don't commit; report the failing command and its output.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record order and cost conventions for Phase 4.3

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
