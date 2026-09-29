# Phase 5.1 Doors + Modular Closet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable door building block (full overlay, 35 mm cup hinges drilled by the lumber yard, handles) and use it in a new "Clóset modular" template, with fittings drawn in 3D and hinge drilling in the lumber-yard order and cost.

**Architecture:** The engine gains `Design.fittings` (non-cut boxes: rod, handles) and `Design.boring` (hinge cups the yard drills). `src/engine/parts/door.ts` returns a design fragment that the closet template merges with its own case parts. Order, cost and both clients read the new fields. `hardwareText` becomes the single hardware-line format.

**Tech Stack:**
- TypeScript (strict), Vitest.
- Web: React 18 + Vite + Tailwind v4 + @react-three/fiber and drei (pnpm, repo root).
- iOS: Expo SDK 57 + expo-gl + three (npm, `mobile/`).

**Spec:** `docs/superpowers/specs/2026-09-24-closet-doors-design.md`

## Global Constraints

- `src/engine/` is pure TypeScript: ZERO imports from React, DOM APIs or three.js. The iOS app imports it unchanged through `mobile/src/lib/engine.ts` (`export * from '../../../src/engine/index'`).
- UI copy is Spanish (es-MX). Code, comments and commit messages are English. Commits follow Conventional Commits.
- Add no dependencies.
- All internal units are millimetres.
- `generate()` returns a `GenerateResult` envelope and never throws for validation. Issue messages are Spanish, human-readable, with `paramKey` when tied to one input.
- Never renumber stock ids.
- Web colours use the `@theme` tokens (`bg-panel`, `text-ink-soft`, `border-rule`, …), never raw `neutral-*` or `amber-*`. Three.js colours in viewers stay hex constants, as today.
- Work on the local branch `feat/closet`. Never push or contact a remote.
- End every commit message with a `Co-Authored-By:` trailer naming the model that wrote the commit, e.g. `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Verification commands:
  - web, at the repo root: `pnpm test`, `pnpm typecheck`, `pnpm demo`;
  - iOS, in `mobile/`: `npx tsc --noEmit`, `npx expo export --platform ios --output-dir <a temp dir>`.
- On Windows the Bash tool is Git Bash. `cd` to the repo root (`C:\Users\angel\Claude\Projects\plywood-planner`) or use absolute paths.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/engine/types.ts` | modify | `Hardware` types + `cutTo`, `Fitting`, `Boring`, `Design.fittings/boring` |
| `src/engine/labels.ts` | modify | new `HARDWARE_LABELS` entries, `hardwareText` |
| `src/engine/order.ts` | rewrite | `OrderBoring`, `Order.boring`, `boringHoles`, Barrenado text, `hardwareText` |
| `src/engine/cost.ts` | rewrite | `Prices.boring`, Barrenado cost line, `hardwareText` labels |
| `src/engine/templates/bookshelf.ts`, `side-table.ts` | modify | `fittings: []`, `boring: []` |
| `src/engine/parts/door.ts` | create | `hingeCount`, `doorWidth`, `doorSet` |
| `src/engine/templates/closet.ts` | create | "Clóset modular" template |
| `src/engine/index.ts` | modify | export the door block and closet; register the closet |
| `src/engine/*.test.ts`, `templates/*.test.ts`, `parts/door.test.ts` | modify/create | tests |
| `src/state/store.ts` | modify | `setBoringPrice` |
| `src/components/Viewer3D.tsx` | modify | draw fittings |
| `src/components/StepsPanel.tsx` | modify | fitting labels |
| `src/components/OrderPanel.tsx` | modify | Barrenado table, boring price, `hardwareText` |
| `src/components/PrintReport.tsx` | modify | Barrenado table, "Herrajes", `hardwareText` |
| `src/components/CutDiagram.tsx` | modify | "Herrajes", `hardwareText` |
| `src/components/labels.ts` | delete | its only export (`HARDWARE_LABELS`) is no longer used |
| `mobile/src/components/viewer-3d.tsx` | modify | draw fittings |
| `mobile/src/screens/result/steps.tsx` | modify | fitting labels |
| `mobile/src/screens/result/cuts.tsx` | modify | `hardwareText` |
| `mobile/src/app/templates.tsx` | modify | `KIND.closet` |
| `CLAUDE.md` | modify | conventions + Phase 5 status |

---

### Task 1: Engine data model — fittings, boring, hardware text, order and cost

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/labels.ts`
- Rewrite: `src/engine/order.ts`
- Rewrite: `src/engine/cost.ts`
- Modify: `src/engine/templates/bookshelf.ts`, `src/engine/templates/side-table.ts`
- Test: `src/engine/order.test.ts`, `src/engine/cost.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces, used by Tasks 2–5:
  - types:
    - `Hardware.type` gains `'hinge' | 'handle' | 'rod' | 'rod-support'`, plus optional `cutTo`;
    - `interface Fitting { id; instance; label; position: Vec3; size: Vec3 }`;
    - `interface Boring { panelId; kind: 'hinge-cup'; diameter; depth; fromEdge; along: number[] }`;
    - `Design.fittings: Fitting[]`, `Design.boring: Boring[]`;
    - `interface OrderBoring { n; label; qty; diameter; depth; fromEdge; along }`, `Order.boring: OrderBoring[]`;
    - `Prices.boring: number`.
  - functions:
    - `hardwareText(h: Hardware): string` in `labels.ts`;
    - `boringHoles(boring: OrderBoring[]): number` in `order.ts`.
  - cost line: `{ key: 'boring', label: 'Barrenado de bisagra', unit: 'perforación' }`.

- [ ] **Step 1: Write the failing tests**

In `src/engine/order.test.ts`, change the import lines at the top to:

```ts
import { describe, expect, it } from 'vitest';
import { buildOrder, orderText } from './order.ts';
import { hardwareText } from './labels.ts';
import { nest } from './nesting.ts';
import { bookshelf } from './templates/bookshelf.ts';
import { sideTable } from './templates/side-table.ts';
import type { Boring, Template } from './types.ts';
```

and append at the end of the file:

```ts
describe('hardwareText', () => {
  it('names the hardware and its size', () => {
    expect(hardwareText({ type: 'confirmat', size: '5x50', qty: 20 })).toBe('Tornillo confirmat 5x50');
  });

  it('adds the cut length of items cut to size', () => {
    expect(hardwareText({ type: 'rod', size: '15×30 mm', qty: 1, cutTo: 762 })).toBe(
      'Tubo oval para clóset 15×30 mm, cortado a 762 mm',
    );
  });
});

const SIDE_CUPS: Boring = { panelId: 'side', kind: 'hinge-cup', diameter: 35, depth: 12, fromEdge: 22, along: [100, 600, 1100] };

function drilledBookshelf() {
  const result = bookshelf.generate({});
  if (!result.ok) throw new Error('bookshelf must validate');
  const design = { ...result.design, boring: [SIDE_CUPS] };
  return buildOrder(design, nest(design.panels), 'Librero');
}

describe('boring in the order', () => {
  it('lists none for designs without holes', () => {
    expect(orderFor(bookshelf).boring).toEqual([]);
    expect(orderText(orderFor(bookshelf))).not.toContain('Barrenado');
  });

  it('points the yard at the drilled piece by its order line', () => {
    expect(drilledBookshelf().boring).toEqual([
      { n: 1, label: 'Lateral', qty: 2, diameter: 35, depth: 12, fromEdge: 22, along: [100, 600, 1100] },
    ]);
  });

  it('writes each drilled piece and the total holes into the text', () => {
    const text = orderText(drilledBookshelf());
    expect(text).toContain(
      'Barrenado para bisagra de 35 mm: pieza 1 (×2), 3 perforaciones cada una a 100 · 600 · 1100 mm desde arriba, ' +
        'centro a 22 mm del canto, 12 mm de profundidad.',
    );
    expect(text).toContain('Total de perforaciones: 6.');
  });
});
```

In `src/engine/cost.test.ts`:

