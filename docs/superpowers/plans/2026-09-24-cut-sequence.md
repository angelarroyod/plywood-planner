# Phase 4.4 Cut Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `sheetCuts` into a numbered circular-saw sequence per sheet — equal-length short pieces trimmed in one pass, each cut measured from the top or left edge of the board as it is at that moment — and show it as numbered badges and lists on web (Cortes + PDF) and as a per-cut checklist on iOS.

**Architecture:** `src/engine/cuts.ts` keeps its two exports but `sheetCuts` now returns the cuts in saw order with `n`, `from` and `mm`, and merges short runs' trims. `cutTotals` still sums it, so the lumber-yard order and cost follow automatically (default bookshelf 13 → **12** cuts, 12.6 → **12.2** m). New engine helpers `cutText`, `CUT_TIP` and `cutBadge` give both clients the same copy and badge placement.

**Tech Stack:** TypeScript (strict), Vitest, React 18 + Tailwind v4 (web SVG), Expo SDK 57 + react-native-svg (iOS).

**Spec:** `docs/superpowers/specs/2026-09-24-cut-sequence-design.md`

**Plan refinement over the spec:** iOS cut ids (`"{sheet}:{n}"`) follow the layout, which any parameter can change, so the iOS `setParam` also clears `checked` — otherwise old ticks would land on different cuts.

## Global Constraints

