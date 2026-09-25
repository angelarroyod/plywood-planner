# Phase 5.1 — Doors + modular closet

Date: 2026-09-24 · Branch: `feat/closet` (local, stacked on `feat/cut-sequence`, PR #9)

## Goal

Add doors as a reusable engine building block, and use them in the first Phase 5 template: a one-module closet ("Clóset modular"). The module can hang clothes, hold shelves or do both. Its doors are drilled for 35 mm cup hinges by the lumber yard, so a beginner without a Forstner bit can still build it.

## Phase 5 decomposition

Each sub-project gets its own spec → plan → PR.

| # | Sub-project |
|---|---|
| **5.1** | **Doors + modular closet** (this spec) |
| 5.2 | Drawers: drawer-box block + slides, a drawer option on the closet, TV stand |
| 5.3 | More templates: pantry cabinet, desk, bed base with drawers, shoe rack, floating shelves |
| 5.4 | Fit this space: a niche W × H × D sizes a template |
| 5.5 | Tool-aware steps |
| 5.6 | Offcut suggestions |

## Scope

In:

- **Engine data model:**
  - new hardware types, `Hardware.cutTo`;
  - `Design.fittings`, `Design.boring`;
  - `Order.boring`, `Prices.boring`;
  - `hardwareText`.
- **Door block:** `src/engine/parts/door.ts`.
- **Closet template:** `src/engine/templates/closet.ts`.
- **Web:** draw fittings in 3D; a Barrenado table and price in Pedido and on the PDF order page; hardware lines via `hardwareText`; "Tornillería" becomes "Herrajes".
- **iOS:** draw fittings in 3D; hardware lines via `hardwareText`; `KIND` entry for the closet.

Out:

- **Later sub-projects:** drawers (5.2), other templates (5.3), fit-this-space (5.4), a yard/me drilling choice (5.5).
- **Never in this phase:** inset doors, soft-close hinges, a doors-closed view, several modules in one design.

## Engine data model

### Hardware

```ts
export interface Hardware {
  type: 'screw' | 'dowel' | 'confirmat' | 'hinge' | 'handle' | 'rod' | 'rod-support';
  size: string;
  qty: number;
  cutTo?: number; // mm, for items bought by length and cut to size (the rod)
}
```

- `HARDWARE_LABELS` gains:
  - `hinge: 'Bisagra de cazoleta'`
  - `handle: 'Jaladera'`
  - `rod: 'Tubo oval para clóset'`
  - `'rod-support': 'Soporte de tubo'`
- Sizes:
  - hinge `'35 mm recta'` (each includes its mounting plate)
  - handle `'128 mm'`
  - rod and rod support `'15×30 mm'`
- `hardwareKey` is unchanged (`type size`), so a rod's price does not change with its cut length.
- New `hardwareText(h: Hardware): string` in `labels.ts`:
  - it returns `` `${HARDWARE_LABELS[h.type]} ${h.size}` ``, plus `` `, cortado a ${h.cutTo} mm` `` when `cutTo` is set;
  - examples: `Tornillo confirmat 5x50`, `Tubo oval para clóset 15×30 mm, cortado a 762 mm`;
  - Every hardware line uses it:
    - engine: `orderText` and `orderCost`'s line labels;
    - web: `CutDiagram`, `OrderPanel`, `PrintReport`;
    - iOS: `screens/result/cuts.tsx`.

### Fittings and boring

```ts
/** A non-cut part drawn in 3D (rod, handle): an axis-aligned box like a Placement. */
export interface Fitting {
  id: string; // 'rod', 'handle'
  instance: number;
  label: string; // Spanish
  position: Vec3; // box center
  size: Vec3;
}

/** Holes a panel needs before assembly — today only 35 mm hinge cups, drilled by the yard. */
export interface Boring {
  panelId: string;
  kind: 'hinge-cup';
  diameter: number; // 35
  depth: number; // 12
  fromEdge: number; // 22, cup center from the hinge-side long edge
  along: number[]; // mm from the panel's top end, per cup
}

export interface Design {
  // …existing fields
  fittings: Fitting[];
  boring: Boring[];
}
```

- The bookshelf and side table return `fittings: []` and `boring: []`.
- `Step.panelRefs` may name a fitting id as well as a panel id.
  - Viewers highlight either one.
  - Clients look up a ref's label in `panels` first, then in `fittings`.

### Order and cost

```ts
export interface OrderBoring {
  n: number; // the order line of the drilled panel, so the yard can match it
  label: string;
  qty: number; // panels drilled alike
  diameter: number;
  depth: number;
  fromEdge: number;
  along: number[];
}
export interface Order { /* …existing */ boring: OrderBoring[] }
export interface Prices { /* …existing */ boring: number } // per hole
```

- `buildOrder` maps each `Design.boring` to an `OrderBoring`, using the panel's order line number `n` and its `qty`.
- `orderText` gets one line per drilled panel, after the pieces:
  - `Barrenado para bisagra de 35 mm: pieza 5 (×2), 4 perforaciones cada una a 100 · 675 · 1251 · 1826 mm desde arriba, centro a 22 mm del canto, 12 mm de profundidad.`
  - A total line follows: `Total de perforaciones: 8.`
- **Cost:**
  - `orderCost` adds a `Barrenado` line: total holes × `prices.boring`, unit `perforación`.
  - The line exists only when the order has boring, and counts as missing while the price is 0.
  - `normalizePrices` defaults a missing `boring` to 0, so older saved prices still load.

## Door block (`src/engine/parts/door.ts`)

```ts
export function hingeCount(doorHeight: number): number; // ≤900: 2, ≤1600: 3, ≤2000: 4, else 5
export function doorSet(opts: {
  count: 0 | 1 | 2;
  width: number; // outer case width the doors cover
  bottom: number; // y where the covered front starts
  top: number; // y where it ends
  frontZ: number; // z of the case front
  stock: Stock;
  mode: EdgeBandingMode;
}): { panels: Panel[]; placements: Placement[]; hardware: Hardware[]; fittings: Fitting[]; boring: Boring[]; steps: Omit<Step, 'order'>[] };
```

- **Doors:** full overlay, with a gap of `g = 2` mm at the outer edges, top and bottom, and 3 mm between a pair.
  - Height `h = top − bottom − 4`.
  - One door: width `w = width − 4`. Two doors: `w = ⌊(width − 7) / 2⌋` each.
  - Panel: `{ id: 'door', label: 'Puerta', length: h, width: w, grain: 'length', edges: bandEdges(mode, 'L1', 'L2', 'A1', 'A2'), qty: count }`.
- **Hinges:**
  - `k = hingeCount(h)` per door;
  - cups at `along = round(100 + i · (h − 200) / (k − 1))`, for i = 0…k−1;
  - the pattern is symmetric, so both doors of a pair are drilled the same way;
  - one `Boring` for `door`: diameter 35, depth 12, fromEdge 22;
  - hardware `hinge '35 mm recta'`, qty `count · k`.
- **Open 90° in 3D:** each door is a box `[t, h, w]` standing just in front of its side panel and sticking out forward.
  - Left door: center `[−width/2 + t/2, bottom + g + h/2, frontZ + w/2]`.
  - Right door: `x = width/2 − t/2`.
  - A single door hinges on the left.
- **Handles:** one `handle '128 mm'` per door, with a `Fitting` box `[30, 160, 12]`.
  - It sits on the open door's outer face: `x = ∓(width/2 + 15)`, `z = frontZ + w − 40`.
  - Its center is at y = 1050, clamped to stay 100 mm inside the door.
- **Steps**, in Spanish, with the plate heights measured from the floor (`bottom + g + h − along`, ascending):
  1. **Monta las placas.**
     - Screw each hinge plate to its side, 37 mm from the front edge, at `172 · 747 · 1323 · 1898 mm desde el piso`.
     - The doors come drilled from the maderería. If the user drills them: `broca Forstner de 35 mm, 12 mm de profundidad, centro a 22 mm del canto`.
  2. **Cuelga las puertas.** Clip each hinge onto its plate, then use the hinge screws to set a 2 mm gap all round (side, depth and height).
  3. **Pon las jaladeras.** Drill 2 × 5 mm holes 128 mm apart, 40 mm from the closing edge, at the handle height.
- **Plates clear the shelves.** `avoid?: { bottom; top }[]` lists the floor-y ranges of the case's fixed horizontal panels.
  - A cup whose plate (its height ± 25 mm) overlaps one moves to the nearest clear height: just below or just above that panel, with a tie going toward the door's middle.
  - The pattern may become asymmetric, so `BORING_NOTE` (after the drilling lines and under both Barrenado tables) says: cups on the inner face, a pair drilled in mirror, and ARRIBA marked on each door.
  - `MIN_DOOR_THICKNESS = 15`.
- With `count = 0` every list is empty.

## Closet template (`src/engine/templates/closet.ts`)

`{ id: 'closet', name: 'Clóset modular', description: 'Módulo de clóset con maletero, tubo para colgar y entrepaños; junta varios para cubrir una pared.' }`

### Params

| key | label | kind | range / options | default |
|---|---|---|---|---|
| `width` | Ancho | number, step 10 | 400–1000 | 800 |
| `height` | Alto | number, step 10 | 1200–2400 | 2000 |
| `depth` | Profundidad | number, step 10 | 400–650 (overall, back included, doors excluded) | 550 |
| `interior` | Interior | select | Colgar 1 · Entrepaños 2 · Mixto 3 | 3 |
| `shelfCount` | Entrepaños | number, step 1 | 1–8 | 3 |
| `doors` | Puertas | select | Sin puertas 0 · Una 1 · Dos 2 | 2 |
| `material` | Material | select | `MATERIAL_OPTIONS` | `DEFAULT_MATERIAL` |
| `edgeBanding` | Cubrecanto | select | `EDGE_BANDING_OPTIONS` | `DEFAULT_EDGE_BANDING` |

### Geometry

Notation: `t` = stock thickness, `tb` = Fibracel thickness, `P = 70` (zoclo height), `Dc = D − tb` (case depth). The case is centered on x, and its depth is centered at `zc = tb/2`, as in the bookshelf.

| id | label | size (length × width) | qty | banded (under the chosen mode) | placement (y range) |
|---|---|---|---|---|---|
| `side` | Lateral | H × Dc | 2 | L1, A1 | 0 … H |
| `top` | Tapa | (W − 2t) × Dc | 1 | L1 | H − t … H |
| `bottom` | Base | (W − 2t) × Dc | 1 | L1 | P … P + t |
| `plinth` | Zoclo | (W − 2t) × P | 1 | L1 | 0 … P, flush with the front |
| `hat-shelf` | Maletero | (W − 2t) × Dc | Colgar/Mixto: 1 | L1 | top face at H − t − 350 |
| `shelf` | Entrepaño | (W − 2t) × Dc | Entrepaños/Mixto: N | L1 | see Interior |
| `back` | Fondo | H × W, Fibracel | 1 | none | 0 … H, at z = −D/2 + tb/2 |
| `door` | Puerta | from `doorSet` | 0–2 | all four | from `doorSet({ width: W, bottom: P, top: H, frontZ: D/2 })` |

- All cut panels use grain `'length'`, except the back (`'any'`).
- Every panel fits a 1220 × 2440 sheet across the whole param range (H ≤ 2400, W ≤ 1000, Dc ≤ 647).

### Interior

- **Rod.** `rodY = H − t − 350 − t − 50`, which is 50 mm under the Maletero.
  - Rod interiors (Colgar, Mixto) get:
    - fitting `{ id: 'rod', size: [W − 2t − 2, 30, 15], position: [0, rodY, zc] }`;
    - hardware `rod '15×30 mm' qty 1, cutTo W − 2t − 2` and `rod-support '15×30 mm' qty 2`.
- **Colgar.**
  - Maletero plus rod; no shelves.
  - The hanging space runs from the rod down to the Base's top face (`P + t`).
- **Entrepaños.**
  - No Maletero and no rod.
  - N shelves spaced evenly between the Base's top face and the Tapa's underside: `gap = (H − P − 2t − N·t) / (N + 1)`.
- **Mixto.**
  - Maletero plus rod over a 1000 mm short-hanging zone.
  - The first shelf's top face is at `rodY − 1000` and closes off the zone.
  - The other N − 1 shelves are spaced evenly between the Base's top face and that shelf: `gap = (rodY − 1000 − t − (P + t) − (N − 1)·t) / N`.

Defaults (plywood 18): rod at 1564, first Mixto shelf top face at 564, lower gaps 140.7 mm.

### Validation

`generate` returns issues and never throws. Messages are in Spanish.

| Condition | paramKey | Message |
|---|---|---|
| Range violations | the param | existing `paramIssues` |
| `W − 2t` exceeds the stock's `maxSpan` | `width` | existing `spanIssue` |
| Rod interior and `D < 500` | `depth` | `Para colgar ropa el clóset necesita al menos 500 mm de fondo (un gancho mide unos 450 mm). Aumenta la profundidad o elige Entrepaños.` |
| Colgar and `rodY − (P + t) < 1000` | `height` | `Bajo el tubo quedan {x} mm y la ropa necesita al menos 1000 mm. Aumenta el alto o elige Entrepaños.` |
| Mixto and `rodY − 1000 − t − (P + t) < 100` | `height` | `No caben la zona de colgar de 1000 mm y un espacio útil debajo. Aumenta el alto o elige Colgar.` |
| Entrepaños/Mixto shelf gap `< 100` | `shelfCount` | `No caben {N} entrepaños: quedarían espacios de {gap} mm y el mínimo útil es 100 mm. Reduce los entrepaños o aumenta el alto.` |
| One door and `W − 4 > 600` | `doors` | `Una sola puerta de {w} mm pesa y se descuadra; el máximo es 600 mm. Usa dos puertas.` |
| Two doors and `⌊(W − 7)/2⌋ < 200` | `doors` | `Dos puertas quedarían de {w} mm y el mínimo es 200 mm. Usa una puerta.` |
| Doors and `t < 15` | `material` | `Las bisagras de cazoleta necesitan puertas de al menos 15 mm: la cazoleta mide 12 mm de profundidad. Elige un material de 15 mm o más, o quita las puertas.` |

The Mixto height row is the N = 1 case of the shelf-gap rule. When it fires, the shelf-gap issue is not reported.

### Hardware

- `confirmat '5x50'`:
  - 4 each for `top`, `bottom`, `hat-shelf` and every `shelf`;
  - 2 for `plinth`.
- `screw '3.5x16'` for the back: `ceil(2(W + H) / 200)` + one run of `ceil((W − 2t) / 200)` for each shelf-like panel (`hat-shelf` and `shelf`).
- Rod items: see Interior.
- Hinges and handles: from `doorSet`.

### Steps

Mark heights are measured from the floor and rounded to whole mm.

1. **Prepara y marca.**
   - `prepSentence(stock, mode)`.
   - Mark on the sides where each panel's underside goes, e.g. `Marca en los laterales la cara de abajo de cada pieza: base a 70 mm, entrepaños a 229 · 387 · 546 mm, maletero a 1614 mm.`
2. The iron-on banding step (`ironStep`), only when Cubrecanto is set to iron-on.
3. **Arma la caja acostada.**
   - Screw the Tapa and Base between the sides with confirmat, 2 per side, and fix the zoclo under the Base.
4. **Instala el maletero y los entrepaños** (with the wording adapted to the interior), 2 confirmat per side.
5. **Verifica la escuadra y coloca el fondo.** Flip the closet face down, measure both diagonals, then screw the
   Fibracel back every 20 cm to the sides, the Tapa, the Base (79 mm up from the bottom edge), the Maletero and
   each shelf. The step ends with `Al pararlo gira sobre su diagonal, que mide {⌈√(H² + D²)⌉} mm: revisa que
   libre tu techo.` (2075 mm by default).
6. **Pon el tubo** (rod interiors only).
   - Supports at `{rodY} mm del piso`, centered in the depth.
   - Cut the rod to `{W − 2t − 2} mm`.
   - `panelRefs: ['rod']`.
7. The `doorSet` steps.

Each step carries `explodeOffsets`, as in the bookshelf.

## Web (`src/`)

- **`components/Viewer3D.tsx`:** draw `design.fittings` as boxes in a steel tone (`#9aa3ad`, metalness 0.6, roughness 0.35).
  - They use the same explode scaling around the centroid and the same step offsets and highlight/dim rules as panels, keyed by fitting id.
- **`components/OrderPanel.tsx`:**
  - a **Barrenado** table when `order.boring` is non-empty (pieza, qty, holes, positions from the top);
  - a `Barrenado de bisagra (por perforación)` price field, shown only when the order has boring;
  - hardware rows via `hardwareText`.
- **`components/PrintReport.tsx`:** the same Barrenado table on the order page, and hardware rows via `hardwareText`.
- **Headings:** in `CutDiagram.tsx` and `PrintReport.tsx`, `Tornillería` becomes **`Herrajes`**, and hardware rows use `hardwareText`.
- **`components/StepsPanel.tsx`:** each ref's label comes from panels, then fittings.

## iOS (`mobile/`)

- **`components/viewer-3d.tsx`:** fittings are drawn as boxes in the same steel tone, with the same explode and highlight rules.
- **`screens/result/cuts.tsx`:** its shopping list uses `hardwareText`.
- **`screens/result/steps.tsx`:** each ref's label comes from panels, then fittings.
- **`app/templates.tsx`:** `KIND` gains `closet: 'clóset'`.
- The order share text comes from `orderText`, so Barrenado is included automatically.

## Tests (Vitest)

- **`parts/door.test.ts`:**
  - door sizes for 1 and 2 doors;
  - `hingeCount` at 900/901, 1600/1601, 2000/2001;
  - `along` for the default door (`[100, 675, 1251, 1826]`);
  - open-90° boxes for the left and right doors;
  - the handle-height clamp;
  - banding under each mode;
  - `count = 0` returns empty lists;
  - plate heights in the step text.
- **Closet** (`templates/closet.test.ts`, plus the shared template sweep):
  - the default design is valid;
  - a sweep over the param grid for every material checks that panels always nest;
  - one test per validation rule, checking the message and param;
  - interior geometry: 350 mm luggage space, `rodY`, the Mixto zone and gaps, Entrepaños gaps;
  - hardware counts;
  - fittings for each interior (no rod for Entrepaños);
  - the diagonal and mark heights in the steps.
- **`order.test.ts`:**
  - `hardwareText` with and without `cutTo`;
  - the Barrenado lines and total for the default closet;
  - no Barrenado for the bookshelf;
  - the rod's `cutTo` in the text.
- **`cost.test.ts`:**
  - the Barrenado line at 8 holes;
  - missing while the price is 0;
  - `normalizePrices` fills `boring: 0`.

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm demo` (unchanged bookshelf output).
- `mobile/`: `npx tsc --noEmit`, `npx expo export --platform ios`.
- Web preview, on the default closet:
  - two doors open at 90°;
  - the rod and handles drawn in steel;
  - the steps highlight the rod;
  - the Pedido Barrenado table and price;
  - the PDF order page with Barrenado;
  - the "Herrajes" headings;
  - each validation message under its field.

## Delivery

Local branch `feat/closet`, stacked on `feat/cut-sequence`. Nothing is pushed until the user asks.