- Change the imports at the top to:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { EMPTY_PRICES, hardwareKey, missingPricesText, normalizePrices, orderCost, type Prices } from './cost.ts';
  import { buildOrder } from './order.ts';
  import { nest } from './nesting.ts';
  import { bookshelf } from './templates/bookshelf.ts';
  import type { Boring } from './types.ts';
  ```

- Add `boring: 5,` as the last field of the `FULL` constant.
- Change the `'starts with no prices'` expectation to:

  ```ts
  expect(EMPTY_PRICES).toEqual({ sheets: {}, cut: { unit: 'meter', price: 0 }, bands: {}, hardware: {}, boring: 0 });
  ```

- In `'round-trips a full valid object unchanged'`, add `boring: 7,` as the last field of the `full` literal.
- Append at the end of the file:

  ```ts
  describe('boring cost', () => {
    const cups: Boring = { panelId: 'side', kind: 'hinge-cup', diameter: 35, depth: 12, fromEdge: 22, along: [100, 600, 1100] };

    function drilled() {
      const result = bookshelf.generate({});
      if (!result.ok) throw new Error('bookshelf must validate');
      const design = { ...result.design, boring: [cups] };
      return buildOrder(design, nest(design.panels), 'Librero');
    }

    it("prices the yard's hinge drilling per hole, right after cutting", () => {
      const lines = orderCost(drilled(), FULL).lines;
      expect(lines.map((l) => l.key).slice(2, 4)).toEqual(['cut', 'boring']);
      expect(lines.find((l) => l.key === 'boring')).toEqual({
        key: 'boring',
        label: 'Barrenado de bisagra',
        qty: 6, // 2 sides × 3 cups
        unit: 'perforación',
        price: 5,
        subtotal: 30,
      });
    });

    it('counts the drilling as missing until it has a price', () => {
      const { lines, missing } = orderCost(drilled(), { ...FULL, boring: 0 });
      expect(lines.find((l) => l.key === 'boring')!.price).toBeNull();
      expect(missing).toBe(1);
    });

    it('has no drilling line without holes', () => {
      expect(orderCost(order(), FULL).lines.some((l) => l.key === 'boring')).toBe(false);
    });

    it('defaults a missing stored boring price to 0', () => {
      expect(normalizePrices({ sheets: { 3: 950 } }).boring).toBe(0);
      expect(normalizePrices({ boring: 'x' }).boring).toBe(0);
      expect(normalizePrices({ boring: 4.5 }).boring).toBe(4.5);
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/engine/order.test.ts src/engine/cost.test.ts`

Expected: FAIL. `hardwareText` is not exported, `boring` is undefined on `Order`, and `EMPTY_PRICES` lacks `boring`.

- [ ] **Step 3: Extend the types**

In `src/engine/types.ts`, replace the `Hardware` interface with:

```ts
export interface Hardware {
  type: 'screw' | 'dowel' | 'confirmat' | 'hinge' | 'handle' | 'rod' | 'rod-support';
  size: string; // '4x40', '5x50', '35 mm recta'
  qty: number;
  cutTo?: number; // mm, for items bought by length and cut to size (the closet rod)
}
```

Directly after the `Placement` interface, add:

```ts
/** A non-cut part drawn in 3D (rod, handle): an axis-aligned box like a Placement, never in cut lists. */
export interface Fitting {
  id: string; // 'rod', 'handle'; a step may name it in panelRefs
  instance: number;
  label: string; // Spanish
  position: Vec3; // box center
  size: Vec3;
}

/** Holes a panel needs before assembly — today only 35 mm hinge cups, drilled by the lumber yard. */
export interface Boring {
  panelId: string;
  kind: 'hinge-cup';
  diameter: number; // mm
  depth: number; // mm
  fromEdge: number; // mm, cup center from the hinge-side long edge
  along: number[]; // mm from the panel's top end, one per cup
}
```

In the `Step` interface, change the `panelRefs` line to:

```ts
  panelRefs: string[]; // Panel.id[] — or a Fitting.id, which viewers highlight the same way
```

In the `Design` interface, add after `hardware: Hardware[];`:

```ts
  fittings: Fitting[]; // non-cut parts drawn in 3D (rod, handles)
  boring: Boring[]; // holes the lumber yard drills (hinge cups)
```

- [ ] **Step 4: Add the labels and `hardwareText`**

Replace the whole of `src/engine/labels.ts` with:

```ts
import type { Hardware } from './types.ts';

/**
 * Spanish display names for hardware types. Lives in the engine rather than in a
 * client because both the web app and the native app need the same words, and
 * the engine already owns the other user-facing copy (template names, validation
 * messages). Still no DOM/React here — it is only a lookup table.
 */
export const HARDWARE_LABELS: Record<Hardware['type'], string> = {
  confirmat: 'Tornillo confirmat',
  screw: 'Tornillo',
  dowel: 'Taquete',
  hinge: 'Bisagra de cazoleta',
  handle: 'Jaladera',
  rod: 'Tubo oval para clóset',
  'rod-support': 'Soporte de tubo',
};

/** One hardware line without its quantity, e.g. 'Tubo oval para clóset 15×30 mm, cortado a 762 mm'. */
export function hardwareText(h: Hardware): string {
  const text = `${HARDWARE_LABELS[h.type]} ${h.size}`;
  return h.cutTo === undefined ? text : `${text}, cortado a ${h.cutTo} mm`;
}
```

- [ ] **Step 5: Rewrite `src/engine/order.ts`**

Replace the whole file with:

```ts
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
```

- [ ] **Step 6: Rewrite `src/engine/cost.ts`**

Replace the whole file with:

```ts
import { hardwareText } from './labels.ts';
import { boringHoles, type Order } from './order.ts';
import type { Hardware } from './types.ts';

/** User-entered prices in MXN. Never a price database — nothing here ships with values. */
export interface Prices {
  sheets: Record<number, number>; // Stock.id → per sheet
  cut: { unit: 'meter' | 'cut'; price: number }; // per meter of cut, or per cut
  bands: Record<string, number>; // band label → per meter
  hardware: Record<string, number>; // hardwareKey → per piece
  boring: number; // per hinge-cup hole the yard drills
}

export const EMPTY_PRICES: Prices = {
  sheets: {},
  cut: { unit: 'meter', price: 0 },
  bands: {},
  hardware: {},
  boring: 0,
};

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
  const s = stored as { sheets?: unknown; cut?: unknown; bands?: unknown; hardware?: unknown; boring?: unknown };
  const rawCut = typeof s.cut === 'object' && s.cut !== null ? (s.cut as { unit?: unknown; price?: unknown }) : {};
  const unit = rawCut.unit === 'meter' || rawCut.unit === 'cut' ? rawCut.unit : EMPTY_PRICES.cut.unit;
  const price = typeof rawCut.price === 'number' && Number.isFinite(rawCut.price) ? rawCut.price : EMPTY_PRICES.cut.price;
  return {
    sheets: pickFiniteNumbers<number>(s.sheets),
    cut: { unit, price },
    bands: pickFiniteNumbers<string>(s.bands),
    hardware: pickFiniteNumbers<string>(s.hardware),
    boring: typeof s.boring === 'number' && Number.isFinite(s.boring) ? s.boring : EMPTY_PRICES.boring,
  };
}

export interface CostLine {
  key: string; // `sheet:{id}` | 'cut' | 'boring' | `band:{label}` | `hw:{hardwareKey}`
  label: string;
  qty: number;
  unit: string; // 'hoja' | 'm' | 'corte' | 'perforación' | 'pza'
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
    ...(order.boring.length > 0
      ? [line('boring', 'Barrenado de bisagra', boringHoles(order.boring), 'perforación', prices.boring)]
      : []),
    ...order.bands.map((b) => line(`band:${b.label}`, b.label, b.meters, 'm', prices.bands[b.label])),
    ...order.hardware.map((h) =>
      line(`hw:${hardwareKey(h)}`, hardwareText(h), h.qty, 'pza', prices.hardware[hardwareKey(h)]),
    ),
  ];
  return {
    lines,
    total: lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0),
    missing: lines.filter((l) => l.price === null).length,
  };
}
```

- [ ] **Step 7: Give the existing templates empty fittings and boring**

In both `src/engine/templates/bookshelf.ts` and `src/engine/templates/side-table.ts`, in the `const design: Design = { … }` literal, insert these two lines directly before the existing `    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),` line:

```ts
    fittings: [],
    boring: [],
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run src/engine/order.test.ts src/engine/cost.test.ts`

Expected: PASS.

Then run `pnpm test` and `pnpm typecheck`. Expected: all green. The web still uses `HARDWARE_LABELS` until Task 4, which still compiles.

Then in `mobile/` run `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/labels.ts src/engine/order.ts src/engine/cost.ts src/engine/templates/bookshelf.ts src/engine/templates/side-table.ts src/engine/order.test.ts src/engine/cost.test.ts
git commit -m "feat(engine): add fittings, hinge boring and hardware text to designs and orders"
```

(Add the `Co-Authored-By:` trailer from Global Constraints.)

---

### Task 2: Door building block

**Files:**
- Create: `src/engine/parts/door.ts`
- Create: `src/engine/parts/door.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes (Task 1): `Fitting`, `Boring`, and the `Hardware` types `'hinge' | 'handle'`.
- Produces, used by Task 3:
  - `hingeCount(doorHeight: number): number`
  - `doorWidth(count: 1 | 2, width: number): number`
  - `interface DoorSetOptions { count: 0 | 1 | 2; width; bottom; top; frontZ; stock: Stock; mode: EdgeBandingMode }`
  - `interface DoorSet { panels; placements; hardware; fittings; boring; steps: Omit<Step, 'order'>[] }`
  - `doorSet(o: DoorSetOptions): DoorSet`
  - The panel id is `'door'`, the fitting id is `'handle'`, and all are exported from `src/engine/index.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/parts/door.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { doorSet, doorWidth, hingeCount, type DoorSetOptions } from './door.ts';
import { getStock } from '../stock.ts';
import { NO_EDGES } from '../edge-banding.ts';

const PLY18 = getStock(3);
// The default closet front: 800 wide, from the 70 mm zoclo to 2000 mm, case front at z = 275.
const BASE: DoorSetOptions = { count: 2, width: 800, bottom: 70, top: 2000, frontZ: 275, stock: PLY18, mode: 'yard' };

describe('hingeCount', () => {
  it('adds a hinge past 900, 1600 and 2000 mm of door height', () => {
    expect([900, 901, 1600, 1601, 2000, 2001].map(hingeCount)).toEqual([2, 3, 3, 4, 4, 5]);
  });
});

describe('doorWidth', () => {
  it('leaves 2 mm at the outer edges and 3 mm between a pair', () => {
    expect(doorWidth(1, 600)).toBe(596);
    expect(doorWidth(2, 800)).toBe(396); // ⌊793 / 2⌋
  });
});

describe('doorSet', () => {
  it('cuts the doors 4 mm shorter than the covered front, banded all round', () => {
    expect(doorSet(BASE).panels).toEqual([
      {
        id: 'door',
        label: 'Puerta',
        length: 1926,
        width: 396,
        stock: PLY18,
        grain: 'length',
        edges: { L1: true, L2: true, A1: true, A2: true },
        qty: 2,
      },
    ]);
    expect(doorSet({ ...BASE, mode: 'none' }).panels[0]!.edges).toEqual(NO_EDGES);
  });

  it('spaces the hinge cups evenly, 100 mm in from each end', () => {
    expect(doorSet(BASE).boring).toEqual([
      { panelId: 'door', kind: 'hinge-cup', diameter: 35, depth: 12, fromEdge: 22, along: [100, 675, 1251, 1826] },
    ]);
    expect(doorSet({ ...BASE, top: 900 }).boring[0]!.along).toEqual([100, 726]); // 826 mm door: 2 hinges
  });

  it('buys one hinge per cup and one handle per door', () => {
    expect(doorSet(BASE).hardware).toEqual([
      { type: 'hinge', size: '35 mm recta', qty: 8 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
    expect(doorSet({ ...BASE, count: 1, width: 500 }).hardware.map((h) => h.qty)).toEqual([4, 1]);
  });

  it('draws the doors swung open 90°, standing in front of their sides', () => {
    expect(doorSet(BASE).placements).toEqual([
      { panelId: 'door', instance: 0, position: [-391, 1035, 473], size: [18, 1926, 396] },
      { panelId: 'door', instance: 1, position: [391, 1035, 473], size: [18, 1926, 396] },
    ]);
    expect(doorSet({ ...BASE, count: 1, width: 500 }).placements).toEqual([
      { panelId: 'door', instance: 0, position: [-241, 1035, 523], size: [18, 1926, 496] },
    ]);
  });

  it('puts a handle on each open door, 1050 mm up and 40 mm from its closing edge', () => {
    expect(doorSet(BASE).fittings).toEqual([
      { id: 'handle', instance: 0, label: 'Jaladera', position: [-415, 1050, 631], size: [30, 160, 12] },
      { id: 'handle', instance: 1, label: 'Jaladera', position: [415, 1050, 631], size: [30, 160, 12] },
    ]);
  });

  it("keeps a short door's handle 100 mm inside it", () => {
    // door from 72 to 898 mm → handle clamped down to 798
    expect(doorSet({ ...BASE, top: 900 }).fittings[0]!.position[1]).toBe(798);
  });

  it('gives the plate heights from the floor and the DIY drilling fallback', () => {
    const [plates, hang, handles] = doorSet(BASE).steps;
    expect(plates!.title).toBe('Monta las placas');
    expect(plates!.description).toContain('de cada lateral, a 37 mm del frente, a 172 · 747 · 1323 · 1898 mm del piso.');
    expect(plates!.description).toContain('broca Forstner de 35 mm, 12 mm de profundidad, centro a 22 mm del canto.');
    expect(hang).toMatchObject({ title: 'Cuelga las puertas', panelRefs: ['door'], explodeOffsets: { door: [0, 0, 150] } });
    expect(hang!.description).toContain('2 mm de luz alrededor y 3 mm entre las puertas.');
    expect(handles).toMatchObject({ title: 'Pon las jaladeras', panelRefs: ['door', 'handle'] });
    expect(handles!.description).toContain('separados 128 mm, a 40 mm del canto que cierra y centrados a 1050 mm del piso');
  });

  it('words a single door in the singular, hinged on the left side', () => {
    const steps = doorSet({ ...BASE, count: 1, width: 500 }).steps;
    expect(steps.map((s) => s.title)).toEqual(['Monta las placas', 'Cuelga la puerta', 'Pon la jaladera']);
    expect(steps[0]!.description).toContain('del lateral izquierdo');
    expect(steps[1]!.description).not.toContain('entre las puertas');
  });

  it('returns nothing without doors', () => {
    expect(doorSet({ ...BASE, count: 0 })).toEqual({
      panels: [],
      placements: [],
      hardware: [],
      fittings: [],
      boring: [],
      steps: [],
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/engine/parts/door.test.ts`

