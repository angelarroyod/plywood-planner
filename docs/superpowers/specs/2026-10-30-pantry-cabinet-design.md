# Phase 5.3a — Kitchen pantry cabinet (Alacena)

Date: 2026-10-30 · Branch: `Angel/elegant-sanderson-aaedc0`, stacked on `feat/welding-projects` (PR #16, open)

The user skipped the brainstorming questions ("go ahead"), so every choice below that isn't already a repo convention is **my call**, and is marked that way.

## Goal

The first 5.3 template: a tall kitchen pantry that a beginner orders from the lumber yard and screws together. It reuses 5.1's `doorSet` and 5.2's `drawerSet` and adds only one small thing to a block: names for a second row of doors.

What makes it a pantry and not the closet's Entrepaños interior:

- It is shallow (300–600 mm), so cans don't get lost at the back.
- A fixed shelf at counter height (900 mm) splits it into an upper and a lower section, like a kitchen tall unit.
- The lower section holds either a second row of doors with one shelf, or a stack of drawers.
- The minimum shelf gap is a can's height (150 mm), not the closet's 100 mm.
- A pantry 2 m tall and 40 cm deep, full of cans, can tip over, so it ships with two anti-tip brackets and a step that fixes it to the wall.

## Scope

In:

- **Engine:**
  - the `pantry` template (`src/engine/templates/pantry.ts`), registered in `templates`;
  - `doorSet` gains an optional `row: 'upper' | 'lower'` that renames its panel, fitting and step titles;
  - two hardware types for the anti-tip step, `bracket` and `wall-anchor`;
  - `testing.ts`'s `drawerBoxClearance` counts the new `fixed-shelf` as a flat panel.
- **Web:** a thumbnail in `THUMBS`. No other component changes: every view derives from the `Design`.
- **iOS:** the `KIND` label (`pantry: 'cocina'`).

Out (my call):

- **Adjustable shelves** (shelf-pin holes on a 32 mm grid). They need a drilling jig or a yard that drills pin rows, and 5.5 owns the "who drills" choice. Fixed shelves also stiffen a tall, shallow case. Revisit with 5.5.
- A param for the split height or the lower section's shelf count. Counter height and one shelf cover the common case: pots below, groceries above.
- Pull-out baskets, door racks, spice-rack doors, corner pantries, and an upper/lower module split (two separate boxes).
- Anti-tip brackets on the closet and the bookshelf. That is a follow-up; this PR doesn't touch those templates.

## Engine

### `doorSet` rows (`src/engine/parts/door.ts`)

A case with two rows of doors calls `doorSet` twice, and both calls would return a panel `door` and fittings `handle` #0/#1 — duplicate ids in the cut list, the 3D keys and the step references. So `DoorSetOptions` gains:

```ts
row?: 'upper' | 'lower'; // names a row when a case has two; omit for a single row
```

| row | panel id | label | handle id | step noun (1 door / 2 doors) |
|---|---|---|---|---|
| omitted | `door` | Puerta | `handle` | la puerta / las puertas |
| `upper` | `door-upper` | Puerta alta | `handle-upper` | la puerta alta / las puertas altas |
| `lower` | `door-lower` | Puerta baja | `handle-lower` | la puerta baja / las puertas bajas |

Step titles with a row: "Monta las placas de {noun}", "Cuelga {noun}", "Pon {la jaladera / las jaladeras} de {noun}". Without a row they stay exactly as today, so the closet's design and tests don't change.

### Hardware types

| type | `HARDWARE_LABELS` | size used |
|---|---|---|
| `bracket` | Escuadra metálica | `2" (50 mm)` |
| `wall-anchor` | Taquete con pija para muro | `1/4"` |

The brackets screw to the Tapa with `screw 3.5x13`: 2 mm of bracket plus 13 mm stays inside even a 12 mm board, where a 3.5×16 would poke through.

### Template (`src/engine/templates/pantry.ts`)

`{ id: 'pantry', name: 'Alacena', description: 'Alacena alta de cocina con entrepaños, puertas arriba y abajo o cajones abajo; se fija al muro.' }`

**Params** (ranges and defaults are my calls):

| key | label | kind | range / options | default |
|---|---|---|---|---|
| `width` | Ancho | number, step 10 | 400–900 | 600 |
| `height` | Alto | number, step 10 | 1500–2400 | 2100 |
| `depth` | Profundidad | number, step 10 | 300–600 (overall, back included) | 400 |
| `shelfCount` | Entrepaños arriba | number, step 1 | 1–6 | 4 |
| `lower` | Parte baja | select | Puertas 1 · Cajones 2 | 1 |
| `drawers` | Cajones | number, step 1 | 2–4 | 3 |
| `doors` | Puertas | select | Sin puertas 0 · Una 1 · Dos 2 (per row) | 1 |
| `material` | Material | select | `MATERIAL_OPTIONS` | `DEFAULT_MATERIAL` |
| `edgeBanding` | Cubrecanto | select | `EDGE_BANDING_OPTIONS` | `DEFAULT_EDGE_BANDING` |

`drawers` only matters with `lower = 2`, the way the closet's `shelfCount` only matters for two of its interiors.

**Geometry.** As in the closet: `P = 70` (zoclo), `t` = board, `Dc = D − 3`, case centred on x and shifted +1.5 in z, `span = W − 2t`. `S = 900` is the fixed shelf's centre (my call: kitchen counter height), so the shelf spans `S − t/2 … S + t/2`.

| id | label | size (length × width) | qty | banded | where |
|---|---|---|---|---|---|
| `side` | Lateral | H × Dc | 2 | L1, A1 | full height |
| `top` | Tapa | span × Dc | 1 | L1 | H − t … H |
| `bottom` | Base | span × Dc | 1 | L1 | P … P + t |
| `plinth` | Zoclo | span × P | 1 | L1 | 0 … P, flush with the front |
| `fixed-shelf` | Entrepaño fijo | span × Dc | 1 | L1 | centred on S |
| `shelf` | Entrepaño | span × Dc | N, + 1 with lower doors | L1 | see below |
| doors, drawers | from the blocks | | | | |
| `back` | Fondo | H × W, Fibracel | 1 | — | behind the case |

- **Upper shelves:** N shelves spread evenly between the fixed shelf's top face (`U = S + t/2`) and the Tapa: `gap = (H − t − U − N·t) / (N + 1)`, undersides at `U + i·gap + (i − 1)·t`.
- **Lower section, `lower = 1` (Puertas):** one shelf halfway between the Base's top face and the fixed shelf's underside.
- **Lower section, `lower = 2` (Cajones):** `drawerSet({ count: drawers, stacks: [{ frontLeft: −W/2 + 2, frontRight: W/2 − 2, openingLeft: −W/2 + t, openingRight: W/2 − t }], bottom: P, top: S, frontZ: D/2, depth: Dc, stock, mode })`. The fixed shelf is the drawers' roof.
- **Doors:**
  - The upper row covers S … H.
  - With lower doors, a second row covers P … S. The rows are `row: 'upper'` and `row: 'lower'`.
  - With drawers, the upper row is unnamed (`door`, "Puerta"), as in the closet.
  - Both rows get `avoid` = every horizontal panel, so hinge plates clear the shelves.

**Validation**, Spanish, one issue per broken rule:

| rule | paramKey | message |
|---|---|---|
| `spanIssue(span, stock)` | `width` | the shared span message |
| upper `gap < 150` | `shelfCount` | `No caben {N} entrepaños arriba: quedarían espacios de {gap} mm y el mínimo útil es 150 mm (una lata mide unos 120 mm). Reduce los entrepaños o aumenta el alto.` |
| `doors = 1` and `doorWidth(1, W) > 600` | `doors` | the closet's message |
| `doors = 2` and `doorWidth(2, W) < 200` | `doors` | the closet's message |
| `doors > 0` and `t < MIN_DOOR_THICKNESS` | `material` | the closet's message |

Drawer fronts are never short: under a fixed 830 mm zone, 4 drawers give 204 mm fronts, well over `MIN_DRAWER_FRONT`. So the template doesn't validate them; the sheet-fit test asserts it instead (my call — a check that no input can trip is dead code). The same goes for `slideFor`: the 300 mm minimum depth still takes 10" slides.

**Sheet fit.** Sides are at most 2400 × 597, doors at most 1496 × 896, and the back at most 2400 × 900: every panel fits a 1220 × 2440 sheet across the whole param range.

**Hardware**, through `mergeHardware`:

| item | qty |
|---|---|
| `confirmat 5x50` | (Tapa + Base + fixed shelf + shelves)·4 + 2 for the zoclo |
| `screw 3.5x16` | back: `⌈2(W + H)/200⌉ + (1 + shelves)·⌈span/200⌉` |
| `screw 3.5x13` | 4 (2 per bracket) |
| `bracket 2" (50 mm)` | 2 |
| `wall-anchor 1/4"` | 4 |
| drawers and doors | from the blocks |

**Steps:**

1. **Prepara y marca.** `prepSentence`, then the marks bottom to top: `base a 70 mm`, `entrepaño de abajo a …` (lower doors only), `entrepaño fijo a …`, `entrepaños a … · … mm`.
2. **Aplica el cubrecanto** when banding at home (`ironStep`).
3. **Arma la caja acostada.** As in the closet.
4. **Instala el entrepaño fijo y los entrepaños.** Each on its mark, 2 confirmat per side.
5. **Verifica la escuadra y coloca el fondo.** As in the closet, with the pantry's pieces and the stand-up diagonal ("Al pararla gira sobre su diagonal…").
6. **Fija la alacena al muro.** Stand it against the wall and screw 2 brackets onto the Tapa, 50 mm in from each side, with 2 screws 3.5×13 each. Mark the wall, drill with a 1/4" bit (a masonry bit on block or brick), put in the anchors and drive the screws. If the ceiling leaves no room above the Tapa, fit the brackets under it instead. A full pantry can tip over, so don't skip this. `panelRefs: ['top']`.
7. The drawer steps (Cajones).
8. The door steps: the upper row, then the lower row.

### Example: the defaults

Plywood 18, 600 × 2100 × 400, 4 upper shelves, lower doors, one door per row:

| part | value |
|---|---|
| Fixed shelf | 891–909 |
| Lower shelf underside | 480.5 (marked 481) |
| Upper shelf gaps | 220.2; undersides 1129.2 · 1367.4 · 1605.6 · 1843.8 |
| Puerta alta | 1196 × 596, 3 hinges, cups at 100 · 598 · 1096 |
| Puerta baja | 826 × 596, 2 hinges, cups at 100 · 726 |
| Handles | upper at 1050 mm, lower at 798 mm |
| Diagonal | 2138 mm |

Hardware: confirmat 34 · screw 3.5x16 45 · screw 3.5x13 4 · bracket 2 · wall-anchor 4 · hinge 5 · handle 2.

## Tests (`src/engine/templates/pantry.test.ts`, plus the shared loop in `templates.test.ts`)

- The default panel list, placements of the fixed shelf and shelves, and hardware match the example above.
- Hinge counts: per-row `boring.along` lengths and the merged `hinge` quantity (5 with one door per row, 10 with two; upper rows of 596 / 1196 / 1496 mm get 2 / 3 / 3).
- Lower = Cajones: drawer fronts and slides, the upper doors renamed `door`, and no lower shelf.
- Every validation message.
- Sheet fit: a sweep over material × width × height × depth × shelfCount × lower × drawers × doors. Every valid design nests, has no overlapping boxes, clears its hinge plates and drawer boxes, and has drawer fronts ≥ `MIN_DRAWER_FRONT`.
- Steps reference real panel or fitting ids (the shared loop).
- `doorSet` with `row` renames the panel, the handle, the boring and the titles; without `row` it is unchanged.
