# Phase 4.1 — Materials catalog + bookshelf back panel

Date: 2026-09-24 · Branch: `feat/materials` (stacked on `docs/roadmap`, PR #3)

## Goal

Let a design use more than pine plywood, and let one design mix materials. The first mixed design is the bookshelf with a Fibracel back, which stops the case from racking.

Phase 4 is split into four sub-projects, each with its own spec → plan → PR: **4.1 Materials** (this), 4.2 Edge banding, 4.3 Lumber-yard order + full cost, 4.4 Cut sequence.

## Scope

In:

- Stock catalog: pine plywood 12/15/18 mm, white melamine 16 mm, Fibracel 3 mm (back only). All sheets 1220 × 2440.
- Stock is set per panel; nesting groups by stock; sheet size and grain come from the stock.
- One combined "Material" select replaces "Grosor del triplay" in both templates.
- Bookshelf gets an always-on Fibracel back.
- One price per material in use (web only).
- Both clients (web + iOS) and dev scripts updated.

Out (later, data-only or separate sub-projects):

- MDF, wood-look melamine, 1830 × 2500 / 1830 × 2440 Arauco Vesto formats — new `STOCKS` entries, no code.
- Distinct 3D color for the back.
- Price input on iOS.
- Edge banding, cut/banding costs (4.2, 4.3).

## Engine

### `src/engine/stock.ts` (new)

```ts
export interface Stock {
  id: number; // stable; TemplateParams are numeric
  label: string; // Spanish display name
  thickness: number; // mm
  hasGrain: boolean; // false → nesting may rotate any panel
  sheet: { length: number; width: number }; // mm; grain runs along length
  maxSpan: number | null; // max unsupported shelf span, mm; null = never a shelf
}

export const STOCKS: Stock[] = [
  { id: 1, label: 'Triplay de pino 12 mm', thickness: 12, hasGrain: true,  sheet: SHEET, maxSpan: 500 },
  { id: 2, label: 'Triplay de pino 15 mm', thickness: 15, hasGrain: true,  sheet: SHEET, maxSpan: 650 },
  { id: 3, label: 'Triplay de pino 18 mm', thickness: 18, hasGrain: true,  sheet: SHEET, maxSpan: 800 },
  { id: 4, label: 'Melamina blanca 16 mm', thickness: 16, hasGrain: false, sheet: SHEET, maxSpan: 550 },
  { id: 5, label: 'Fibracel 3 mm',         thickness: 3,  hasGrain: false, sheet: SHEET, maxSpan: null },
]; // SHEET = { length: 2440, width: 1220 }

export function getStock(id: number): Stock; // throws on unknown id (programming error)
export const FIBRACEL_3 = getStock(5);
export const DEFAULT_MATERIAL = 3; // Triplay de pino 18 mm

/** Options for a template's "Material" select: every stock that can be a shelf, in catalog order. */
export const MATERIAL_OPTIONS: { value: number; label: string }[];
```

`maxSpan` values are the tunable knobs — the only place span limits live. The melamine value (550) is conservative for particleboard under book loads; retune from real feedback.

Exported from `src/engine/index.ts`.

### `src/engine/types.ts`

- Delete `PlywoodThickness`.
- `Panel.thickness: PlywoodThickness` → `Panel.stock: Stock`.
- `ParamSpec` select: `options: number[]` → `options: { value: number; label: string }[]`.
- `NestingConfig` → `{ kerf: number }` (sheet size moves to `Stock.sheet`).
- `SheetLayout.thickness` → `SheetLayout.stock: Stock`.
- `NestingResult` → `{ sheets: SheetLayout[]; byStock: StockSummary[] }`, where `StockSummary = { stock: Stock; sheets: number; wastePercent: number }`. The overall `wastePercent` is removed: a mostly-empty Fibracel sheet would make a single figure misleading.
- `EngineConfig` → `{ nesting: NestingConfig }`; `spanLimits` is removed. `DEFAULT_CONFIG = { nesting: { kerf: 3 } }`.

### Nesting (`nesting.ts`)

- Group pieces by `panel.stock.id` (was thickness). Pieces of different stock never share a sheet.
- Effective grain = `panel.stock.hasGrain ? panel.grain : 'any'`. Templates keep declaring grain as design intent.
- Fit checks, shelf/sheet bounds and waste use `panel.stock.sheet`, not the config.
- The "does not fit" error names the stock's sheet size.
- Groups are emitted thickest first, ties by stock id — the case material comes before the back.
- `byStock` has one entry per group, same order; `wastePercent` = 1 − piece area ÷ (sheets × that stock's sheet area), kerf counted as waste.

### Cost

```ts
export function estimateCost(result: NestingResult, prices: Record<number, number>): number | null;
```

Sum of `sheets × prices[stock.id]` over `byStock`. Returns `null` if any stock in the layout has a missing or non-positive price. Prices for stocks not in the layout are ignored.

### Validation (`validation.ts`)

- `spanIssue(span: number, stock: Stock): ValidationIssue | null` (config argument dropped). Throws if `stock.maxSpan === null`. Message: `El claro de ${span} mm supera el máximo seguro de ${max} mm para ${stock.label.toLowerCase()}. Reduce el ancho o elige un material más grueso.`
- `paramIssues` for a select checks `options.some(o => o.value === value)`; the message lists labels: `«Material» debe ser uno de: Triplay de pino 12 mm, Triplay de pino 15 mm, …`.

### Templates

Both templates:

- The `thickness` param becomes `{ kind: 'select', key: 'material', label: 'Material', unit: '', options: MATERIAL_OPTIONS, default: DEFAULT_MATERIAL }`.
- `const stock = getStock(p['material']!)`, `t = stock.thickness`; panels carry `stock`.
- The `config` argument of `generateBookshelf` / `generateSideTable` is removed (only span limits used it).

Bookshelf, with `tb = FIBRACEL_3.thickness` and `Dc = D − tb` (the user's `depth` stays the overall depth):

| Panel | Stock | length × width | qty |
|---|---|---|---|
| `side` Lateral | material | H × Dc | 2 |
| `top` Tapa | material | span × Dc | 1 |
| `bottom` Base | material | span × Dc | 1 |
| `shelf` Entrepaño | material | span × Dc | N |
| `back` Fondo | Fibracel 3 mm, grain `'any'` | H × W | 1 |

- Case placements keep their x/y; z center `+tb/2`, depth `Dc`. So the case spans z ∈ [−D/2 + tb, D/2]; +z is the front (camera side).
- Back placement: position `[0, H/2, −D/2 + tb/2]`, size `[W, H, tb]`. The whole assembly spans exactly D in z.
- The back always fits a Fibracel sheet: param limits give W ≤ 1200 and H ≤ 2000 against 1220 × 2440.
- Hardware: existing confirmat line, then `{ type: 'screw', size: '3.5x16', qty: ⌈2(W+H)/200⌉ + N·⌈span/200⌉ }` (32 at defaults).
- Steps 1–4 unchanged. New step 5:
  - title `Coloca el fondo`
  - description `Con el librero boca abajo y a escuadra, apoya el fondo de fibracel con la cara lisa hacia el frente y atorníllalo cada 20 cm al contorno y a cada entrepaño. El fondo mantiene la escuadra.`
  - `panelRefs: ['back']`, `explodeOffsets: { back: [0, 0, −200] }`

Side table: only the `material` param change. No back.

## Web (`src/`)

- `state/store.ts`: `pricePerSheet: number` → `pricesByStock: Record<number, number>`; `setPricePerSheet` → `setPrice(stockId: number, price: number)` (clamped ≥ 0). PR #2 also edits this file; expect a trivial merge.
- `components/ParamForm.tsx`: select options render as a vertical list of full-width buttons showing `opt.label`; the selected style is unchanged (`border-cut bg-cut text-white`).
- `components/SheetSvg.tsx`: size from `sheet.stock.sheet`; the `config` prop is removed.
- `components/CutDiagram.tsx`:
  - The sheet header reads `Hoja {i} — {stock.label}`.
  - Cut-list thickness comes from `p.stock.thickness`.
  - Waste stat per `byStock` entry.
  - The cost section has one `Precio por hoja — {label} (MXN)` input per `byStock` entry, a `{sheets} × ${price}` line each, and the total from `estimateCost`, or `—` / `define precios` when it returns null.
  - The stat label changes from `Costo triplay` to `Costo material`.
- `components/PrintReport.tsx`: the sheet heading is `Hoja {i} — {stock.label}`, plus `· veta a lo largo` only when `stock.hasGrain`. The cost line is `· costo estimado de material $X MXN`, shown only when non-null.

## iOS (`mobile/`)

- `src/app/measure.tsx`: select options as a vertical labelled list (same behavior as web). The summary names the sheet count per material; waste moves to Stats.
- `src/components/sheet-svg.tsx`: size from `sheet.stock.sheet`, not `DEFAULT_CONFIG.nesting`.
- `src/screens/result/cuts.tsx`: each sheet titled `${stock.label} · ${width} × ${length}`, replacing the hard-coded `Triplay N mm · 1220 × 2440`.
- `src/screens/result/index.tsx`: the summary line shows `getStock(params.material).label` instead of `${thickness} mm`.
- `src/screens/result/stats.tsx`: waste per `byStock` entry.

## Scripts

`scripts/demo.ts` and `src/engine/ascii.ts` print `stock.label` and the stock's sheet size, and ascii renders each sheet at its own size.

## CLAUDE.md updates (with the implementation)

Engine conventions:

- **Sheet:** size comes from the panel's `Stock.sheet` (1220 × 2440 for every current stock); grain runs along the sheet's length.
- **Grain:** stocks with `hasGrain: false` nest every panel as `'any'`.
- "Panels of different thickness never share a sheet" → "Panels of different stock never share a sheet."
- **Span limits:** live in `STOCKS[].maxSpan` (`src/engine/stock.ts`), not `DEFAULT_CONFIG`.
- **Select params:** carry `{ value, label }` options; material is a numeric stock id.

## Tests (Vitest, engine)

Nesting:

- Plywood 18 + Fibracel 3 in one call → separate sheets; `byStock` has two entries, plywood first.
- A grain-`'width'` 2000 × 500 panel throws on plywood 18 and nests on white melamine 16.
- A test-only stock with a 1830-wide sheet places two 900-wide pieces side by side on one shelf.
- `byStock[i].wastePercent` computed per stock.

`estimateCost`:

- Sums per stock.
- Returns `null` when a used stock has no price or a price ≤ 0.
- Ignores prices for unused stocks.

Validation:

- `spanIssue` returns null within `maxSpan`, and an issue naming the lowercased label beyond it.
- It throws for a stock with `maxSpan: null`.
- A select rejects a value outside its options; the message lists the labels.

Bookshelf:

- The back is `H × W` on Fibracel.
- Case panels are `D − 3` wide.
- The min z of the back and the max z of the case are D apart.
- 32 screws at defaults.
- Step 5 refs `back`.
- Material 4 (melamine) at W = 800 → span issue on `width` (768 > 550).

Side table: no `back` panel. Existing tests move from `thickness` to `material` ids.

## Verification

- `pnpm test`, `pnpm typecheck`.
- `mobile/`: `npx tsc --noEmit`, `npx expo export --platform ios`.
- Web preview: material list renders and switches; the bookshelf cut diagram shows plywood + Fibracel sheets with per-material waste; price inputs per material, total `—` until all are set; the print view headings.

## Delivery

One PR from `feat/materials` → `docs/roadmap`. It retargets to `main` when PR #3 merges.