Expected: FAIL, because it cannot resolve `./door.ts`.

- [ ] **Step 3: Implement `src/engine/parts/door.ts`**

```ts
import { bandEdges } from '../edge-banding.ts';
import type {
  Boring,
  EdgeBandingMode,
  Fitting,
  Hardware,
  Panel,
  Placement,
  Step,
  Stock,
  Vec3,
} from '../types.ts';

const GAP = 2; // mm around a door's outer edges
const PAIR_GAP = 3; // mm between the two doors of a pair
const HINGE_END = 100; // mm from each door end to its outer hinge cups
const CUP = { diameter: 35, depth: 12, fromEdge: 22 }; // mm, the standard 35 mm cup-hinge boring
const PLATE_SETBACK = 37; // mm from a side's front edge to the hinge plate
const HANDLE_SPACING = 128; // mm between a bar handle's screws
const HANDLE_HEIGHT = 1050; // mm from the floor to a handle's center
const HANDLE_FROM_EDGE = 40; // mm from the door's closing edge
const HANDLE_BOX: Vec3 = [30, 160, 12]; // mm; sticks 30 mm out of the open door's outer face

export interface DoorSetOptions {
  count: 0 | 1 | 2;
  width: number; // outer width of the case front the doors cover
  bottom: number; // y where the covered front starts
  top: number; // y where it ends
  frontZ: number; // z of the case front
  stock: Stock;
  mode: EdgeBandingMode;
}

/** A design fragment a template merges with its own parts. */
export interface DoorSet {
  panels: Panel[];
  placements: Placement[];
  hardware: Hardware[];
  fittings: Fitting[];
  boring: Boring[];
  steps: Omit<Step, 'order'>[];
}

/** Cup hinges per door by its height, the usual rule for 35 mm hinges. */
export function hingeCount(doorHeight: number): number {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

/** Width of each full-overlay door when `count` doors cover a case front `width` wide. */
export function doorWidth(count: 1 | 2, width: number): number {
  return count === 1 ? width - 2 * GAP : Math.floor((width - 2 * GAP - PAIR_GAP) / 2);
}

/**
 * Full-overlay doors on 35 mm cup hinges, drilled by the lumber yard. Doors are drawn swung
 * open 90° so the interior stays visible: each stands in front of its side, sticking out
 * forward. A single door hinges on the left. The block does not validate — templates do.
 */
export function doorSet(o: DoorSetOptions): DoorSet {
  if (o.count === 0) return { panels: [], placements: [], hardware: [], fittings: [], boring: [], steps: [] };

  const t = o.stock.thickness;
  const h = o.top - o.bottom - 2 * GAP;
  const w = doorWidth(o.count, o.width);
  const k = hingeCount(h);
  const along = Array.from({ length: k }, (_, i) => Math.round(HINGE_END + (i * (h - 2 * HINGE_END)) / (k - 1)));
  const doorBottom = o.bottom + GAP;
  const doorTop = doorBottom + h;
  const plates = along.map((a) => doorTop - a).sort((a, b) => a - b);
  const handleY = Math.min(Math.max(HANDLE_HEIGHT, doorBottom + 100), doorTop - 100);
  const pair = o.count === 2;
  const sides = pair ? [-1, 1] : [-1]; // −1 = hinged on the left

  const placements: Placement[] = sides.map((s, i): Placement => ({
    panelId: 'door',
    instance: i,
    position: [s * (o.width / 2 - t / 2), doorBottom + h / 2, o.frontZ + w / 2],
    size: [t, h, w],
  }));
  const fittings: Fitting[] = sides.map((s, i): Fitting => ({
    id: 'handle',
    instance: i,
    label: 'Jaladera',
    position: [s * (o.width / 2 + HANDLE_BOX[0] / 2), handleY, o.frontZ + w - HANDLE_FROM_EDGE],
    size: [...HANDLE_BOX],
  }));

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Monta las placas',
      description:
        `Atornilla las placas de las bisagras en la cara interior ${pair ? 'de cada lateral' : 'del lateral izquierdo'}, ` +
        `a ${PLATE_SETBACK} mm del frente, a ${plates.join(' · ')} mm del piso. ` +
        `Las puertas vienen barrenadas de la maderería; si las barrenas tú: broca Forstner de ${CUP.diameter} mm, ` +
        `${CUP.depth} mm de profundidad, centro a ${CUP.fromEdge} mm del canto.`,
      panelRefs: ['door'],
    },
    {
      title: pair ? 'Cuelga las puertas' : 'Cuelga la puerta',
      description:
        'Engancha cada bisagra en su placa y ajústala con sus tornillos (lado, fondo y altura) hasta dejar ' +
        `${GAP} mm de luz alrededor${pair ? ` y ${PAIR_GAP} mm entre las puertas` : ''}.`,
      panelRefs: ['door'],
      explodeOffsets: { door: [0, 0, 150] },
    },
    {
      title: pair ? 'Pon las jaladeras' : 'Pon la jaladera',
      description:
        `Barrena 2 agujeros de 5 mm separados ${HANDLE_SPACING} mm, a ${HANDLE_FROM_EDGE} mm del canto que cierra ` +
        `y centrados a ${Math.round(handleY)} mm del piso, y atornilla ${pair ? 'cada jaladera' : 'la jaladera'}.`,
      panelRefs: ['door', 'handle'],
    },
  ];

  return {
    panels: [
      {
        id: 'door',
        label: 'Puerta',
        length: h,
        width: w,
        stock: o.stock,
        grain: 'length',
        edges: bandEdges(o.mode, 'L1', 'L2', 'A1', 'A2'),
        qty: o.count,
      },
    ],
    placements,
    hardware: [
      { type: 'hinge', size: '35 mm recta', qty: o.count * k },
      { type: 'handle', size: `${HANDLE_SPACING} mm`, qty: o.count },
    ],
    fittings,
    boring: [{ panelId: 'door', kind: 'hinge-cup', ...CUP, along }],
    steps,
  };
}
```

