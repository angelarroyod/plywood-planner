# Phase 4.4 — Cut sequence

Date: 2026-09-24 · Branch: `feat/cut-sequence` (local, stacked on `feat/order`, PR #8)

## Goal

Give a beginner cutting at home with a circular saw a numbered, ordered list of saw cuts per sheet. Each cut says which way to cut and how far from which edge of the board they are holding, and the cut numbers are drawn on the sheet diagrams. Neighbouring pieces of the same length are trimmed in one pass. The sequence becomes the single source for the cut count and meters that 4.3's order and cost already show.

## Scope

In:

- Engine:
  - `sheetCuts` returns the cuts in saw order, numbered per sheet, each with an edge-relative measurement.
  - Equal-length short pieces next to each other are trimmed in one pass.
  - `cutTotals` sums the sequence.
  - New `cutText`, `CUT_TIP` and `cutBadge`.
- Web:
  - Numbered badges on each sheet.
  - A numbered list under each sheet in Cortes and in the PDF.
  - A **Cortes** stat.
- iOS:
  - The same badges.
  - The cut checklist ticks saw cuts in order.
  - The per-piece details move to a read-only **Piezas** list.

Out:

- Squaring factory edges first ("refilado").
- Saying which piece each cut frees.
- Saw selection.
- Animation.
- A "who cuts" (lumber yard / me) choice — Phase 5's tool-aware steps will own it.

## Engine (`src/engine/cuts.ts`)

```ts
/** One straight saw pass across a sheet, in sheet mm (origin top-left, x along width, y along length). */
export interface Cut {
  n: number; // 1-based, per sheet, in saw order
  kind: 'cross' | 'rip' | 'trim'; // cross/trim run across the grain (along x), rip runs along it (along y)
  x1: number; y1: number; x2: number; y2: number; // start → end; x1 ≤ x2, y1 ≤ y2
  from: 'top' | 'left'; // edge of the board as it is at this cut, to measure from
  mm: number; // distance from that edge to the cut line
}
export function sheetCuts(sheet: SheetLayout): Cut[];
export function cutTotals(layout: NestingResult): { count: number; meters: number };
export function cutText(cut: Cut): string;
export const CUT_TIP: string;
export function cutBadge(cut: Cut): { x: number; y: number };
```

### Sequence per sheet

Pieces sharing a `y` form a row; a row's height `h` is its tallest `length`. Rows are processed top to bottom, pieces in a row left to right. Each row:

1. **Cross** — if `y + h < sheet.length`: from `(0, y + h)` to `(sheet.width, y + h)`, `from: 'top'`, `mm: h`. The board's top edge is the row's `y`, because rows are packed edge to edge with the kerf between them.
2. The row splits into **runs**: maximal groups of neighbouring pieces with equal `length`.
   - **Full-height run** (`length === h`): for each piece whose right edge `x + width < sheet.width`, one **rip** from `(x + width, y)` to `(x + width, y + h)`, `from: 'left'`, `mm: width`.
   - **Short run** (`length < h`), spanning `x0` (first piece's `x`) to `x1` (last piece's `x + width`):
     1. If `x1 < sheet.width`: one **rip** from `(x1, y)` to `(x1, y + h)`, `from: 'left'`, `mm: x1 − x0`.
     2. One **trim** from `(x0, y + length)` to `(x1, y + length)`, `from: 'top'`, `mm: length`.
     3. For every piece but the last: one **rip** from `(x + width, y)` to `(x + width, y + length)`, `from: 'left'`, `mm: width`.
3. `n` counts 1… in the order the cuts are produced.

The set of cut lines is 4.3's, except that a short run shares one trim and its internal rips stop at the trimmed length.

### Totals, wording, badges

- `cutTotals`:
  - `count` = number of cuts over all sheets.
  - `meters = Math.ceil(Σ (|x2 − x1| + |y2 − y1|) / 100) / 10`.
- `cutText`: `{kind} — {mm} mm desde {edge}`.
  - kind: `A lo ancho` (cross), `A lo largo` (rip), `Recorte` (trim).
  - edge: `arriba` (`from: 'top'`), `la izquierda` (`from: 'left'`).
  - Examples: `A lo ancho — 1200 mm desde arriba`, `A lo largo — 297 mm desde la izquierda`, `Recorte — 764 mm desde arriba`.
- `CUT_TIP`: `Haz cada corte en la pieza donde está su número en el dibujo; mide desde el borde indicado y corta del lado del sobrante: el disco se come 3 mm.`
- `cutBadge(cut)`: the point `d = min(70, length / 2)` mm from `(x1, y1)` toward `(x2, y2)`, where the saw enters. Placing it there keeps it off the piece labels, which sit at each piece's center.

### Resulting numbers

| Design | Cuts | Meters |
|---|---|---|
| Default bookshelf (800 × 1200 × 300, 3 shelves, plywood 18) | **12** (4.3: 13) | **12.2 m** (4.3: 12.6 m) |
| Default side table | 8 | 5.1 m |

Default bookshelf, sheet by sheet:

- Plywood sheet:
  1. `A lo ancho 1200`
  2. `A lo largo 297`
  3. `A lo largo 297`
  4. `A lo largo 597` (end of the Tapa/Base run)
  5. `Recorte 764` (Tapa + Base in one pass)
  6. `A lo largo 297` (764 long)
  7. `A lo ancho 764`
  8. `A lo largo 297`
  9. `A lo largo 297`
  10. `A lo largo 297`
- Fibracel sheet:
  1. `A lo ancho 1200`
  2. `A lo largo 800`

## Web (`src/`)

- **`components/SheetSvg.tsx`:** after the pieces and band lines, one badge per `sheetCuts(sheet)` cut at `cutBadge(cut)`: a circle of radius 34 with `fill="var(--color-mark)"`, and the number `n` as text (font size 40, `fill="white"`, centered). `--color-mark` is signal red on screen and ink in print, so white text reads on both. No new token.
- **`components/CutDiagram.tsx`:**
  - `CUT_TIP` shown once above the sheets.
  - Under each sheet's caption, an `<ol>` of `{n}. {cutText(cut)}` in mono.
  - A new `Cortes` stat: value `count`, unit `{meters.toFixed(1)} m lineales`, from `cutTotals(layout)`.
- **`components/PrintReport.tsx`:** the same list under each printed sheet, with `CUT_TIP` once before the sheets.

## iOS (`mobile/`)

- **`components/sheet-svg.tsx`:**
  - The same badges, at the same size and placement.
  - A cut whose id is in `checked` draws its badge in the "done" tone.
  - Pieces no longer grey out, since progress is per cut.
- **`screens/result/cuts.tsx`:**
  - **Checklist de cortes:**
    - `CUT_TIP` on top.
    - Then, for each sheet, a heading `Hoja {i}` and one row per cut: `{n} · {cutText(cut)}`.
    - Rows toggle the id `"{sheet}:{n}"` (sheet 1-based).
    - The header count is `{done} de {total} cortes`.
  - **Piezas** (new, read-only, below the checklist): one row per placed piece with the label and instance, `{panel.length} × {panel.width} mm`, plus ` · {edgeCodes}` when banded — exactly what the checklist rows showed before.
- **`lib/store.ts`:** the `checked` doc comment becomes "`"{sheet}:{n}"` for every saw cut ticked off".

## Docs

The CLAUDE.md cut bullet becomes:

> Cuts come from `sheetCuts`, in saw order and numbered per sheet: row by row from the top, a crosscut under the row (measured from the top), then per run of equal-length pieces either rips piece by piece (full-height runs) or one rip at the run's end, one shared trim and short rips between its pieces (short runs), each measured from the left or top edge of the board at that moment. `cutTotals` sums that sequence (meters round up to 0.1), so the order, the cost and the saw steps always agree. `orderText` is the order sent to the lumber yard and never contains prices.

## Tests (Vitest)

`cuts.test.ts`, with hand-built layouts on plywood 18 (1220 × 2440):

- One 400 × 600 piece at the corner:
  - `n1` cross `(0,600)→(1220,600)`, `top 600`.
  - `n2` rip `(400,0)→(400,600)`, `left 400`.
- A piece filling the sheet: `[]`.
- Two full-height pieces (x 0 and 403): cross, then rip `left 400` at x 400, then rip `left 400` at x 803.
- Merged short run — a row with a 600-long piece at x 0 and two 500-long pieces at x 403 and 806:
  1. cross `top 600`.
  2. rip at x 400, `left 400`, length 600.
  3. rip at x 1206, `left 803`, length 600.
  4. trim `(403,500)→(1206,500)`, `top 500`.
  5. rip at x 803, `left 400`, length 500.
- A row that reaches the sheet bottom has no cross.
- Rows are taken top to bottom whatever the piece order; `n` is `1…k`.
- `cutTotals`: default bookshelf `{ count: 12, meters: 12.2 }`; default side table `{ count: 8, meters: 5.1 }`.
- `cutText` for each kind and edge.
- `CUT_TIP` text.
- `cutBadge`: 70 mm from the start on long cuts, and the midpoint on a cut shorter than 140 mm.

Updated 4.3 expectations:

- `order.test.ts`: the default text line `Cortes: 12 (12.2 m lineales).`; `order.cuts` becomes `{ count: 12, meters: 12.2 }`.
- `cost.test.ts`: the `Corte` line is `12.2 m` (per meter) or `12 corte` (per cut → subtotal 120); the full-price total is `1320`.

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm demo` (`cuts: { count: 12, meters: 12.2 }`).
- `mobile/`: `npx tsc --noEmit`, `npx expo export --platform ios`.
- Web preview:
  - Badges `1–10` on the plywood sheet and `1–2` on the Fibracel sheet.
  - The numbered lists and the tip.
  - The Cortes stat `12` / `12.2 m lineales`.
  - The print DOM lists.
  - The Pedido text `Cortes: 12 (12.2 m lineales).`

## Delivery

Local branch `feat/cut-sequence`, stacked on `feat/order`. Nothing is pushed until the user asks.
