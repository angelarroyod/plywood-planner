# Phase 4.2 — Edge banding

Date: 2026-09-24 · Branch: `feat/edge-banding` (stacked on `feat/materials`, PR #6)

## Goal

Say which edges of each piece get edge banding (cubrecanto), how many meters of which band to buy, and who applies it. That is what a Mexican lumber yard needs to band pieces to order, and what a beginner needs to do it at home. The same work removes the plywood-only copy that 4.1 left behind (sanding advice on melamine).

## Scope

In:

- Per-panel edge flags `L1/L2/A1/A2`, set by each template for the edges that show.
- One "Cubrecanto" select per template: `Sin cubrecanto` / `Lo aplica la maderería` (default) / `Lo aplico yo (plancha)`.
- Band type per stock; meters per band type.
- Step 1 wording that depends on material and banding; an extra ironing step when banding is applied at home.
- Banding shown on both clients: cut-list codes, lines on the sheet diagrams, totals.
- Plywood-only copy fixes: the "Lija grano 180" shopping line only with plywood, and headers no longer say triplay only.

Out:

- Thick banding (1–2 mm) and deducting it from cut sizes.
- Band colors other than white PVC and pine veneer.
- Banding shown in 3D.
- Banding and cutting costs (4.3).

## Domain facts used

- Mexican parts lists use the columns `LARGO, ANCHO, VETA, L1, L2, A1, A2`. L edges run along the piece's length, A edges along its width.
- The everyday band is 0.45 mm thick, below the 3 mm saw kerf, so **cut size = finished size** and nesting is unchanged.
- Band width must exceed the board: 16 mm for 12 mm boards, 19 mm for 15–16 mm, 22 mm for 18 mm.
- Pre-glued band is applied at home with a clothes iron and trimmed with a cutter.

## Engine

### Types (`src/engine/types.ts`)

```ts
/** Which edges get banding. L1/L2 run along the panel's length, A1/A2 along its width.
 *  Templates put the most visible long edge in L1 (the front). */
export interface EdgeBands { L1: boolean; L2: boolean; A1: boolean; A2: boolean }
export type EdgeCode = keyof EdgeBands;
export type EdgeBandingMode = 'none' | 'yard' | 'diy';
```

- `Stock` gains `material: 'triplay' | 'melamina' | 'fibracel'` and `edgeBand: { label: string } | null`.
- `Panel` gains `edges: EdgeBands`, always present; all false means no banding.
- `Design` gains `edgeBanding: EdgeBandingMode`, decoded from the param once so views never read raw params.

### Catalog additions (`src/engine/stock.ts`)

| id | material | edgeBand.label |
|---|---|---|
| 1 Triplay de pino 12 mm | `triplay` | `Cubrecanto de chapa de pino 16 mm` |
| 2 Triplay de pino 15 mm | `triplay` | `Cubrecanto de chapa de pino 19 mm` |
| 3 Triplay de pino 18 mm | `triplay` | `Cubrecanto de chapa de pino 22 mm` |
| 4 Melamina blanca 16 mm | `melamina` | `Cubrecanto PVC blanco 19 × 0.45 mm` |
| 5 Fibracel 3 mm | `fibracel` | `null` |

### `src/engine/edge-banding.ts` (new; re-exported from `index.ts`)

```ts
export const EDGE_BANDING_OPTIONS = [
  { value: 0, label: 'Sin cubrecanto' },
  { value: 1, label: 'Lo aplica la maderería' },
  { value: 2, label: 'Lo aplico yo (plancha)' },
];
export const DEFAULT_EDGE_BANDING = 1;
export function edgeBandingMode(value: number): EdgeBandingMode; // 0→'none', 1→'yard', 2→'diy'; throws on anything else (params are validated first)

export const NO_EDGES: EdgeBands; // all false
/** The given edges banded, unless the mode is 'none'. */
export function bandEdges(mode: EdgeBandingMode, ...codes: EdgeCode[]): EdgeBands;
/** 'L1 A1' in L1 L2 A1 A2 order, or '—' when none. */
export function edgeCodes(edges: EdgeBands): string;

export const EDGE_TRIM = 30; // mm added per banded edge for trimming
export interface EdgeBandTotal { label: string; meters: number; edges: number }
/** Meters per band label, in first-seen order. Σ over banded edges of (edge length + EDGE_TRIM) × qty,
 *  rounded UP to 0.1 m. Panels whose stock has no edgeBand, or no banded edge, are skipped. */
export function edgeBandTotals(panels: Panel[]): EdgeBandTotal[];

/** Opening sentence(s) of a template's first step. */
export function prepSentence(stock: Stock, mode: EdgeBandingMode): string;
/** The ironing step body (no order), for mode 'diy'. */
export function ironStep(panelRefs: string[]): Omit<Step, 'order'>;
/** Web note under the banding totals. */
export const EDGE_BANDING_NOTE: Record<'yard' | 'diy', string>;
```

- **Rounding:** `meters = Math.ceil(totalMm / 100) / 10`. For example, 7084 mm gives 7.1 m.
- **`prepSentence`:**
  - `triplay`: `Lija todas las piezas con grano 180.`
  - Otherwise: `Limpia las piezas con un trapo húmedo; la melamina no se lija.`
  - Then, when the mode is `yard`, append ` Revisa que la maderería haya enchapado los cantos marcados en la lista de cortes.`
  - Or, when the mode is `none` and the material is `melamina`, append ` Sin cubrecanto, los cantos de melamina absorben humedad y se despostillan: séllalos con pintura o barniz.`
- **`ironStep`:**
  - title: `Aplica el cubrecanto`
  - description: `Con la plancha a temperatura media y sin vapor, pasa despacio sobre el cubrecanto pre-engomado en cada canto marcado en la lista de cortes. Deja enfriar y recorta el sobrante con un cúter.`
  - `panelRefs` as given.
- **`EDGE_BANDING_NOTE`:**
  - yard: `Lo aplica la maderería en los cantos marcados.`
  - diy: `Lo aplicas tú con plancha (cubrecanto pre-engomado).`

### Templates

Both templates get a new param, `{ kind: 'select', key: 'edgeBanding', label: 'Cubrecanto', unit: '', options: EDGE_BANDING_OPTIONS, default: DEFAULT_EDGE_BANDING }`, placed after `material`. Each design sets `mode = edgeBandingMode(p['edgeBanding']!)` and `edgeBanding: mode`.

Edges (`bandEdges(mode, …)`):

| Template | Panel | Banded edges |
|---|---|---|
| Bookshelf | `side` | L1 (front), A1 (top end) |
| | `top`, `bottom`, `shelf` | L1 (front) |
| | `back` (Fibracel) | `NO_EDGES` always |
| Side table | `top` | L1, L2, A1, A2 |
| | `side` | L1, L2 |
| | `shelf` | L1, L2 |

Default totals:

- Bookshelf 800 × 1200 × 300, 3 shelves, plywood 18: 9 edges, 6814 mm, plus 270 mm trim = **7.1 m** of `Cubrecanto de chapa de pino 22 mm`.
- Side table 500 × 350 × 450, plywood 18: 10 edges, 4356 mm, plus 300 mm trim = **4.7 m**.

Steps:

- Step 1's description becomes `${prepSentence(stock, mode)} ` followed by the template's marking sentence:
  - Bookshelf: `Marca en los laterales la posición de la base, la tapa y los ${N} entrepaños.`
  - Side table: `Marca en los laterales la posición del entrepaño a ${SHELF_CLEARANCE} mm del piso.`
- When the mode is `diy`, `ironStep(ids of panels with any banded edge)` is inserted as step 2:
  - Bookshelf: `['side', 'top', 'bottom', 'shelf']`
  - Side table: `['top', 'side', 'shelf']`
- Steps are numbered `order = index + 1` after assembly, so they are always contiguous. With `yard` or `none`, the bookshelf back stays step 5; with `diy`, it becomes step 6.

Validation: `edgeBanding` outside 0–2 is rejected by `paramIssues` like any select (`«Cubrecanto» debe ser uno de: …`).

## Web (`src/`)

- **`components/SheetSvg.tsx`:** new prop `edges: Record<string, EdgeBands>` (panelId → edges). Each banded edge of a piece is a line inset 7 mm inside the piece, stroke width 14, color `var(--color-piece-label)` (dark in screen and print; no new token). Mapping:
  - Unrotated pieces (panel length along the sheet's y): L1 = left, L2 = right, A1 = top, A2 = bottom.
  - Rotated pieces: L1 = top, L2 = bottom, A1 = left, A2 = right.
- **`components/CutDiagram.tsx`:**
  - Passes `edges` to `SheetSvg`.
  - Adds a `Cubrecanto` column with `edgeCodes(p.edges)` to the cut list, only when `design.edgeBanding !== 'none'`.
  - Adds a `Cubrecanto` block under Tornillería when `edgeBandTotals` is non-empty: one line per total (`label` + `${meters.toFixed(1)} m`, mono) and the `EDGE_BANDING_NOTE` for the mode.
- **`components/PrintReport.tsx`:** the same column and a `Cubrecanto` section (totals + note); passes `edges` to `SheetSvg`.
- **`App.tsx`:** header `Muebles de triplay` becomes `Muebles de triplay y melamina`.
- **`ParamForm.tsx`:** unchanged (the select is generic).

## iOS (`mobile/`)

- **`components/sheet-svg.tsx`:** same `edges` prop and edge-line mapping, color `color.plyLabel`.
- **`screens/result/cuts.tsx`:**
  - Passes `edges` to `SheetSvg`.
  - Checklist rows append `· ${edgeCodes(edges)}` when the panel has any banded edge.
  - The shopping list adds one line per `edgeBandTotals` entry (name `label`, qty `${meters.toFixed(1)} m`).
  - `Lija grano 180` appears only when some panel's stock is `triplay`.
- **`app/index.tsx`:** tagline `Un mueble de triplay bien planeado, …` becomes `Un mueble bien planeado, …` (rest unchanged).
- **`app/measure.tsx`:** unchanged (the select is generic).

## Scripts

`scripts/demo.ts` adds `edgeBanding: edgeBandTotals(panels)` to its JSON.

## CLAUDE.md (with the implementation)

Add to Engine conventions:

- **Edge banding:** `Panel.edges` flags `L1/L2` (along the length) and `A1/A2` (along the width). Templates set them for visible edges via `bandEdges(mode, …)`, with L1 the most visible long edge.
- Banding is 0.45 mm and never changes cut size.
- Totals add `EDGE_TRIM` (30 mm) per banded edge and round up to 0.1 m.
- Stocks with `edgeBand: null` are never banded.

## Tests (Vitest)

`edge-banding.test.ts` (new):

- `edgeBandTotals` groups by label, multiplies by qty, adds 30 mm per edge, and rounds up (7084 mm → 7.1).
- It skips `edgeBand: null` stocks and panels with no banded edge; `[]` returns `[]`.
- `edgeCodes` orders L1 L2 A1 A2 and returns `—` for none.
- `bandEdges('none', 'L1')` is all false.
- `edgeBandingMode` maps 0/1/2 and throws on 3.
- `prepSentence` covers plywood + yard, melamine + diy, melamine + none (warning), and plywood + none (no warning).

`stock.test.ts`: `material` and `edgeBand.label` for all five stocks.

`templates.test.ts`:

- The default mode is `yard`.
- `edgeBanding: 0` gives all-false edges and `edgeBanding: 'none'`.
- Bookshelf and side-table edges match the table above.
- Totals are 7.1 m and 4.7 m at defaults.
- `edgeBanding: 2` inserts step 2 `Aplica el cubrecanto` with the listed `panelRefs`, orders are 1..n contiguous, and the bookshelf back step becomes 6.
- Step 1 starts with the plywood sentence for material 3 and the melamine sentence for material 4 (side table, width 500).
- Melamine + `edgeBanding: 0` includes the sealing warning.
- `edgeBanding: 5` gives a `paramKey: 'edgeBanding'` issue.

Existing tests keep passing (the default mode is `yard`, so the bookshelf back is still step 5).

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm demo`.
- `mobile/`: `npx tsc --noEmit`, `npx expo export --platform ios`.
- Web preview: the three Cubrecanto options; the code column appears and disappears; edge lines on the sheets (a plywood sheet and an unbanded Fibracel sheet); totals and note; the print view; the ironing step (6 steps on the bookshelf) with `diy`.

## Delivery

One PR from `feat/edge-banding` → `feat/materials`; it retargets when #6 merges.