- [ ] **Step 4: Export the block**

In `src/engine/index.ts`, add after `export * from './cost.ts';`:

```ts
export * from './parts/door.ts';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/engine/parts/door.test.ts`, then `pnpm test` and `pnpm typecheck`.

Expected: all PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/parts/door.ts src/engine/parts/door.test.ts src/engine/index.ts
git commit -m "feat(engine): add a full-overlay door block with cup hinges and handles"
```

(Add the `Co-Authored-By:` trailer.)

---

### Task 3: Closet template

**Files:**
- Create: `src/engine/templates/closet.ts`
- Create: `src/engine/templates/closet.test.ts`
- Modify: `src/engine/index.ts`
- Modify: `src/engine/templates/templates.test.ts`
- Modify: `src/engine/order.test.ts`

**Interfaces:**
- Consumes:
  - from Task 2: `doorSet`, `doorWidth`, `DoorSet`;
  - from Task 1: `Fitting`, `Design.fittings/boring`, `orderText`'s Barrenado lines, `hardwareText`.
- Produces, used by Tasks 4–5:
  - `closet: Template` with id `'closet'` and name `'Clóset modular'`;
  - `generateCloset(raw)`;
  - registered in `templates` as `[bookshelf, sideTable, closet]`;
  - the rod fitting has id `'rod'`, label `'Tubo'`.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/templates/closet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { closet } from './closet.ts';
import { nest } from '../nesting.ts';
import { FIBRACEL_3, MATERIAL_OPTIONS } from '../stock.ts';
import type { Design, TemplateParams, ValidationIssue } from '../types.ts';

function designOf(params: TemplateParams = {}): Design {
  const result = closet.generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.design;
}

function issuesOf(params: TemplateParams): ValidationIssue[] {
  const result = closet.generate(params);
  if (result.ok) throw new Error('expected validation issues');
  return result.issues;
}

const ids = (d: Design) => d.panels.map((p) => p.id);
const shelfYs = (d: Design) => d.placements.filter((p) => p.panelId === 'shelf').map((p) => p.position[1]);

describe('closet', () => {
  it('builds the default Mixto module with two doors', () => {
    const d = designOf();
    expect(d.panels.map((p) => [p.id, p.label, p.length, p.width, p.qty])).toEqual([
      ['side', 'Lateral', 2000, 547, 2],
      ['top', 'Tapa', 764, 547, 1],
      ['bottom', 'Base', 764, 547, 1],
      ['plinth', 'Zoclo', 764, 70, 1],
      ['hat-shelf', 'Maletero', 764, 547, 1],
      ['shelf', 'Entrepaño', 764, 547, 3],
      ['door', 'Puerta', 1926, 396, 2],
      ['back', 'Fondo', 2000, 800, 1],
    ]);
    expect(d.panels.find((p) => p.id === 'back')!.stock).toBe(FIBRACEL_3);
  });

  it('stands the case on a zoclo flush with the front', () => {
    const d = designOf();
    expect(d.placements.find((p) => p.panelId === 'plinth')).toEqual({
      panelId: 'plinth',
      instance: 0,
      position: [0, 35, 266],
      size: [764, 70, 18],
    });
    expect(d.placements.find((p) => p.panelId === 'bottom')!.position[1]).toBe(79); // rests on the zoclo
  });

  it('leaves 350 mm for luggage and hangs the rod 50 mm under the Maletero', () => {
    const d = designOf();
    expect(d.placements.find((p) => p.panelId === 'hat-shelf')!.position[1]).toBe(1623); // top face 1632
    expect(d.fittings.find((f) => f.id === 'rod')).toEqual({
      id: 'rod',
      instance: 0,
      label: 'Tubo',
      position: [0, 1564, 1.5],
      size: [762, 30, 15],
    });
  });

  it('closes a 1000 mm hanging zone with a shelf and spaces the rest below it (Mixto)', () => {
    const ys = shelfYs(designOf());
    expect(ys).toHaveLength(3);
    expect(ys[0]).toBeCloseTo(237.67, 1); // Base top face 88 + gap 140.67 + half a shelf
    expect(ys[1]).toBeCloseTo(396.33, 1);
    expect(ys[2]).toBe(555); // top face 564 = rod 1564 − 1000
  });

  it('spaces shelves evenly with no Maletero or rod (Entrepaños)', () => {
    const d = designOf({ interior: 2 });
    expect(ids(d)).not.toContain('hat-shelf');
    expect(shelfYs(d)).toEqual([557, 1035, 1513]); // gaps of 460
    expect(d.fittings.map((f) => f.id)).toEqual(['handle', 'handle']);
    expect(d.hardware.some((h) => h.type === 'rod')).toBe(false);
  });

  it('hangs clothes under the Maletero with no shelves (Colgar)', () => {
    const d = designOf({ interior: 1 });
    expect(ids(d)).toContain('hat-shelf');
    expect(ids(d)).not.toContain('shelf');
    expect(d.fittings.map((f) => f.id)).toEqual(['rod', 'handle', 'handle']);
  });

  it('buys the screws, the rod cut to size, hinges and handles', () => {
    expect(designOf().hardware).toEqual([
      { type: 'confirmat', size: '5x50', qty: 26 }, // (Tapa, Base, Maletero, 3 entrepaños)·4 + zoclo 2
      { type: 'screw', size: '3.5x16', qty: 44 }, // ⌈2·(800+2000)/200⌉ + 4·⌈764/200⌉ = 28 + 16
      { type: 'rod', size: '15×30 mm', qty: 1, cutTo: 762 },
      { type: 'rod-support', size: '15×30 mm', qty: 2 },
      { type: 'hinge', size: '35 mm recta', qty: 8 },
      { type: 'handle', size: '128 mm', qty: 2 },
    ]);
  });

  it('asks the yard to drill the doors, and draws them open 90°', () => {
    const d = designOf();
    expect(d.boring).toEqual([
      { panelId: 'door', kind: 'hinge-cup', diameter: 35, depth: 12, fromEdge: 22, along: [100, 675, 1251, 1826] },
    ]);
    expect(d.placements.filter((p) => p.panelId === 'door').map((p) => p.position)).toEqual([
      [-391, 1035, 473],
      [391, 1035, 473],
    ]);
  });

  it('marks the pieces, warns about the diagonal and places the rod', () => {
    const steps = designOf().steps;
    expect(steps.map((s) => [s.order, s.title])).toEqual([
      [1, 'Prepara y marca'],
      [2, 'Arma la caja acostada'],
      [3, 'Instala el maletero y los entrepaños'],
      [4, 'Verifica la escuadra y coloca el fondo'],
      [5, 'Pon el tubo'],
      [6, 'Monta las placas'],
      [7, 'Cuelga las puertas'],
      [8, 'Pon las jaladeras'],
    ]);
    expect(steps[0]!.description).toContain(
      'Marca en los laterales la cara de abajo de cada pieza: base a 70 mm, entrepaños a 229 · 387 · 546 mm, maletero a 1614 mm.',
    );
    expect(steps[1]!.description).toContain('su diagonal, que mide 2075 mm: revisa que libre tu techo.');
    expect(steps[3]!.description).toContain('al contorno, al maletero y a cada entrepaño.');
    expect(steps[4]).toMatchObject({ panelRefs: ['rod'], explodeOffsets: { rod: [0, 0, 200] } });
    expect(steps[4]!.description).toContain('a 1564 mm del piso y a 274 mm del frente');
    expect(steps[4]!.description).toContain('Corta el tubo a 762 mm');
  });

  it('adds the ironing step when banding at home', () => {
    expect(designOf({ edgeBanding: 2 }).steps[1]!.title).toBe('Aplica el cubrecanto');
  });

  it('drops the door parts and steps without doors', () => {
    const d = designOf({ doors: 0 });
    expect(ids(d)).not.toContain('door');
    expect(d.steps.at(-1)!.title).toBe('Pon el tubo');
    expect(d.hardware.some((h) => h.type === 'hinge' || h.type === 'handle')).toBe(false);
    expect(d.fittings.map((f) => f.id)).toEqual(['rod']);
  });
});

describe('closet validation', () => {
  it('rejects a span over the material limit', () => {
    expect(issuesOf({ width: 1000 })).toEqual([
      {
        paramKey: 'width',
        message:
          'El claro de 964 mm supera el máximo seguro de 800 mm para triplay de pino 18 mm. ' +
          'Reduce el ancho o elige un material más grueso.',
      },
    ]);
  });

  it('needs 500 mm of depth to hang clothes', () => {
    expect(issuesOf({ depth: 450 })).toEqual([
      {
        paramKey: 'depth',
        message:
          'Para colgar ropa el clóset necesita al menos 500 mm de fondo (un gancho mide unos 450 mm). ' +
          'Aumenta la profundidad o elige Entrepaños.',
      },
    ]);
    expect(closet.generate({ depth: 450, interior: 2 }).ok).toBe(true);
  });

  it('needs 1000 mm under the rod (Colgar)', () => {
    expect(issuesOf({ interior: 1, height: 1500 })).toEqual([
      {
        paramKey: 'height',
        message: 'Bajo el tubo quedan 976 mm y la ropa necesita al menos 1000 mm. Aumenta el alto o elige Entrepaños.',
      },
    ]);
  });

  it('needs room for the hanging zone and a space below it (Mixto)', () => {
    expect(issuesOf({ height: 1600 })).toEqual([
      {
        paramKey: 'height',
        message: 'No caben la zona de colgar de 1000 mm y un espacio útil debajo. Aumenta el alto o elige Colgar.',
      },
    ]);
  });

  it('rejects shelves packed closer than 100 mm', () => {
    expect(issuesOf({ shelfCount: 4, height: 1800 })).toEqual([
      {
        paramKey: 'shelfCount',
        message:
          'No caben 4 entrepaños: quedarían espacios de 51 mm y el mínimo útil es 100 mm. ' +
          'Reduce los entrepaños o aumenta el alto.',
      },
    ]);
  });

  it('limits one door to 600 mm and two doors to 200 mm each', () => {
    expect(issuesOf({ doors: 1, width: 700 })).toEqual([
      {
        paramKey: 'doors',
        message: 'Una sola puerta de 696 mm pesa y se descuadra; el máximo es 600 mm. Usa dos puertas.',
      },
    ]);
    expect(issuesOf({ doors: 2, width: 400 })).toEqual([
      { paramKey: 'doors', message: 'Dos puertas quedarían de 196 mm y el mínimo es 200 mm. Usa una puerta.' },
    ]);
  });
});

describe('closet sheet fit', () => {
  it('nests every valid module across the param range', () => {
    let valid = 0;
    for (const material of MATERIAL_OPTIONS.map((o) => o.value))
      for (const width of [400, 500, 700, 830])
        for (const height of [1200, 1800, 2400])
          for (const depth of [400, 650])
            for (const interior of [1, 2, 3])
              for (const shelfCount of [1, 8])
                for (const doors of [0, 1, 2]) {
                  const result = closet.generate({ material, width, height, depth, interior, shelfCount, doors });
                  if (!result.ok) continue;
                  valid++;
                  expect(() => nest(result.design.panels)).not.toThrow();
                }
    expect(valid).toBeGreaterThan(100);
  });
});
```

