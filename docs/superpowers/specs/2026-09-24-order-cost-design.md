# Phase 4.3 — Lumber-yard order + full cost

Date: 2026-09-24 · Branch: `feat/order` (stacked on `feat/edge-banding`, PR #7)

## Goal

Turn a design into what a beginner actually sends to a Mexican lumber yard: a numbered order ("Pedido para maderería") with every piece, its size, grain, banded edges, the sheets per material, the cut count and length, and the band to buy. Share it as a WhatsApp-ready text from both apps. Estimate the full cost on web: sheets, cutting, banding and hardware, all from prices the user types in.

## Scope

In:

- Engine: guillotine cut totals from the nesting layout; a structured `Order`; `orderText` for sharing; `orderCost` for the full cost. `orderCost` replaces `estimateCost`.
- Web:
  - A new **Pedido** tab: order table, Compartir / Copiar, and a cost editor.
  - Cortes keeps a **read-only** cost stat with an "Editar precios" button.
  - The order becomes page 1 of the PDF.
  - Prices are saved in `localStorage`.
- iOS: the "Lista de compras" export placeholder becomes a real **Pedido para maderería** share, using React Native's built-in `Share`.

Out:

- Cost on iOS.
- Saved prices on iOS (would need a new dependency).
- Numbered cut sequence (4.4 — it will reuse `sheetCuts`).
- Price databases.
- Sending the order to a lumber yard directly (Phase 7).

## Engine

### `src/engine/cuts.ts` (new)

```ts
/** One straight saw pass across a sheet, in sheet mm (origin top-left, x along width, y along length). */
export interface Cut {
  kind: 'cross' | 'rip' | 'trim';
  x1: number; y1: number; x2: number; y2: number;
}
/** The guillotine cuts that produce a sheet's pieces from its FFDH shelf layout. */
export function sheetCuts(sheet: SheetLayout): Cut[];
/** Every cut in the layout: count, and meters rounded UP to 0.1 m. */
export function cutTotals(layout: NestingResult): { count: number; meters: number };
```

Per sheet, pieces are grouped into rows (shelves) by their `y`. A row's height is the tallest `length` in it.

- **Cross:** one cut under each row whose bottom (`y + height`) is above the sheet's bottom (`< sheet.length`). It runs `x 0 → sheet.width` at `y + height`.
- **Rip:** within a row, pieces sorted by `x`. One cut after each piece whose right edge (`x + width`) is left of the sheet's right edge. It runs from the row's top to its bottom, at `x + width`.
- **Trim:** one cut for each piece shorter than its row (`length < height`). It runs across the piece at `y + length`.

Meters: `Math.ceil(Σ length / 100) / 10`, where each cut's length is `|x2 − x1| + |y2 − y1|`.

Default bookshelf (800 × 1200 × 300, 3 shelves, plywood 18):

- Plywood sheet: 2 crosscuts + 7 rips + 2 trims = 11 cuts, 10 126 mm.
- Fibracel sheet: 1 crosscut + 1 rip = 2 cuts, 2420 mm.
- Total: **13 cuts, 12.6 m**.

### `src/engine/order.ts` (new)

```ts
export interface OrderLine {
  n: number; // 1-based, continuous across groups
  label: string;
  length: number;
  width: number;
  qty: number;
  grain: 'length' | 'width' | null; // null when the stock has no grain or the panel is 'any'
  edges: EdgeBands;
}
export interface OrderGroup { stock: Stock; sheets: number; lines: OrderLine[] }
export interface Order {
  title: string; // template name, e.g. 'Librero'
  groups: OrderGroup[]; // one per stock, in layout.byStock order
  cuts: { count: number; meters: number };
  bands: EdgeBandTotal[];
  edgeBanding: EdgeBandingMode;
  hardware: Hardware[];
}
export function buildOrder(design: Design, layout: NestingResult, title: string): Order;
export function orderText(order: Order): string;
export const ORDER_BAND_NOTE: Record<'yard' | 'diy', string>;
```

- **Lines:** one per `Panel` (its `qty` is the quantity), in `design.panels` order within each group. A panel belongs to the group of its `stock.id`.
- **`ORDER_BAND_NOTE`:** it addresses the lumber yard, in first person.
  - yard: `Por favor enchápenlo en los cantos marcados.`
  - diy: `Solo el material (pre-engomado); yo lo aplico.`
- **`orderText`:** lines joined with `\n`. No prices. Format:

  ```
  Pedido para maderería — {title}
  Medidas en mm: largo × ancho.

  {stock.label} — {sheets} hoja|hojas de {sheet.width} × {sheet.length}
  {n}. {label} — {length} × {width} — {qty} pza|pzas[ — veta a lo largo| — veta a lo ancho][ — cubrecanto {edgeCodes}]
  …(blank line between groups)

  {band.label}: {meters.toFixed(1)} m.[ {ORDER_BAND_NOTE[mode]}]   ← one line per band; section omitted if no bands
  Cortes: {count} ({meters.toFixed(1)} m lineales).
  Herrajes: {HARDWARE_LABELS[type]} {size} × {qty} · …   ← omitted if no hardware
  ```

  - The `veta` part appears only when `grain` is non-null.
  - The `cubrecanto` part appears only when `edgeBanding === 'yard'` and `edgeCodes(edges) !== '—'`.
  - A single blank line separates the header, each group, and the totals block.

Default bookshelf, exactly:

```
Pedido para maderería — Librero
Medidas en mm: largo × ancho.

Triplay de pino 18 mm — 1 hoja de 1220 × 2440
1. Lateral — 1200 × 297 — 2 pzas — veta a lo largo — cubrecanto L1 A1
2. Tapa — 764 × 297 — 1 pza — veta a lo largo — cubrecanto L1
3. Base — 764 × 297 — 1 pza — veta a lo largo — cubrecanto L1
4. Entrepaño — 764 × 297 — 3 pzas — veta a lo largo — cubrecanto L1

Fibracel 3 mm — 1 hoja de 1220 × 2440
5. Fondo — 1200 × 800 — 1 pza

Cubrecanto de chapa de pino 22 mm: 7.1 m. Por favor enchápenlo en los cantos marcados.
Cortes: 13 (12.6 m lineales).
Herrajes: Tornillo confirmat 5x50 × 20 · Tornillo 3.5x16 × 32
```

### `src/engine/cost.ts` (new; `estimateCost` is removed from `nesting.ts`)

```ts
export interface Prices {
  sheets: Record<number, number>; // Stock.id → MXN per sheet
  cut: { unit: 'meter' | 'cut'; price: number }; // MXN per meter or per cut
  bands: Record<string, number>; // band label → MXN per meter
  hardware: Record<string, number>; // `${type} ${size}` → MXN per piece
}
export const EMPTY_PRICES: Prices; // { sheets: {}, cut: { unit: 'meter', price: 0 }, bands: {}, hardware: {} }
export function hardwareKey(h: Hardware): string; // `${h.type} ${h.size}`
export interface CostLine {
  key: string; // stable id for inputs: `sheet:{id}` | 'cut' | `band:{label}` | `hw:{hardwareKey}`
  label: string;
  qty: number;
  unit: string; // 'hoja' | 'm' | 'corte' | 'pza'
  price: number | null; // null when missing or ≤ 0
  subtotal: number | null;
}
export function orderCost(order: Order, prices: Prices): { lines: CostLine[]; total: number; missing: number };
```

Lines, in this order:

1. One per group: label `{stock.label}`, qty sheets, unit `hoja`.
2. `Corte`: qty `cuts.meters` (unit `m`) or `cuts.count` (unit `corte`), following `prices.cut.unit`.
3. One per band: label `{band.label}`, qty meters, unit `m`.
4. One per hardware line: label `{HARDWARE_LABELS[type]} {size}`, qty, unit `pza`.

`subtotal = qty × price`. `total` is the sum of the non-null subtotals. `missing` counts lines whose `price` is null.

## Web (`src/`)

- **`state/store.ts`:**
  - `View` gains `'order'`.
  - `pricesByStock` / `setPrice` become `prices: Prices` (initial `EMPTY_PRICES`) with setters `setSheetPrice(stockId, v)`, `setCutPrice(v)`, `setCutUnit(unit)`, `setBandPrice(label, v)`, `setHardwarePrice(key, v)`; prices are clamped to ≥ 0.
  - Wrap the store in Zustand's built-in `persist` (`zustand/middleware`, no new dependency): `name: 'planificador.prices'`, `version: 1`, and `partialize` returning `{ prices }` only. Nothing else persists.
- **`App.tsx`:**
  - Add the tab `{ id: 'order', label: 'Pedido', hint: 'Maderería' }` after Pasos.
  - Render `<OrderPanel design={design} />` when `view === 'order'`.
- **`components/OrderPanel.tsx` (new):**
  - Header `Pedido para maderería` + template name.
  - Actions:
    - **Compartir** is rendered only when `typeof navigator.share === 'function'`. It calls `navigator.share({ title, text })` and ignores an `AbortError`.
    - **Copiar** calls `navigator.clipboard.writeText(text)` and shows `Copiado` or `No se pudo copiar` next to the button.
  - Per group: the heading `{stock.label} — {sheets} hoja(s)`, then a table `# · Pieza · Largo · Ancho · Cant. · Veta · Cubrecanto`:
    - Veta shows `largo` / `ancho` / `—`.
    - Cubrecanto shows `edgeCodes`.
  - Totals: band meters with `ORDER_BAND_NOTE`, cuts, hardware.
  - **Costo** section: one row per `CostLine` with a number input (by `key`), `qty unit × $price = $subtotal`, and a `por metro / por corte` toggle on the `Corte` row. Then `Total $X MXN`, plus ` (faltan N precios)` when `missing > 0`.
- **`components/CutDiagram.tsx`:**
  - Remove the price inputs.
  - The `Costo material` stat becomes `Costo`: value `$${Math.round(total)}` when `total > 0` else `—`; unit `faltan N precios` when `missing > 0`, else `MXN estimado`.
  - Add a small **Editar precios** button that calls `setView('order')`.
- **`components/PrintReport.tsx`:**
  - Page 1 is the order: title, the same tables and totals, and `Costo estimado: $X MXN[ (faltan N precios)]` when `total > 0`, then a page break.
  - The old cost clause in the sheets line is removed.

## iOS (`mobile/`)

`src/screens/result/index.tsx`:

- The `EXPORTS` entry `{ tag: 'TXT', label: 'Lista de compras', … }` becomes `{ tag: 'TXT', label: 'Pedido para maderería', sub: 'Compártelo por WhatsApp o correo' }`.
- Its press handler calls `Share.share({ message: orderText(buildOrder(design, nest(design.panels), template.name)) })` (from `react-native`).
- On error it calls `flash('No se pudo compartir')`; a dismissed share does nothing.
- The other three entries keep their current placeholder behavior.

## Scripts

`scripts/demo.ts` JSON adds `cuts: cutTotals(layout)`.

## CLAUDE.md (with the implementation)

- The `estimateCost` bullet becomes: `orderCost` prices an `Order` line by line (sheets, cutting per meter or per cut, bands, hardware); `total` sums priced lines and `missing` counts unpriced ones; prices come only from the user (web saves them to `localStorage` under `planificador.prices`); `spanIssue` still throws for `maxSpan: null`.
- New bullet: cut totals come from `sheetCuts` — one rip under each row that doesn't reach the sheet bottom, one crosscut after each piece that doesn't reach the right edge, one trim per piece shorter than its row; meters round up to 0.1. `orderText` never contains prices.

## Tests (Vitest)

`cuts.test.ts`, with hand-built `SheetLayout`s on plywood 18 (1220 × 2440):

- One piece 400 wide × 600 long at (0, 0): 1 rip (1220) + 1 cross (600) = 2 cuts, 1820 mm.
- One piece filling the sheet: 0 cuts.
- Two 400 × 600 pieces side by side (x 0 and 403): 1 rip + 2 crosses.
- A 400 × 500 piece next to a 400 × 600 piece in one row: 1 trim (length 400).
- A row whose bottom is at 2440: no rip.
- `cutTotals` rounds meters up (1820 mm → 1.9 m).
- The default bookshelf gives `{ count: 13, meters: 12.6 }`.

`order.test.ts`:

- The default bookshelf groups are `[3, 5]` with lines numbered 1–5.
- `grain` is `'length'` on plywood and null for the Fibracel back, and for a melamine side table (material 4, width 500).
- `orderText` for the default bookshelf equals the exact block above.
- The no-banding variant has no `cubrecanto` parts and no band line.
- The `diy` variant uses the diy note.

`cost.test.ts`:

- The default bookshelf gives lines in order: 2 sheet lines, `Corte`, 1 band, 2 hardware.
- Per-meter vs per-cut qty/unit.
- Missing, 0 and negative prices count as `missing` and are excluded from `total`.
- The total adds up hand-computed values.
- No band line with `edgeBanding: 0`.
- `hardwareKey`.

`nesting.test.ts`: the `estimateCost` tests are removed along with the function.

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm demo`.
- `mobile/`: `npx tsc --noEmit`, `npx expo export --platform ios`.
- Web preview:
  - The Pedido tab table, totals and cost rows.
  - Copiar (read back via `navigator.clipboard.readText` if permitted, else check the `Copiado` status).
  - Prices survive a reload; the partial total with `faltan N precios`.
  - The Cortes read-only stat and "Editar precios" switching tabs.
  - The print DOM with the order as page 1.

## Delivery

One PR from `feat/order` → `feat/edge-banding`; it retargets when #7 merges.