- `src/engine/` stays pure TypeScript: zero imports from React, DOM APIs or three.js.
- UI copy is Spanish (es-MX); code, comments and commit messages are English; conventional commits.
- No new dependencies. No new color tokens: web badges use `var(--color-mark)` with white text; iOS badges use `color.red` (done: `color.border`) with `color.white` text.
- All internal units are millimeters. Meters round **up** to 0.1: `Math.ceil(mm / 100) / 10`.
- `cutText`: `{kind} — {mm} mm desde {edge}` — kind `A lo ancho` (cross) / `A lo largo` (rip) / `Recorte` (trim); edge `arriba` (`from: 'top'`) / `la izquierda` (`from: 'left'`).
- `CUT_TIP` exactly: `Mide desde el borde indicado del tablero que te queda y corta del lado del sobrante: el disco se come 3 mm.`
- Badge: circle radius 34, number font size 40, placed by `cutBadge` (70 mm from the cut's start, or the midpoint when the cut is shorter than 140 mm).
- Default bookshelf: `{ count: 12, meters: 12.2 }`; default side table: `{ count: 8, meters: 5.1 }`.
- iOS uses npm, not pnpm, and imports the engine only through `@/lib/engine`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on the **local** branch `feat/cut-sequence`. **Never push or contact a remote.**

## File Map

| File | Responsibility | Task |
|---|---|---|
| `src/engine/cuts.ts`, `cuts.test.ts` | Sequenced `sheetCuts`, `cutText`, `CUT_TIP`, `cutBadge` | 1 |
| `src/engine/order.test.ts`, `cost.test.ts` | Update 4.3 cut expectations (12 / 12.2) | 1 |
| `src/components/SheetSvg.tsx`, `CutDiagram.tsx`, `PrintReport.tsx` | Web badges, lists, tip, Cortes stat | 2 |
| `mobile/src/components/sheet-svg.tsx`, `mobile/src/screens/result/cuts.tsx`, `mobile/src/lib/store.ts`, `mobile/src/lib/app-provider.tsx` | iOS badges, per-cut checklist, Piezas list, tick reset | 3 |
| `CLAUDE.md` | Cut convention + status | 4 |

Every task leaves `pnpm test`, `pnpm typecheck` and the iOS `tsc` green.

---

### Task 1: Engine — the saw sequence

**Files:**
- Modify (full replacement): `src/engine/cuts.ts`, `src/engine/cuts.test.ts`
- Modify: `src/engine/order.test.ts`, `src/engine/cost.test.ts`

**Interfaces:**
- Consumes: `SheetLayout`, `PlacedPiece`, `NestingResult`; `nest`, `getStock`, `bookshelf`, `sideTable`.
- Produces (re-exported by `src/engine/index.ts`, which already has `export * from './cuts.ts'`):
  - `interface Cut { n: number; kind: 'cross' | 'rip' | 'trim'; x1: number; y1: number; x2: number; y2: number; from: 'top' | 'left'; mm: number }`
  - `sheetCuts(sheet: SheetLayout): Cut[]` — saw order, `n` 1…k per sheet
  - `cutTotals(layout: NestingResult): { count: number; meters: number }`
  - `cutText(cut: Cut): string`, `CUT_TIP: string`, `cutBadge(cut: Cut): { x: number; y: number }`

- [ ] **Step 1: Write the failing tests**

Replace `src/engine/cuts.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { CUT_TIP, cutBadge, cutText, cutTotals, sheetCuts, type Cut } from './cuts.ts';
import { nest } from './nesting.ts';
import { getStock } from './stock.ts';
import type { PlacedPiece, SheetLayout, Template } from './types.ts';
import { bookshelf } from './templates/bookshelf.ts';
import { sideTable } from './templates/side-table.ts';

const PLY18 = getStock(3); // 1220 × 2440

function piece(over: Partial<PlacedPiece>): PlacedPiece {
  return { panelId: 'p', instance: 0, x: 0, y: 0, length: 600, width: 400, rotated: false, ...over };
}

function sheet(...pieces: PlacedPiece[]): SheetLayout {
  return { stock: PLY18, pieces };
}

function defaultSheets(template: Template): SheetLayout[] {
  const result = template.generate({});
  if (!result.ok) throw new Error(`default ${template.id} must validate`);
  return nest(result.design.panels).sheets;
}

describe('sheetCuts', () => {
  it('frees a corner piece with one crosscut and one rip', () => {
    expect(sheetCuts(sheet(piece({})))).toEqual([
      { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 },
      { n: 2, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 600, from: 'left', mm: 400 },
    ]);
  });

  it('needs no cut for a piece that fills the sheet', () => {
    expect(sheetCuts(sheet(piece({ length: 2440, width: 1220 })))).toEqual([]);
  });

  it('rips full-height pieces one by one, each from the new left edge', () => {
    const cuts = sheetCuts(sheet(piece({ x: 0 }), piece({ instance: 1, x: 403 })));
    expect(cuts.map((c) => [c.n, c.kind, c.from, c.mm, c.x1])).toEqual([
      [1, 'cross', 'top', 600, 0],
      [2, 'rip', 'left', 400, 400],
      [3, 'rip', 'left', 400, 803],
    ]);
  });

  it('trims a run of equal short pieces in one pass', () => {
    const cuts = sheetCuts(
      sheet(piece({ x: 0 }), piece({ instance: 1, x: 403, length: 500 }), piece({ instance: 2, x: 806, length: 500 })),
    );
    expect(cuts).toEqual([
      { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 },
      { n: 2, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 600, from: 'left', mm: 400 },
      { n: 3, kind: 'rip', x1: 1206, y1: 0, x2: 1206, y2: 600, from: 'left', mm: 803 }, // end of the short run
      { n: 4, kind: 'trim', x1: 403, y1: 500, x2: 1206, y2: 500, from: 'top', mm: 500 }, // one pass for both
      { n: 5, kind: 'rip', x1: 803, y1: 0, x2: 803, y2: 500, from: 'left', mm: 400 }, // only as long as the trim
    ]);
  });

  it('does not crosscut under a row that reaches the sheet bottom', () => {
    expect(sheetCuts(sheet(piece({ length: 2440 })))).toEqual([
      { n: 1, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 2440, from: 'left', mm: 400 },
    ]);
  });

  it('walks rows top to bottom and numbers cuts in order', () => {
    const cuts = sheetCuts(sheet(piece({ instance: 1, y: 603 }), piece({})));
    expect(cuts.filter((c) => c.kind === 'cross').map((c) => c.y1)).toEqual([600, 1203]);
    expect(cuts.map((c) => c.n)).toEqual([1, 2, 3, 4]);
  });

  it('gives the default bookshelf its saw sequence', () => {
    const [plywood, fibracel] = defaultSheets(bookshelf);
    expect(sheetCuts(plywood!).map((c) => cutText(c))).toEqual([
      'A lo ancho — 1200 mm desde arriba',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 597 mm desde la izquierda',
      'Recorte — 764 mm desde arriba',
      'A lo largo — 297 mm desde la izquierda',
      'A lo ancho — 764 mm desde arriba',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 297 mm desde la izquierda',
      'A lo largo — 297 mm desde la izquierda',
    ]);
    expect(sheetCuts(fibracel!).map((c) => cutText(c))).toEqual([
      'A lo ancho — 1200 mm desde arriba',
      'A lo largo — 800 mm desde la izquierda',
    ]);
  });
});

describe('cutTotals', () => {
  it('counts cuts and rounds meters up to 0.1', () => {
    // 1220 + 600 = 1820 mm → 1.9 m
    expect(cutTotals({ sheets: [sheet(piece({}))], byStock: [] })).toEqual({ count: 2, meters: 1.9 });
  });

  it('totals the default designs', () => {
    expect(cutTotals({ sheets: defaultSheets(bookshelf), byStock: [] })).toEqual({ count: 12, meters: 12.2 });
    expect(cutTotals({ sheets: defaultSheets(sideTable), byStock: [] })).toEqual({ count: 8, meters: 5.1 });
  });
});

describe('cutText / CUT_TIP', () => {
  const at = { n: 1, x1: 0, y1: 0, x2: 0, y2: 0 };

  it('says which way to cut and how far from which edge', () => {
    expect(cutText({ ...at, kind: 'cross', from: 'top', mm: 1200 })).toBe('A lo ancho — 1200 mm desde arriba');
    expect(cutText({ ...at, kind: 'rip', from: 'left', mm: 297 })).toBe('A lo largo — 297 mm desde la izquierda');
    expect(cutText({ ...at, kind: 'trim', from: 'top', mm: 764 })).toBe('Recorte — 764 mm desde arriba');
  });

  it('reminds to cut on the waste side', () => {
    expect(CUT_TIP).toBe(
      'Mide desde el borde indicado del tablero que te queda y corta del lado del sobrante: el disco se come 3 mm.',
    );
  });
});

describe('cutBadge', () => {
  it('sits 70 mm in from where the saw enters', () => {
    const cross: Cut = { n: 1, kind: 'cross', x1: 0, y1: 600, x2: 1220, y2: 600, from: 'top', mm: 600 };
    const rip: Cut = { n: 2, kind: 'rip', x1: 400, y1: 0, x2: 400, y2: 600, from: 'left', mm: 400 };
    expect(cutBadge(cross)).toEqual({ x: 70, y: 600 });
    expect(cutBadge(rip)).toEqual({ x: 400, y: 70 });
  });

  it('uses the midpoint of a short cut', () => {
    const short: Cut = { n: 1, kind: 'trim', x1: 0, y1: 50, x2: 100, y2: 50, from: 'top', mm: 50 };
    expect(cutBadge(short)).toEqual({ x: 50, y: 50 });
  });
});
```

In `src/engine/order.test.ts`, change the two 4.3 cut expectations:

- `expect(order.cuts).toEqual({ count: 13, meters: 12.6 });` → `expect(order.cuts).toEqual({ count: 12, meters: 12.2 });`
- `'Cortes: 13 (12.6 m lineales).',` → `'Cortes: 12 (12.2 m lineales).',`

In `src/engine/cost.test.ts`:

- `['cut', 'Corte', 12.6, 'm', 4],` → `['cut', 'Corte', 12.2, 'm', 4],`
- Replace the total comment and assertion:

```ts
    // 950 + 180 + 12.6·4 + 7.1·12 + 20·2 + 32·0.5 = 950 + 180 + 50.4 + 85.2 + 40 + 16
    expect(total).toBeCloseTo(1321.6);
```

with:

```ts
    // 950 + 180 + 12.2·4 + 7.1·12 + 20·2 + 32·0.5 = 950 + 180 + 48.8 + 85.2 + 40 + 16
    expect(total).toBeCloseTo(1320);
```

- `expect(cut).toMatchObject({ qty: 13, unit: 'corte', price: 10, subtotal: 130 });` → `expect(cut).toMatchObject({ qty: 12, unit: 'corte', price: 10, subtotal: 120 });`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/engine/cuts.test.ts src/engine/order.test.ts src/engine/cost.test.ts`
Expected: FAIL — `cutText`/`CUT_TIP`/`cutBadge` are not exported, cuts lack `n`/`from`/`mm`, and the totals are still 13 / 12.6.

- [ ] **Step 3: Replace `src/engine/cuts.ts`**

```ts
import type { NestingResult, PlacedPiece, SheetLayout } from './types.ts';

/** One straight saw pass across a sheet, in sheet mm (origin top-left, x along width, y along length). */
export interface Cut {
  n: number; // 1-based, per sheet, in saw order
  kind: 'cross' | 'rip' | 'trim'; // cross and trim run across the grain (along x); rip runs along it (along y)
  x1: number; // start → end; x1 ≤ x2, y1 ≤ y2
  y1: number;
  x2: number;
  y2: number;
  from: 'top' | 'left'; // edge of the board as it is at this cut, to measure from
  mm: number; // distance from that edge to the cut line
}

/**
 * The circular-saw sequence that frees a sheet's pieces from its FFDH shelf layout.
 * Pieces sharing a `y` form a row whose height is its tallest piece; rows go top to bottom.
 * Each row gets a crosscut under it (unless it reaches the sheet bottom), then, for each run of
 * neighbouring equal-length pieces: rips piece by piece when the run is full height, or — when it
 * is shorter — one rip at the run's end, one trim shared by the whole run and short rips between
 * its pieces. Every cut is measured from the top or left edge of the board at that moment; rows
 * are packed edge to edge with the kerf between them, so a row's top is the board's top edge.
 */
export function sheetCuts(sheet: SheetLayout): Cut[] {
  const { width: W, length: L } = sheet.stock.sheet;
  const rows = new Map<number, PlacedPiece[]>();
  for (const p of sheet.pieces) rows.set(p.y, [...(rows.get(p.y) ?? []), p]);

  const cuts: Cut[] = [];
  const add = (cut: Omit<Cut, 'n'>) => cuts.push({ n: cuts.length + 1, ...cut });

  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(y)!.sort((a, b) => a.x - b.x);
    const h = Math.max(...row.map((p) => p.length));
    if (y + h < L) add({ kind: 'cross', x1: 0, y1: y + h, x2: W, y2: y + h, from: 'top', mm: h });

    const runs: PlacedPiece[][] = []; // neighbouring pieces of equal length
    for (const p of row) {
      const last = runs.at(-1);
      if (last && last[0]!.length === p.length) last.push(p);
      else runs.push([p]);
    }

    for (const run of runs) {
      const length = run[0]!.length;
      const xStart = run[0]!.x;
      const xEnd = run.at(-1)!.x + run.at(-1)!.width;
      if (length === h) {
        for (const p of run) {
          const right = p.x + p.width;
          if (right < W) add({ kind: 'rip', x1: right, y1: y, x2: right, y2: y + h, from: 'left', mm: p.width });
        }
      } else {
        if (xEnd < W) add({ kind: 'rip', x1: xEnd, y1: y, x2: xEnd, y2: y + h, from: 'left', mm: xEnd - xStart });
        add({ kind: 'trim', x1: xStart, y1: y + length, x2: xEnd, y2: y + length, from: 'top', mm: length });
        for (const p of run.slice(0, -1)) {
          const right = p.x + p.width;
          add({ kind: 'rip', x1: right, y1: y, x2: right, y2: y + length, from: 'left', mm: p.width });
        }
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

const KIND_TEXT: Record<Cut['kind'], string> = { cross: 'A lo ancho', rip: 'A lo largo', trim: 'Recorte' };
const EDGE_TEXT: Record<Cut['from'], string> = { top: 'arriba', left: 'la izquierda' };

/** One saw step in Spanish, e.g. 'A lo largo — 297 mm desde la izquierda'. */
export function cutText(cut: Cut): string {
  return `${KIND_TEXT[cut.kind]} — ${cut.mm} mm desde ${EDGE_TEXT[cut.from]}`;
}

/** Shown once above every cut list. */
export const CUT_TIP =
  'Mide desde el borde indicado del tablero que te queda y corta del lado del sobrante: el disco se come 3 mm.';

const BADGE_OFFSET = 70; // mm from where the saw enters, clear of the piece labels at each piece's center

/** Where to draw a cut's number: 70 mm in from its start, or its midpoint when the cut is shorter than 140 mm. */
export function cutBadge(cut: Cut): { x: number; y: number } {
  const length = Math.abs(cut.x2 - cut.x1) + Math.abs(cut.y2 - cut.y1);
  const d = Math.min(BADGE_OFFSET, length / 2);
  return { x: cut.x1 + Math.sign(cut.x2 - cut.x1) * d, y: cut.y1 + Math.sign(cut.y2 - cut.y1) * d };
}
```

- [ ] **Step 4: Run the tests, the demo and the typecheck**

Run: `pnpm test` → all PASS.
Run: `pnpm demo` → the JSON shows `"cuts": { "count": 12, "meters": 12.2 }` (pretty-printed). Exit code 0.
Run: `pnpm typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cuts.ts src/engine/cuts.test.ts src/engine/order.test.ts src/engine/cost.test.ts
git commit -m "feat(engine): sequence the saw cuts for home cutting

sheetCuts now returns the cuts in circular-saw order, numbered per sheet,
each measured from the top or left edge of the board at that moment.
Neighbouring pieces of the same shorter length share one trim, so the
default bookshelf needs 12 cuts (12.2 m) instead of 13; the order and
cost follow because cutTotals sums the same sequence. cutText, CUT_TIP
and cutBadge give both clients the same copy and badge placement.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Web — badges, lists, tip, Cortes stat

**Files:**
- Modify: `src/components/SheetSvg.tsx`, `src/components/CutDiagram.tsx`, `src/components/PrintReport.tsx`

**Interfaces:**
- Consumes (Task 1): `sheetCuts`, `cutText`, `CUT_TIP`, `cutBadge`, `cutTotals` from `src/engine/cuts.ts`.
- Produces: nothing for later tasks.

- [ ] **Step 1: `src/components/SheetSvg.tsx` — numbered badges**

Add below the existing `edge-banding.ts` import:

```tsx
import { cutBadge, sheetCuts } from '../engine/cuts.ts';
```

Right before the closing `</svg>` (after the `↑ VETA` block), add:

```tsx
      {/* Numbered cuts, drawn last so they sit on top; placed where the saw enters. */}
      {sheetCuts(sheet).map((c) => {
        const b = cutBadge(c);
        return (
          <g key={c.n}>
            <circle cx={b.x} cy={b.y} r={34} fill="var(--color-mark)" />
            <text
              x={b.x}
              y={b.y}
              fontSize={40}
              fontFamily={MONO}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
            >
              {c.n}
            </text>
          </g>
        );
      })}
```

- [ ] **Step 2: `src/components/CutDiagram.tsx` — stat, tip, lists**

Add below the `../engine/cost.ts` import:

```tsx
import { CUT_TIP, cutText, cutTotals, sheetCuts } from '../engine/cuts.ts';
```

After `const cost = orderCost(buildOrder(design, layout, ''), prices);`, add:

```tsx
  const cuts = cutTotals(layout);
```

Insert a `Cortes` stat directly before the `Costo` stat (i.e. right after the `layout.byStock.map(...)` Desperdicio stats):

```tsx
            <Stat label="Cortes" value={String(cuts.count)} unit={`${cuts.meters.toFixed(1)} m lineales`} />
```

Right after the closing `</div>` of the stats row (the `<div className="mt-5 flex flex-wrap gap-3">` block), still inside `<header>`, add:

```tsx
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ink-soft">{CUT_TIP}</p>
```

Inside each sheet `<figure>`, right after the closing `</figcaption>`, add:

```tsx
                <ol className="mt-2 w-[15rem] space-y-0.5 font-mono text-[11px] tabular-nums text-ink-soft">
                  {sheetCuts(sheet).map((c) => (
                    <li key={c.n}>
                      <span className="text-ink">{c.n}.</span> {cutText(c)}
                    </li>
                  ))}
                </ol>
```

- [ ] **Step 3: `src/components/PrintReport.tsx` — tip and lists**

Add below the `../engine/cost.ts` import:

```tsx
import { CUT_TIP, cutText, sheetCuts } from '../engine/cuts.ts';
```

Directly after `<h2 className="mt-7 border-b border-ink pb-1 display text-lg font-bold">Plan de corte</h2>`, add:

```tsx
      <p className="mt-1 text-xs text-ink-soft">{CUT_TIP}</p>
```

Inside each printed sheet `<figure>`, right after its closing `</figcaption>`, add:

```tsx
            <ol className="mt-1 space-y-0.5 font-mono text-[10px] tabular-nums">
              {sheetCuts(sheet).map((c) => (
                <li key={c.n}>
                  {c.n}. {cutText(c)}
                </li>
              ))}
            </ol>
```

- [ ] **Step 4: Typecheck and test**

Run: `pnpm typecheck` → no errors.
Run: `pnpm test` → all PASS.

- [ ] **Step 5: Check in the browser**

Start the `dev` preview from `.claude/launch.json` (`pnpm dev`, port 5173; use `preview_start` with `{ name: "dev" }`, never Bash), open `http://localhost:5173`, **Librero** defaults, tab **Cortes**:

1. Stats row shows `Cortes` `12` with unit `12.2 m lineales`.
2. The `CUT_TIP` sentence appears once above the sheets.
3. Plywood sheet: 10 badges numbered 1–10 (count `svg circle` inside the first sheet SVG → 10); Fibracel sheet: 2 badges.
4. Under the plywood sheet, the list reads `1. A lo ancho — 1200 mm desde arriba` … `5. Recorte — 764 mm desde arriba` … `10. A lo largo — 297 mm desde la izquierda`.
5. Tab **Pedido**: the totals show `Cortes: 12 (12.2 m lineales)`.
6. Print DOM (`.hidden.print\:block`): after the `Plan de corte` heading, the tip paragraph; each printed sheet figure has an `<ol>` with the same entries.

Check `read_console_messages` for errors → none. Stop the preview.

- [ ] **Step 6: Commit**

```bash
git add src/components/SheetSvg.tsx src/components/CutDiagram.tsx src/components/PrintReport.tsx
git commit -m "feat(ui): number the saw cuts on web

Each sheet shows a badge where every cut starts, with a numbered list of
cuts underneath and the measuring tip above, on screen and in the PDF.
Cortes also gains a stat with the cut count and meters.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: iOS — badges, per-cut checklist, Piezas list

**Files:**
- Modify: `mobile/src/components/sheet-svg.tsx`, `mobile/src/screens/result/cuts.tsx`, `mobile/src/lib/store.ts`, `mobile/src/lib/app-provider.tsx`

**Interfaces:**
- Consumes (through `@/lib/engine`): `sheetCuts`, `cutText`, `CUT_TIP`, `cutBadge`.
- Produces: the iOS `SheetSvg` gains a **required** prop `sheetNo: number` (1-based); `checked` now holds cut ids `"{sheet}:{n}"`.

- [ ] **Step 1: `mobile/src/components/sheet-svg.tsx`**

Replace the imports:

```tsx
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { NO_EDGES, bandSegments, type EdgeBands, type SheetLayout } from '@/lib/engine';
```

with:

```tsx
import Svg, { Circle, Defs, G, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { NO_EDGES, bandSegments, cutBadge, sheetCuts, type EdgeBands, type SheetLayout } from '@/lib/engine';
```

Replace the `checked` prop doc and add `sheetNo`:

```tsx
  /** `${panelId}#${instance}` ids already cut — they grey out on the sheet. */
  checked: string[];
```

with:

```tsx
  /** `"{sheet}:{n}"` ids of saw cuts already made — their badges grey out. */
  checked: string[];
  /** 1-based position of this sheet in the layout, the first half of each cut id. */
  sheetNo: number;
```

Change the signature `export function SheetSvg({ sheet, labels, edges, checked, height = 330 }: Props) {` to:

```tsx
export function SheetSvg({ sheet, labels, edges, checked, sheetNo, height = 330 }: Props) {
```

Inside the pieces map, replace:

```tsx
        const done = checked.includes(`${p.panelId}#${p.instance}`);
        const tone = done ? pieceTone.done : pieceTone.todo;
```

with:

```tsx
        const tone = pieceTone.todo; // progress is tracked per saw cut now (see the badges)
```

Right before the closing `</Svg>` (after the `↑ VETA` block), add:

```tsx
      {/* Numbered cuts, drawn last so they sit on top; placed where the saw enters. */}
      {sheetCuts(sheet).map((c) => {
        const b = cutBadge(c);
        const done = checked.includes(`${sheetNo}:${c.n}`);
        return (
          <G key={c.n}>
            <Circle cx={b.x} cy={b.y} r={34} fill={done ? color.border : color.red} />
            <SvgText x={b.x} y={b.y + 14} fontSize={40} fontWeight="700" textAnchor="middle" fill={color.white}>
              {String(c.n)}
            </SvgText>
          </G>
        );
      })}
```

- [ ] **Step 2: `mobile/src/screens/result/cuts.tsx` — per-cut checklist and Piezas**

Replace the engine import:

```tsx
import { EDGE_BANDING_NOTE, HARDWARE_LABELS, edgeBandTotals, edgeCodes } from '@/lib/engine';
```

with:

```tsx
import {
  CUT_TIP,
  EDGE_BANDING_NOTE,
  HARDWARE_LABELS,
  cutText,
  edgeBandTotals,
  edgeCodes,
  sheetCuts,
} from '@/lib/engine';
```

Replace:

```tsx
  const allPieces = useMemo(() => layout.sheets.flatMap((s) => s.pieces), [layout]);
  const done = allPieces.filter((p) => checked.includes(`${p.panelId}#${p.instance}`)).length;
  const pct = allPieces.length ? (done / allPieces.length) * 100 : 0;
```

with:

```tsx
  const allPieces = useMemo(() => layout.sheets.flatMap((s) => s.pieces), [layout]);
  const cutsBySheet = useMemo(() => layout.sheets.map((s) => sheetCuts(s)), [layout]);
  const cutIds = cutsBySheet.flatMap((cuts, i) => cuts.map((c) => `${i + 1}:${c.n}`));
  const done = cutIds.filter((id) => checked.includes(id)).length;
  const pct = cutIds.length ? (done / cutIds.length) * 100 : 0;
```

Change `<SheetSvg sheet={sheet} labels={labels} edges={edges} checked={checked} />` to:

```tsx
              <SheetSvg sheet={sheet} labels={labels} edges={edges} checked={checked} sheetNo={i + 1} />
```

In the checklist header, change `{`${done} de ${allPieces.length} cortes`}` to:

```tsx
            {`${done} de ${cutIds.length} cortes`}
```

Replace the whole checklist body — the `<View style={{ marginTop: 12, gap: 6 }}>` block that maps `allPieces` into `Pressable` rows, up to its closing `</View>` — with:

```tsx
        <Mono tone={color.textSoft} size={11} style={{ marginTop: 10, lineHeight: 16 }}>
          {CUT_TIP}
        </Mono>

        <View style={{ marginTop: 12, gap: 6 }}>
          {cutsBySheet.map((cuts, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Mono tone={color.textSoft} size={10} style={styles.sheetHead}>
                {`Hoja ${i + 1} — ${layout.sheets[i]!.stock.label}`}
              </Mono>
              {cuts.map((c) => {
                const id = `${i + 1}:${c.n}`;
                const isDone = checked.includes(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggleCut(id)}
                    style={({ pressed }) => [
                      styles.check,
                      taller && { minHeight: 68, borderWidth: 2 },
                      isDone && { backgroundColor: color.cardAlt, opacity: 0.7 },
                      pressed && { transform: [{ scale: 0.99 }] },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isDone }}
                  >
                    <View style={[styles.box, isDone && { borderColor: color.red, backgroundColor: color.red }]}>
                      <Text style={{ fontSize: 15, color: isDone ? color.white : 'transparent' }}>✓</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.checkLabel,
                          isDone && { color: color.textSoft, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {`${c.n} · ${cutText(c)}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
```

Directly after the checklist section's closing `</View>` (before the `Lista de compras` section), add the read-only Piezas list:

```tsx
      <View style={styles.section}>
        <Display size={22} semi style={{ letterSpacing: 0.66 }}>
          Piezas
        </Display>
        <View style={styles.shopping}>
          {allPieces.map((p, i) => {
            const band = edges[p.panelId];
            const codes = band ? edgeCodes(band) : '—';
            const panel = panelsById[p.panelId];
            return (
              <View key={`${p.panelId}#${p.instance}`} style={[styles.shopRow, i > 0 && styles.shopDivider]}>
                <Body tone={color.text} size={14} style={{ flex: 1 }}>
                  {`${labels[p.panelId] ?? p.panelId} ${p.instance + 1}`}
                </Body>
                <Mono tone={color.textSoft} size={12}>
                  {`${panel?.length ?? p.length} × ${panel?.width ?? p.width} mm${codes === '—' ? '' : ` · ${codes}`}`}
                </Mono>
              </View>
            );
          })}
        </View>
      </View>
```

In `const styles = StyleSheet.create({`, add after `sectionHead: …,`:

```tsx
  sheetHead: { marginTop: 6, letterSpacing: 1.2, textTransform: 'uppercase' },
```

- [ ] **Step 3: `mobile/src/lib/store.ts` — the id format**

Replace:

```ts
  /** `${panelId}#${instance}` for every cut ticked off in the checklist. */
```

with:

```ts
  /** `"{sheet}:{n}"` for every saw cut ticked off in the checklist (sheet 1-based). */
```

- [ ] **Step 4: `mobile/src/lib/app-provider.tsx` — clear ticks when the layout can change**

In `setParam`, replace:

```tsx
          // the Cubrecanto choice adds/removes a step, so step numbers shift
          ...(key === 'edgeBanding' ? { activeStep: INITIAL.activeStep, doneSteps: [] } : null),
```

with:

```tsx
          // cut ids ("{sheet}:{n}") follow the layout, which any param can change
          checked: [],
          // the Cubrecanto choice adds/removes a step, so step numbers shift
          ...(key === 'edgeBanding' ? { activeStep: INITIAL.activeStep, doneSteps: [] } : null),
```

- [ ] **Step 5: Typecheck and export**

Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → completes (output goes to gitignored `mobile/dist/`).
Run (repo root): `git status --short mobile` → only the four files above.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/sheet-svg.tsx mobile/src/screens/result/cuts.tsx mobile/src/lib/store.ts mobile/src/lib/app-provider.tsx
git commit -m "feat(mobile): tick saw cuts in order on iOS

Sheets show a numbered badge where each cut starts, greyed once ticked.
The checklist now follows the saw sequence per sheet with the measuring
tip on top, piece sizes and banding codes move to a read-only Piezas
list, and changing any parameter clears the ticks since cut ids follow
the layout.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Docs and full verification (local only)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md**

In "## Engine conventions", replace:

```markdown
- Cut totals come from `sheetCuts`: one crosscut under each row that stops short of the sheet bottom, one rip after each piece that stops short of the right edge, one trim per piece shorter than its row — an upper bound, since a sawyer can trim equal pieces in one pass; meters round up to 0.1. `orderText` is the order sent to the lumber yard and never contains prices.
```

with:

```markdown
- Cuts come from `sheetCuts`, in saw order and numbered per sheet: row by row from the top, a crosscut under the row (measured from the top), then per run of equal-length pieces either rips piece by piece (full-height runs) or one rip at the run's end, one shared trim and short rips between its pieces (short runs), each measured from the left or top edge of the board at that moment. `cutTotals` sums that sequence (meters round up to 0.1), so the order, the cost and the saw steps always agree. `cutText`, `CUT_TIP` and `cutBadge` give both clients the same copy and badge placement. `orderText` is the order sent to the lumber yard and never contains prices.
```

In "## Phase plan and status", on the line starting `  - **4.4 Cut sequence**`, replace ` *In progress.*` at the end with ` *Implemented; awaiting user approval.*`.

- [ ] **Step 2: Full verification**

Run: `pnpm test` → all PASS.
Run: `pnpm typecheck` → no errors.
Run: `pnpm demo` → exit 0; JSON `cuts` is `{ "count": 12, "meters": 12.2 }`.
Run (in `mobile/`): `npx tsc --noEmit` → no errors.
Run (in `mobile/`): `npx expo export --platform ios` → completes.

If any command fails, do not commit; report the failing command and its output.

- [ ] **Step 3: Commit (local only — do not push)**

```bash
git add CLAUDE.md
git commit -m "docs: record the cut sequence convention for Phase 4.4

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