In `src/engine/templates/templates.test.ts`:

- Add `import { closet } from './closet.ts';` after the `sideTable` import.
- Change `for (const template of [bookshelf, sideTable]) {` (the shared-invariants loop, the first `for` in the file) to `for (const template of [bookshelf, sideTable, closet]) {`.
- Replace the test `'steps and explode offsets reference existing panel ids'` with:

  ```ts
      it('steps and explode offsets reference existing panel or fitting ids', () => {
        const ids = new Set([...design.panels.map((p) => p.id), ...design.fittings.map((f) => f.id)]);
        for (const step of design.steps) {
          for (const ref of step.panelRefs) expect(ids.has(ref)).toBe(true);
          for (const key of Object.keys(step.explodeOffsets ?? {})) expect(ids.has(key)).toBe(true);
        }
      });

      it('bores only its own panels', () => {
        const ids = new Set(design.panels.map((p) => p.id));
        for (const b of design.boring) expect(ids.has(b.panelId)).toBe(true);
      });
  ```

In `src/engine/order.test.ts`, add `import { closet } from './templates/closet.ts';` after the `sideTable` import, and append:

```ts
describe('closet order', () => {
  it('asks the yard to drill the doors and cut the rod', () => {
    const text = orderText(orderFor(closet, {}, 'Clóset modular'));
    expect(text).toContain('7. Puerta — 1926 × 396 — 2 pzas — veta a lo largo — cubrecanto L1 L2 A1 A2');
    expect(text).toContain(
      'Barrenado para bisagra de 35 mm: pieza 7 (×2), 4 perforaciones cada una a 100 · 675 · 1251 · 1826 mm desde arriba, ' +
        'centro a 22 mm del canto, 12 mm de profundidad.',
    );
    expect(text).toContain('Total de perforaciones: 8.');
    expect(text).toContain('Tubo oval para clóset 15×30 mm, cortado a 762 mm × 1');
    expect(text).toContain('Bisagra de cazoleta 35 mm recta × 8');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/engine/templates src/engine/order.test.ts`

Expected: FAIL, because it cannot resolve `./closet.ts` / `./templates/closet.ts`.

- [ ] **Step 3: Implement `src/engine/templates/closet.ts`**

```ts
import type {
  Design,
  Fitting,
  GenerateResult,
  Hardware,
  Panel,
  ParamSpec,
  Placement,
  Step,
  Template,
  TemplateParams,
  ValidationIssue,
  Vec3,
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
import { doorSet, doorWidth } from '../parts/door.ts';

const PLINTH = 70; // mm, zoclo height: keeps mop water off the base
const LUGGAGE = 350; // mm clear between the Maletero and the Tapa
const ROD_DROP = 50; // mm from the Maletero's underside to the rod's center
const HANG_MIN = 1000; // mm of hanging space clothes need under the rod
const ROD_DEPTH_MIN = 500; // mm of depth a hanger needs (a hanger is about 450 mm wide)
const ROD_CLEARANCE = 2; // mm shorter than the inside width so the rod drops into its supports
const MIN_SHELF_GAP = 100; // mm of clear space between shelves
const BACK_SCREW_SPACING = 200; // mm between back screws
const MAX_SINGLE_DOOR = 600; // mm; a wider single door sags and racks
const MIN_DOOR = 200; // mm; a narrower door is useless

const INTERIOR_OPTIONS = [
  { value: 1, label: 'Colgar' },
  { value: 2, label: 'Entrepaños' },
  { value: 3, label: 'Mixto' },
];

const DOOR_OPTIONS = [
  { value: 0, label: 'Sin puertas' },
  { value: 1, label: 'Una' },
  { value: 2, label: 'Dos' },
];

const params: ParamSpec[] = [
  { kind: 'number', key: 'width', label: 'Ancho', unit: 'mm', min: 400, max: 1000, step: 10, default: 800 },
  { kind: 'number', key: 'height', label: 'Alto', unit: 'mm', min: 1200, max: 2400, step: 10, default: 2000 },
  { kind: 'number', key: 'depth', label: 'Profundidad', unit: 'mm', min: 400, max: 650, step: 10, default: 550 },
  { kind: 'select', key: 'interior', label: 'Interior', unit: '', options: INTERIOR_OPTIONS, default: 3 },
  { kind: 'number', key: 'shelfCount', label: 'Entrepaños', unit: '', min: 1, max: 8, step: 1, default: 3 },
  { kind: 'select', key: 'doors', label: 'Puertas', unit: '', options: DOOR_OPTIONS, default: 2 },
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

/** 'a, b y c' */
function spanishList(items: string[]): string {
  return items.length === 1 ? items[0]! : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/**
 * One closet module on a zoclo: sides, Tapa, Base, a Fibracel back, and an interior that
 * hangs clothes (Colgar: Maletero + rod), holds shelves (Entrepaños) or both (Mixto: Maletero
 * + rod over a 1000 mm short-hanging zone, shelves below). A wall is several modules side by
 * side. `depth` is the overall depth, back included, doors excluded.
 */
export function generateCloset(raw: TemplateParams): GenerateResult {
  const p = resolveParams(params, raw);
  const rangeIssues = paramIssues(params, p);
  if (rangeIssues.length > 0) return { ok: false, issues: rangeIssues };

  // resolveParams guarantees every spec key exists; paramIssues vetted the select values
  const W = p['width']!;
  const H = p['height']!;
  const D = p['depth']!;
  const interior = p['interior']!; // 1 Colgar, 2 Entrepaños, 3 Mixto
  const N = p['shelfCount']!;
  const doors = p['doors']! as 0 | 1 | 2;
  const stock = getStock(p['material']!);
  const mode = edgeBandingMode(p['edgeBanding']!);
  const t = stock.thickness;
  const tb = FIBRACEL_3.thickness;
  const Dc = D - tb; // case depth; the back makes up the rest
  const zc = tb / 2; // case center, shifted forward (+z) so the back sits behind it
  const span = W - 2 * t;
  const hasRod = interior !== 2;
  const shelves = interior === 1 ? 0 : N;
  const floor = PLINTH + t; // the Base's top face
  const hatBottom = H - t - LUGGAGE - t; // the Maletero's underside
  const rodY = hatBottom - ROD_DROP;
  const zoneTop = rodY - HANG_MIN; // Mixto: top face of the shelf that closes the hanging zone

  const issues: ValidationIssue[] = [];
  const spanProblem = spanIssue(span, stock);
  if (spanProblem) issues.push({ paramKey: 'width', message: spanProblem.message });
  if (hasRod && D < ROD_DEPTH_MIN) {
    issues.push({
      paramKey: 'depth',
      message:
        `Para colgar ropa el clóset necesita al menos ${ROD_DEPTH_MIN} mm de fondo (un gancho mide unos 450 mm). ` +
        'Aumenta la profundidad o elige Entrepaños.',
    });
  }
  if (interior === 1 && rodY - floor < HANG_MIN) {
    issues.push({
      paramKey: 'height',
      message:
        `Bajo el tubo quedan ${Math.round(rodY - floor)} mm y la ropa necesita al menos ${HANG_MIN} mm. ` +
        'Aumenta el alto o elige Entrepaños.',
    });
  }
  // Entrepaños spread over the whole inside; Mixto spreads N − 1 shelves under the zone's shelf.
  const gap =
    interior === 2 ? (H - PLINTH - 2 * t - N * t) / (N + 1) : (zoneTop - t - floor - (N - 1) * t) / N;
  if (interior === 3 && zoneTop - t - floor < MIN_SHELF_GAP) {
    issues.push({
      paramKey: 'height',
      message: `No caben la zona de colgar de ${HANG_MIN} mm y un espacio útil debajo. Aumenta el alto o elige Colgar.`,
    });
  } else if (interior !== 1 && gap < MIN_SHELF_GAP) {
    issues.push({
      paramKey: 'shelfCount',
      message:
        `No caben ${N} entrepaños: quedarían espacios de ${Math.max(0, Math.round(gap))} mm ` +
        `y el mínimo útil es ${MIN_SHELF_GAP} mm. Reduce los entrepaños o aumenta el alto.`,
    });
  }
  if (doors === 1 && doorWidth(1, W) > MAX_SINGLE_DOOR) {
    issues.push({
      paramKey: 'doors',
      message:
        `Una sola puerta de ${doorWidth(1, W)} mm pesa y se descuadra; el máximo es ${MAX_SINGLE_DOOR} mm. ` +
        'Usa dos puertas.',
    });
  }
  if (doors === 2 && doorWidth(2, W) < MIN_DOOR) {
    issues.push({
      paramKey: 'doors',
      message: `Dos puertas quedarían de ${doorWidth(2, W)} mm y el mínimo es ${MIN_DOOR} mm. Usa una puerta.`,
    });
  }
  if (issues.length > 0) return { ok: false, issues };

  // Shelf undersides, bottom to top.
  const shelfBottoms: number[] = [];
  if (interior === 2) for (let i = 1; i <= N; i++) shelfBottoms.push(floor + i * gap + (i - 1) * t);
  if (interior === 3) {
    for (let i = 1; i < N; i++) shelfBottoms.push(floor + i * gap + (i - 1) * t);
    shelfBottoms.push(zoneTop - t);
  }

  const door = doorSet({ count: doors, width: W, bottom: PLINTH, top: H, frontZ: D / 2, stock, mode });
  const rodLength = span - ROD_CLEARANCE;

  // Every panel fits a 1220 × 2440 sheet: H ≤ 2400, W ≤ 1000, Dc ≤ 647.
  const shelfPanel = (id: string, label: string, qty: number): Panel => ({
    id,
    label,
    length: span,
    width: Dc,
    stock,
    grain: 'length',
    edges: bandEdges(mode, 'L1'),
    qty,
  });
  const panels: Panel[] = [
    { id: 'side', label: 'Lateral', length: H, width: Dc, stock, grain: 'length', edges: bandEdges(mode, 'L1', 'A1'), qty: 2 },
    shelfPanel('top', 'Tapa', 1),
    shelfPanel('bottom', 'Base', 1),
    { id: 'plinth', label: 'Zoclo', length: span, width: PLINTH, stock, grain: 'length', edges: bandEdges(mode, 'L1'), qty: 1 },
    ...(hasRod ? [shelfPanel('hat-shelf', 'Maletero', 1)] : []),
    ...(shelves > 0 ? [shelfPanel('shelf', 'Entrepaño', shelves)] : []),
    ...door.panels,
    { id: 'back', label: 'Fondo', length: H, width: W, stock: FIBRACEL_3, grain: 'any', edges: NO_EDGES, qty: 1 },
  ];

  const flat = (panelId: string, instance: number, bottomY: number): Placement => ({
    panelId,
    instance,
    position: [0, bottomY + t / 2, zc],
    size: [span, t, Dc],
  });
  const placements: Placement[] = [
    { panelId: 'side', instance: 0, position: [-(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    { panelId: 'side', instance: 1, position: [(W - t) / 2, H / 2, zc], size: [t, H, Dc] },
    flat('top', 0, H - t),
    flat('bottom', 0, PLINTH),
    { panelId: 'plinth', instance: 0, position: [0, PLINTH / 2, D / 2 - t / 2], size: [span, PLINTH, t] },
    ...(hasRod ? [flat('hat-shelf', 0, hatBottom)] : []),
    ...shelfBottoms.map((y, i) => flat('shelf', i, y)),
    ...door.placements,
    { panelId: 'back', instance: 0, position: [0, H / 2, -D / 2 + tb / 2], size: [W, H, tb] },
  ];

  const rod: Fitting[] = hasRod
    ? [{ id: 'rod', instance: 0, label: 'Tubo', position: [0, rodY, zc], size: [rodLength, 30, 15] }]
    : [];

  const shelfLike = (hasRod ? 1 : 0) + shelves; // Maletero + Entrepaños
  const backScrews =
    Math.ceil((2 * (W + H)) / BACK_SCREW_SPACING) + shelfLike * Math.ceil(span / BACK_SCREW_SPACING);
  const rodHardware: Hardware[] = hasRod
    ? [
        { type: 'rod', size: '15×30 mm', qty: 1, cutTo: rodLength },
        { type: 'rod-support', size: '15×30 mm', qty: 2 },
      ]
    : [];
  const hardware: Hardware[] = [
    { type: 'confirmat', size: '5x50', qty: (2 + shelfLike) * 4 + 2 },
    { type: 'screw', size: '3.5x16', qty: backScrews },
    ...rodHardware,
    ...door.hardware,
  ];

  const marks = [
    `base a ${PLINTH} mm`,
    ...(shelfBottoms.length > 0 ? [`entrepaños a ${shelfBottoms.map((y) => Math.round(y)).join(' · ')} mm`] : []),
    ...(hasRod ? [`maletero a ${hatBottom} mm`] : []),
  ];
  const interiorIds = [...(hasRod ? ['hat-shelf'] : []), ...(shelves > 0 ? ['shelf'] : [])];
  const interiorTitle =
    interior === 1 ? 'Instala el maletero' : interior === 2 ? 'Instala los entrepaños' : 'Instala el maletero y los entrepaños';
  const backTo = ['al contorno', ...(hasRod ? ['al maletero'] : []), ...(shelves > 0 ? ['a cada entrepaño'] : [])];
  const rodSteps: Omit<Step, 'order'>[] = hasRod
    ? [
        {
          title: 'Pon el tubo',
          description:
            `Atornilla los soportes del tubo en los laterales a ${rodY} mm del piso y a ${Math.round(Dc / 2)} mm del frente. ` +
            `Corta el tubo a ${rodLength} mm con segueta y colócalo en los soportes.`,
          panelRefs: ['rod'],
          explodeOffsets: { rod: [0, 0, 200] },
        },
      ]
    : [];

  const steps: Omit<Step, 'order'>[] = [
    {
      title: 'Prepara y marca',
      description:
        `${prepSentence(stock, mode)} ` + `Marca en los laterales la cara de abajo de cada pieza: ${marks.join(', ')}.`,
      panelRefs: ['side'],
    },
    ...(mode === 'diy' ? [ironStep(panels.filter((pn) => pn.id !== 'back').map((pn) => pn.id))] : []),
    {
      title: 'Arma la caja acostada',
      description:
        'Fija la tapa y la base entre los laterales con tornillos confirmat, 2 por lado, y el zoclo bajo la base, ' +
        `al frente, con 1 por lado. Al pararlo gira sobre su diagonal, que mide ${Math.ceil(Math.hypot(H, D))} mm: ` +
        'revisa que libre tu techo.',
      panelRefs: ['side', 'top', 'bottom', 'plinth'],
      explodeOffsets: { top: [0, 150, 0], bottom: [0, -150, 0], plinth: [0, 0, 150] },
    },
    {
      title: interiorTitle,
      description: 'Coloca cada pieza en su marca y fíjala con 2 confirmat por lado.',
      panelRefs: interiorIds,
      explodeOffsets: Object.fromEntries(interiorIds.map((id): [string, Vec3] => [id, [0, 0, 200]])),
    },
    {
      title: 'Verifica la escuadra y coloca el fondo',
      description:
        'Mide las dos diagonales del frente: deben ser iguales. Con el clóset boca abajo, atornilla el fondo de ' +
        `fibracel con la cara lisa hacia el frente cada 20 cm ${spanishList(backTo)}.`,
      panelRefs: ['back'],
      explodeOffsets: { back: [0, 0, -200] },
    },
    ...rodSteps,
    ...door.steps,
  ];

  const design: Design = {
    templateId: 'closet',
    params: p,
    panels,
    placements,
    hardware,
    fittings: [...rod, ...door.fittings],
    boring: door.boring,
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    edgeBanding: mode,
  };
  return { ok: true, design };
}

export const closet: Template = {
  id: 'closet',
  name: 'Clóset modular',
  description: 'Módulo de clóset con maletero, tubo para colgar y entrepaños; junta varios para cubrir una pared.',
  params,
  generate: (raw) => generateCloset(raw),
};
```

- [ ] **Step 4: Register the closet**

In `src/engine/index.ts`:

- After `export { sideTable, generateSideTable } from './templates/side-table.ts';`, add:

  ```ts
  export { closet, generateCloset } from './templates/closet.ts';
  ```

- After `import { sideTable } from './templates/side-table.ts';` (the second, non-export import), add:

  ```ts
  import { closet } from './templates/closet.ts';
  ```

- Change the templates list to:

  ```ts
  export const templates: Template[] = [bookshelf, sideTable, closet];
  ```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/engine/templates src/engine/order.test.ts`

Expected: PASS.

Then run `pnpm test`, `pnpm typecheck` and `pnpm demo`. Expected: all green, and the demo output is unchanged (it prints the bookshelf).

If a closet expectation disagrees with the code, re-derive it by hand from the spec's formulas before changing either the test or the code. The expected numbers were computed from the spec.

- [ ] **Step 6: Commit**

```bash
git add src/engine/templates/closet.ts src/engine/templates/closet.test.ts src/engine/templates/templates.test.ts src/engine/index.ts src/engine/order.test.ts
git commit -m "feat(engine): add the modular closet template"
```

(Add the `Co-Authored-By:` trailer.)

---

### Task 4: Web — fittings in 3D, Barrenado in Pedido and PDF, "Herrajes"

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/components/Viewer3D.tsx`
- Modify: `src/components/StepsPanel.tsx`
- Modify: `src/components/OrderPanel.tsx`
- Modify: `src/components/PrintReport.tsx`
- Modify: `src/components/CutDiagram.tsx`
- Delete: `src/components/labels.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `Design.fittings`, `Order.boring` (`OrderBoring`), `Prices.boring`, `hardwareText` from `../engine/labels.ts`, cost line key `'boring'`;
  - from Task 3: the closet template (appears in the picker automatically).
- Produces: `setBoringPrice(price: number)` on the web store.

There are no new unit tests: the web has no component test setup, and the logic lives in the engine, which is already tested. This task is verified in the browser (Step 8).

- [ ] **Step 1: Store — boring price setter**

In `src/state/store.ts`:

- In `interface AppState`, after `setHardwarePrice: (key: string, price: number) => void;`, add:

  ```ts
    setBoringPrice: (price: number) => void;
  ```

- In the store body, after the `setHardwarePrice` implementation, add:

  ```ts
        setBoringPrice: (price) => set((s) => ({ prices: { ...s.prices, boring: clamp(price) } })),
  ```

- [ ] **Step 2: Viewer3D — draw fittings in steel**

In `src/components/Viewer3D.tsx`:

- After `const DIMMED_COLOR = '#4a5057'; // graphite — everything else in that step`, add:

  ```ts
  const STEEL_COLOR = '#9aa3ad'; // brushed steel — rod and handles
  ```

- After the `centroid` `useMemo` block, add:

  ```ts
    // Panels and fittings render alike; fittings are steel and never cut. The centroid stays the panels'.
    const boxes = useMemo(
      () => [
        ...design.placements.map((p) => ({
          key: `${p.panelId}-${p.instance}`,
          id: p.panelId,
          position: p.position,
          size: p.size,
          steel: false,
        })),
        ...design.fittings.map((f) => ({
          key: `fitting-${f.id}-${f.instance}`,
          id: f.id,
          position: f.position,
          size: f.size,
          steel: true,
        })),
      ],
      [design],
    );
  ```

- Replace the whole `{design.placements.map((p) => { … })}` block inside `<Canvas>` with:

  ```tsx
          {boxes.map((b) => {
            let pos: Vec3 = exploded
              ? [
                  centroid[0] + (b.position[0] - centroid[0]) * EXPLODE_FACTOR,
                  centroid[1] + (b.position[1] - centroid[1]) * EXPLODE_FACTOR,
                  centroid[2] + (b.position[2] - centroid[2]) * EXPLODE_FACTOR,
                ]
              : b.position;
            const stepOffset = highlightIds ? stepOffsets[b.id] : undefined;
            if (stepOffset) {
              pos = [pos[0] + stepOffset[0], pos[1] + stepOffset[1], pos[2] + stepOffset[2]];
            }
            const color = !highlightIds
              ? b.steel
                ? STEEL_COLOR
                : BASE_COLOR
              : highlightIds.has(b.id)
                ? HIGHLIGHT_COLOR
                : DIMMED_COLOR;
            return (
              <mesh key={b.key} position={pos} castShadow>
                <boxGeometry args={b.size} />
                <meshStandardMaterial color={color} roughness={b.steel ? 0.35 : 0.68} metalness={b.steel ? 0.6 : 0} />
                <Edges color="#1a1c20" />
              </mesh>
            );
          })}
  ```

- [ ] **Step 3: StepsPanel — fitting labels**

In `src/components/StepsPanel.tsx`, replace the `labels` `useMemo` with:

```ts
  // A step may reference a fitting (the rod); panel labels win on a shared id.
  const labels = useMemo(
    () => Object.fromEntries([...design.fittings, ...design.panels].map((p) => [p.id, p.label])),
    [design],
  );
```

- [ ] **Step 4: OrderPanel — Barrenado table, boring price, hardware text**

In `src/components/OrderPanel.tsx`:

- Replace `import { HARDWARE_LABELS } from './labels.ts';` with:

  ```ts
  import { hardwareText } from '../engine/labels.ts';
  ```

- After `const setHardwarePrice = useAppStore((s) => s.setHardwarePrice);`, add:

  ```ts
    const setBoringPrice = useAppStore((s) => s.setBoringPrice);
  ```

- In `setPriceByKey`, after the `else if (key === 'cut') setCutPrice(value);` line, add:

  ```ts
      else if (key === 'boring') setBoringPrice(value);
  ```

- Directly before the `<div>` that holds `<h3 className="rule-label">Totales</h3>`, insert:

  ```tsx
              {order.boring.length > 0 && (
                <div>
                  <h3 className="rule-label">Barrenado para bisagra</h3>
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                        <th className="pb-1.5 font-medium">#</th>
                        <th className="pb-1.5 font-medium">Pieza</th>
                        <th className="pb-1.5 text-right font-medium">Cant.</th>
                        <th className="pb-1.5 text-right font-medium">Perforaciones</th>
                        <th className="pb-1.5 pl-4 font-medium">Desde arriba (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.boring.map((b) => (
                        <tr key={b.n} className="border-b border-rule/70">
                          <td className="py-1.5 pr-2 font-mono text-xs tabular-nums text-ink-soft">{b.n}</td>
                          <td className="py-1.5 pr-2">{b.label}</td>
                          <td className="py-1.5 text-right font-mono text-xs tabular-nums">{b.qty}</td>
                          <td className="py-1.5 text-right font-mono text-xs tabular-nums">{b.along.length}</td>
                          <td className="py-1.5 pl-4 font-mono text-xs tabular-nums">{b.along.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 font-mono text-[11px] text-ink-soft">
                    Cazoleta Ø{order.boring[0]!.diameter} mm, {order.boring[0]!.depth} mm de profundidad, centro a{' '}
                    {order.boring[0]!.fromEdge} mm del canto.
                  </p>
                </div>
              )}
  ```

- In the Totales list, replace the hardware `<li>` content `{HARDWARE_LABELS[h.type]} {h.size}: <span className="font-mono tabular-nums">× {h.qty}</span>` with:

  ```tsx
                      {hardwareText(h)}: <span className="font-mono tabular-nums">× {h.qty}</span>
  ```

The price field for Barrenado needs no new JSX. `cost.lines` already includes the `'boring'` line, labelled "Barrenado de bisagra" with "por perforación".

- [ ] **Step 5: PrintReport — Barrenado table, "Herrajes", hardware text**

In `src/components/PrintReport.tsx`:

- Replace `import { HARDWARE_LABELS } from './labels.ts';` with:

  ```ts
  import { hardwareText } from '../engine/labels.ts';
  ```

- On the order page, directly after the `{order.groups.map((g) => ( … ))}` block and before `<ul className="mt-4 space-y-1 text-sm">`, insert:

  ```tsx
          {order.boring.length > 0 && (
            <div className="break-inside-avoid">
              <h2 className="mt-6 border-b border-ink pb-1 display text-lg font-bold">Barrenado para bisagra</h2>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                    <th className="py-1">#</th>
                    <th>Pieza</th>
                    <th>Cant.</th>
                    <th>Perforaciones</th>
                    <th>Desde arriba (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {order.boring.map((b) => (
                    <tr key={b.n} className="border-b border-rule">
                      <td className="py-1 font-mono text-xs tabular-nums">{b.n}</td>
                      <td>{b.label}</td>
                      <td className="font-mono text-xs tabular-nums">{b.qty}</td>
                      <td className="font-mono text-xs tabular-nums">{b.along.length}</td>
                      <td className="font-mono text-xs tabular-nums">{b.along.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 font-mono text-[11px] text-ink-soft">
                Cazoleta Ø{order.boring[0]!.diameter} mm, {order.boring[0]!.depth} mm de profundidad, centro a{' '}
                {order.boring[0]!.fromEdge} mm del canto.
              </p>
            </div>
          )}
  ```

- In the order page's `<ul>`, replace `{HARDWARE_LABELS[h.type]} {h.size} × {h.qty}` with:

  ```tsx
                {hardwareText(h)} × {h.qty}
  ```

- Replace `<h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Tornillería</h2>` with:

  ```tsx
        <h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Herrajes</h2>
  ```

- In the list right under it, replace `{HARDWARE_LABELS[h.type]} {h.size} — {h.qty} piezas` with:

  ```tsx
              {hardwareText(h)} — {h.qty} piezas
  ```

- [ ] **Step 6: CutDiagram — "Herrajes", hardware text; delete the re-export**

In `src/components/CutDiagram.tsx`:

- Replace `import { HARDWARE_LABELS } from './labels.ts';` with:

  ```ts
  import { hardwareText } from '../engine/labels.ts';
  ```

- Replace `<h3 className="rule-label">Tornillería</h3>` with:

  ```tsx
                <h3 className="rule-label">Herrajes</h3>
  ```

- Replace the span that renders `{HARDWARE_LABELS[h.type]}{' '}<span className="font-mono text-xs text-ink-soft">{h.size}</span>` (the whole outer `<span>…</span>`) with:

  ```tsx
                      <span>{hardwareText(h)}</span>
  ```

Then delete `src/components/labels.ts`, and confirm nothing imports it:

```bash
git rm src/components/labels.ts
grep -rn "HARDWARE_LABELS\|components/labels\|'./labels" src/components src/App.tsx
```

Expected: no output.

- [ ] **Step 7: Type-check and test**

Run: `pnpm typecheck` and `pnpm test`.

Expected: clean, all pass.

- [ ] **Step 8: Verify in the browser**

Start the dev server with the preview tool (`preview_start` with name `dev`, port 5173; never start it via Bash). Then check each item, fixing and re-checking any failure:

1. **Template picker.** "Clóset modular" appears; select it.
2. **Diseño tab, 3D.** Two doors stand open 90° in front of the case, and the rod and two handles are drawn in a grey-steel tone. Take a screenshot.
3. **Pasos tab.**
   - 8 steps.
   - Selecting "Pon el tubo" highlights the rod in red, and its chip reads "Tubo".
   - "Pon las jaladeras" chips read "Puerta" and "Jaladera".
4. **Pedido tab.**
   - A "Barrenado para bisagra" table with row `7 · Puerta · 2 · 4 · 100 · 675 · 1251 · 1826`.
   - The Totales list shows `Tubo oval para clóset 15×30 mm, cortado a 762 mm: × 1`.
   - The Costo column has a "Barrenado de bisagra" price field reading "por perforación × 8". Typing `5` gives `= $40.00`.
5. **Cortes tab.** The heading reads "Herrajes"; there is no "Tornillería" anywhere (`document.body.innerText.includes('Tornillería') === false`).
6. **PDF.** The hidden print DOM (`PrintReport`) contains "Barrenado para bisagra" and "Herrajes". Check with `javascript_tool`: `document.body.textContent.includes('Barrenado para bisagra')`.
7. **Validation.** Set Puertas = "Una" with Ancho 700: the message "Una sola puerta de 696 mm pesa y se descuadra; …" shows under the Puertas field.
8. **Bookshelf.** Switch back to Librero: 3D, Pedido and Cortes look as before, with no Barrenado.
9. **Console.** No errors (`read_console_messages` with `onlyErrors`).

- [ ] **Step 9: Commit**

```bash
git add src/state/store.ts src/components/Viewer3D.tsx src/components/StepsPanel.tsx src/components/OrderPanel.tsx src/components/PrintReport.tsx src/components/CutDiagram.tsx
git commit -m "feat(ui): show closet fittings in 3D and hinge drilling in the order"
```

(The deleted `src/components/labels.ts` is already staged by `git rm`. Add the `Co-Authored-By:` trailer.)

---

### Task 5: iOS — fittings in 3D, labels, hardware text, closet kind

**Files:**
- Modify: `mobile/src/components/viewer-3d.tsx`
- Modify: `mobile/src/screens/result/steps.tsx`
- Modify: `mobile/src/screens/result/cuts.tsx`
- Modify: `mobile/src/app/templates.tsx`

**Interfaces:**
- Consumes: from Task 1, `Design.fittings` and `hardwareText`; from Task 3, the closet template. All come through `@/lib/engine`.
- Produces: nothing new.

There are no unit tests here (the mobile app has no test setup). It is verified by type-check and export.

- [ ] **Step 1: viewer-3d — draw fittings in steel**

In `mobile/src/components/viewer-3d.tsx`:

- After `const DIMMED = 0x4a5057;`, add:

  ```ts
  const STEEL = 0x9aa3ad; // brushed steel — rod and handles
  ```

- Replace the whole `for (const p of d.placements) { … }` loop inside `build` with:

  ```ts
      // Panels and fittings render alike; fittings are steel and never cut. The centroid stays the panels'.
      const boxes = [
        ...d.placements.map((p) => ({ id: p.panelId, position: p.position, size: p.size, steel: false })),
        ...d.fittings.map((f) => ({ id: f.id, position: f.position, size: f.size, steel: true })),
      ];
      for (const b of boxes) {
        let pos: Vec3 = ex
          ? [
              centroid[0] + (b.position[0] - centroid[0]) * EXPLODE_FACTOR,
              centroid[1] + (b.position[1] - centroid[1]) * EXPLODE_FACTOR,
              centroid[2] + (b.position[2] - centroid[2]) * EXPLODE_FACTOR,
            ]
          : [b.position[0], b.position[1], b.position[2]];
        const off = highlight ? offsets[b.id] : undefined;
        if (off) pos = [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]];

        const on = highlight?.has(b.id);
        const geo = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color: !highlight ? (b.steel ? STEEL : BASE) : on ? HIGHLIGHT : DIMMED,
          roughness: b.steel ? 0.35 : 0.62,
          metalness: b.steel ? 0.6 : 0,
        }));
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.castShadow = true;
        mesh.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: on ? 0xffffff : 0x1a1c20 }),
          ),
        );
        g.group.add(mesh);
      }
  ```

- [ ] **Step 2: steps — fitting labels**

In `mobile/src/screens/result/steps.tsx`, replace the `labels` `useMemo` with:

```ts
  // A step may reference a fitting (the rod); panel labels win on a shared id.
  const labels = useMemo(
    () => Object.fromEntries([...design!.fittings, ...design!.panels].map((p) => [p.id, p.label])),
    [design],
  );
```

- [ ] **Step 3: cuts — hardware text**

In `mobile/src/screens/result/cuts.tsx`:

- In the `@/lib/engine` import list, replace `HARDWARE_LABELS,` with `hardwareText,` (keep the list alphabetical: after `edgeCodes,`).
- In `shopping`, replace `name: \`${HARDWARE_LABELS[h.type]} ${h.size}\`,` with:

  ```ts
        name: hardwareText(h),
  ```

- [ ] **Step 4: templates — closet kind**

In `mobile/src/app/templates.tsx`, change the `KIND` line to:

```ts
const KIND: Record<string, string> = { bookshelf: 'estantería', 'side-table': 'mesa', closet: 'clóset' };
```

- [ ] **Step 5: Verify**

Run in `mobile/`:

```bash
npx tsc --noEmit
npx expo export --platform ios --output-dir "$TMP/expo-closet"
```

Expected: no type errors, and the export finishes with exit code 0.

Then `grep -rn "HARDWARE_LABELS" mobile/src` should return nothing.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/viewer-3d.tsx mobile/src/screens/result/steps.tsx mobile/src/screens/result/cuts.tsx mobile/src/app/templates.tsx
git commit -m "feat(mobile): draw closet fittings and list hardware with the shared text"
```

(Add the `Co-Authored-By:` trailer.)

---

### Task 6: Docs — conventions and Phase 5 status

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above (it documents the conventions as built).
- Produces: nothing.

- [ ] **Step 1: Engine conventions**

In `CLAUDE.md`, under `## Engine conventions`, insert these two bullets directly before the bullet that starts `- Templates must produce panels that always fit a sheet`:

```markdown
- Building blocks live in `src/engine/parts/`. A block such as `doorSet` returns a fragment `{ panels, placements, hardware, fittings, boring, steps }` that a template merges with its own parts. Blocks never validate; templates do, using the block's helpers (e.g. `doorWidth`). Doors are full overlay:
  - 2 mm gaps, 3 mm between a pair;
  - 35 mm cup hinges counted by door height (≤900: 2, ≤1600: 3, ≤2000: 4, else 5), cups 100 mm from each end and evenly spaced;
  - drawn swung open 90° so the interior stays visible.
- Fittings, boring and hardware text:
  - `Design.fittings` are non-cut parts drawn in steel in 3D (rod, handles), and `Step.panelRefs` may name a fitting id.
  - `Design.boring` lists the holes the lumber yard drills (hinge cups). `Order.boring` points at the drilled piece's order line, and `Prices.boring` prices each hole.
  - `hardwareText` is the only hardware-line format, including `cutTo` for items cut to size (the closet rod). Hardware headings read "Herrajes".
```

- [ ] **Step 2: Phase 5 status**

Replace the whole Phase 5 entry (from `- [ ] **Phase 5 — Templates for small homes** (no backend).` through the `  - Offcut suggestions: …` line) with:

```markdown
- [ ] **Phase 5 — Templates for small homes** (in progress; no backend). Split into sub-projects 5.1–5.6, each spec → plan → PR.
  - **5.1 Doors + modular closet** — spec: `docs/superpowers/specs/2026-09-24-closet-doors-design.md`.
    - `doorSet` building block: full overlay, 35 mm cup hinges drilled by the lumber yard, handles, doors drawn open 90°.
    - "Clóset modular" template: one module with Colgar / Entrepaños / Mixto interiors, a zoclo, a Fibracel back and 0–2 doors.
    - `Design.fittings` draws the rod and handles in 3D; `Design.boring` becomes Barrenado in the order and cost.
    - "Herrajes" replaces "Tornillería".
    - *Implemented; awaiting user approval.*
  - **5.2 Drawers**: a drawer-box block and slides (new `Hardware` type), a drawer option on the closet, and a TV stand.
  - **5.3 More templates**, in priority order: kitchen pantry cabinet, home-office desk, bed base with drawers, shoe rack, floating shelves.
  - **5.4 Fit this space**: enter a niche W × H × D (the mobile measure screen feeds it) and the template sizes itself with clearance.
  - **5.5 Tool-aware steps**: ask what tools the user owns. With only a screwdriver, every cut goes to the lumber yard, holes are pre-drilled (the yard/me drilling choice lives here), and joinery switches to confirmat.
  - **5.6 Offcut suggestions**: small projects that fit a layout's leftover rectangles.
```

- [ ] **Step 3: Final verification**

Run at the repo root: `pnpm test`, `pnpm typecheck`, `pnpm demo`. Then in `mobile/`: `npx tsc --noEmit`.

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record door, fitting and boring conventions for Phase 5.1"
```

(Add the `Co-Authored-By:` trailer.)
