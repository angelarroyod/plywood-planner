# Phase 5.2 — Drawers + TV stand

Date: 2026-09-25 · Branch: `feat/drawers` (local, starting from `feat/cut-sequence`, which now carries Phase 5.1 through merged PR #10)

## Goal

Add drawers as a reusable engine building block and use it twice:
- as a "Cajones" option under the closet's doors;
- in a new "Mueble para TV" template: two bays split by a divider, each with drawers or an open shelf.

Drawers run on telescopic slides. Each drawer is a screwed box with a separate front, so a beginner lines up the fronts after the boxes already run.

## Scope

In:

- **Engine:**
  - the `drawerSet` block (`src/engine/parts/drawer.ts`);
  - the `slide` hardware type;
  - `mergeHardware`;
  - `PartSet`, the shared fragment type (5.1's `DoorSet`, renamed);
  - closet drawers;
  - the `tvStand` template.
- **Web:** no component changes. It gets a browser check only.
- **iOS:** the `KIND` label for the TV stand.

Out:

- Doors in TV stand bays; doors in bays come with 5.3's pantry and desk.
- Roller (epoxy) slides, soft-close slides, drawer dividers, a param for front height, and more than 2 bays.

## Engine

### Fragments and hardware

- 5.1's `DoorSet` is renamed `PartSet`, the shape every building block returns: `{ panels, placements, hardware, fittings, boring, steps }`. `doorSet` returns `PartSet`.
- New `mergeHardware(items: Hardware[]): Hardware[]` in `src/engine/parts/merge.ts`.
  - It sums `qty` for items with the same `type`, `size` and `cutTo`, keeping first-seen order.
  - Every template that combines fragments passes its hardware through it. Otherwise the case's `confirmat 5x50` and `screw 3.5x16` would appear twice, as would the doors' and drawers' `handle 128 mm` — duplicate order lines and duplicate cost keys.
- `Hardware.type` gains `'slide'`, and `HARDWARE_LABELS.slide = 'Corredera telescópica (par)'`.
- A new screw size, `'3.5x25'`, fixes the drawer fronts.

### Drawer block (`src/engine/parts/drawer.ts`)

```ts
export const SLIDES = [
  { inches: 10, mm: 254 }, { inches: 12, mm: 305 }, { inches: 14, mm: 356 }, { inches: 16, mm: 406 },
  { inches: 18, mm: 457 }, { inches: 20, mm: 508 }, { inches: 22, mm: 559 },
];
export const MIN_DRAWER_FRONT = 120; // mm; leaves an 80 mm box
export function slideFor(depth: number): { inches: number; mm: number } | null; // longest with mm ≤ depth − 10
export function drawerFrontHeight(count: number, bottom: number, top: number): number; // ⌊(top − bottom − 4 − 3(count − 1)) / count⌋

export interface DrawerStack {
  frontLeft: number; frontRight: number; // exact x span of the fronts
  openingLeft: number; openingRight: number; // x span between the walls the boxes run in
}
export function drawerSet(o: {
  count: number; // drawers per stack, stacked bottom to top
  stacks: DrawerStack[]; // 1 or 2 columns side by side, all the same size
  bottom: number; top: number; // y range the fronts cover
  frontZ: number; // z of the case front
  depth: number; // inside depth available for the slides
  stock: Stock;
  mode: EdgeBandingMode;
}): PartSet;
```

`drawerSet` does not validate. The template checks `MIN_DRAWER_FRONT`, and `slideFor(depth)` must not be null; if it is, `drawerSet` throws, since that is a programmer error, like `nest()`.

**Geometry**, with `n = count` and `s = stacks.length`:

- **Fronts:**
  - Height `hf = drawerFrontHeight(n, bottom, top)`: 2 mm gaps at the ends and 3 mm between fronts. Front `i` (0 = lowest) spans `bottom + 2 + i·(hf + 3)` to that plus `hf`.
  - Width `wf = frontRight − frontLeft`.
- **Slide and box:**
  - Slide `slideFor(depth)`; the box depth `L` is the slide's `mm`.
  - Box outside width `wb = ⌊(openingRight − openingLeft) − 26⌋` (12.7 mm slide clearance each side, rounded down to whole mm).
  - Box height `hb = hf − 55`. Box underside `by = fy + 30` (30 mm above the front's bottom edge, clearing the Base by 29 − t mm); its top sits 25 mm below the front's top edge, clearing a Tapa or shelf above.

**Panels.** "Largo" is always the grain direction, as the lumber yard reads it.

| id | label | length × width | qty | grain | banded |
|---|---|---|---|---|---|
| `drawer-front` | Frente de cajón | wf × hf | n·s | `'length'` (horizontal) | all four edges |
| `drawer-side` | Costado de cajón | L × hb | 2·n·s | `'length'` | none |
| `drawer-end` | Frente y trasera de cajón | (wb − 2t) × hb | 2·n·s | `'length'` | none |
| `drawer-bottom` | Fondo de cajón | L × wb, Fibracel 3 | n·s | `'any'` | none |

**Placements.** Every drawer is drawn pulled out by `pull = round(L / 3)` along +z, box and front together.
- The front is `[wf, hf, t]`, from z = `frontZ + pull` to `frontZ + t + pull`.
- The box runs from z = `frontZ − L + pull` to `frontZ + pull` and is centred between `openingLeft` and `openingRight`:
  - sides `[t, hb, L]`;
  - ends `[wb − 2t, hb, t]`, one at each end of the box;
  - the bottom `[wb, 3, L]`, directly under the box walls.

**Fittings:** one `drawer-handle` "Jaladera" per drawer, a horizontal box `[160, 12, 30]` centred on its front and standing 30 mm proud of it.

**Hardware per drawer**, multiplied by n·s:

| Item | Qty per drawer | Use |
|---|---|---|
| `confirmat 5x50` | 8 | the box |
| `screw 3.5x16` | `⌈2(wb + L) / 150⌉` | the bottom, every 15 cm |
| `screw` (`3.5x25` if `t ≥ 15`, else `3.5x19`) | 4 | the front, from inside |
| `screw M4×NN` (45 if `t ≥ 18`, 40 if `t ≥ 15`, else 35) | 2 | bolts the handle through the front and the box: the handle's own screws don't reach |
| `slide` `` `${inches}" (${mm} mm)` `` | 1 | the pair of slides |
| `handle 128 mm` | 1 | |

**Steps**, in Spanish. Slide heights are box centres measured above the Base (`bottom + t`), rounded:

1. **Arma las cajas.** Build each box with confirmat, 2 per corner (the sides go outside the ends). Square it by measuring the diagonals, then screw the Fibracel bottom underneath every 15 cm; sink the confirmat heads flush, since the slide runs over them.
   - `panelRefs: ['drawer-side', 'drawer-end', 'drawer-bottom']`.
2. **Monta las correderas.** Separate each slide into its two parts — they go on after the case is assembled, once the floor can no longer be reached.
   - Screw the fixed part to the walls of the opening, flush with the front, centred at `87 · 290 mm sobre la base`.
   - Screw the moving part to the box sides, flush with its front and centred in its height.
   - `panelRefs: ['drawer-side']`.
3. **Mete los cajones.** Clip each box onto its slides and check that it runs and closes flush with the front.
   - `panelRefs: ['drawer-side']`.
4. **Pon los frentes.** Leave 3 mm between fronts and 2 mm around them (cardboard or coins as spacers). Hold each front with double-sided tape, open the drawer and screw it from inside with 4 screws (3.5×25, or 3.5×19 on 12 mm boards).
   - `panelRefs: ['drawer-front']`, `explodeOffsets: { 'drawer-front': [0, 0, 150] }`.
5. **Pon las jaladeras de los cajones.** (Named apart from the doors' step, since both can appear in one closet.) Drill 2 holes of 5 mm, 128 mm apart, centred on each front and going through the box behind it, then bolt on the handle with 2 M4×NN screws — the handle's own screws don't reach through the box.
   - `panelRefs: ['drawer-front', 'drawer-handle']`.

With `count = 0` or no stacks, every list is empty.

### Closet drawers (`src/engine/templates/closet.ts`)

- **New param:** `{ kind: 'number', key: 'drawers', label: 'Cajones', unit: '', min: 0, max: 3, step: 1, default: 0 }`, placed after `shelfCount`.
- **When `drawers = n > 0`:**
  - The drawer zone runs from `P` (70) to `Z = P + 203n + 1`, so every front is exactly 200 mm.
  - New panel `drawer-shelf` "Techo de cajones", the same as the other flat shelves ((W − 2t) × Dc, banded L1, qty 1). It is centred on Z, at y `Z − t/2` to `Z + t/2`.
  - Drawers: `drawerSet({ count: n, stacks: [{ frontLeft: −W/2 + 2, frontRight: W/2 − 2, openingLeft: −W/2 + t, openingRight: W/2 − t }], bottom: P, top: Z, frontZ: D/2, depth: Dc, stock, mode })`.
  - Doors cover `Z` to `H`: `doorSet({ …, bottom: Z, top: H })`.
  - The interior's floor, where Colgar hanging, the Mixto zone and the shelf gaps are measured from, becomes `Z + t/2` instead of `P + t`. The validation messages don't change.
  - `avoid` gains the drawer shelf.
- **Hardware:**
  - The drawer shelf counts as a shelf-like panel: 4 confirmat and one run of back screws.
  - The drawer hardware is added, and everything passes through `mergeHardware`.
- **Steps:**
  - The mark line adds `techo de cajones a {Z − t/2} mm` after the Base.
  - The install step's title is `Instala ${spanishList(names)}`, from `el techo de los cajones`, `el maletero` and `los entrepaños` as present. `spanishList` gets its 1-item branch back.
  - The back step's list adds `al techo de los cajones` after the Base.
  - The drawer steps come after the rod step and before the door steps.
- **With `drawers = 0`,** the design is unchanged from 5.1.

Example (plywood 18, 800 × 2000 × 550, 2 drawers, 2 doors):

| Part | Value |
|---|---|
| Z | 477 |
| Drawer shelf | 468–486 |
| Fronts | 796 × 200, spanning 72–272 and 275–475, centres 172 · 375 |
| Slides | 20" (508), heights 87 · 290 above the Base |
| Boxes | 738 wide, 145 tall, pulled out 169 |
| Bottom screws | 17 per drawer |
| Doors | 1519 tall, 3 hinges, cups at 100 · 760 · 1419, plates at 579 · 1238 · 1898 |

Merged hardware (Colgar, 2 drawers, 2 doors):

| Item | Qty |
|---|---|
| confirmat 5x50 | 34 |
| screw 3.5x16 | 70 |
| rod 15×30 mm (cutTo 762) | 1 |
| rod-support 15×30 mm | 2 |
| screw 3.5x25 | 8 |
| screw M4x45 | 4 |
| slide `20" (508 mm)` | 2 |
| handle 128 mm | 4 |
| hinge 35 mm recta | 6 |

- Colgar fits, with 1078 mm under the rod.
- Mixto does not: 60 mm below its zone, so the existing "No caben la zona de colgar…" message shows under `height` — with drawers > 0 it now also suggests "usa menos cajones".

### TV stand (`src/engine/templates/tv-stand.ts`)

`{ id: 'tv-stand', name: 'Mueble para TV', description: 'Mueble bajo para TV con dos bahías de cajones o entrepaño y paso de cables atrás.' }`

**Params:**

| key | label | kind | range / options | default |
|---|---|---|---|---|
| `width` | Ancho | number, step 10 | 1000–1800 | 1400 |
| `height` | Alto | number, step 10 | 400–650 | 500 |
| `depth` | Profundidad | number, step 10 | 350–500 (overall, back included) | 400 |
| `leftBay` | Bahía izquierda | select | Cajones 1 · Entrepaño 2 | 1 |
| `rightBay` | Bahía derecha | select | Cajones 1 · Entrepaño 2 | 2 |
| `drawersPerBay` | Cajones por bahía | number, step 1 | 1–3 | 2 |
| `material` | Material | select | `MATERIAL_OPTIONS` | `DEFAULT_MATERIAL` |
| `edgeBanding` | Cubrecanto | select | `EDGE_BANDING_OPTIONS` | `DEFAULT_EDGE_BANDING` |

**Geometry.** Notation as in the closet: `P = 70`, `Dc = D − 3`, `zc = 1.5`, case centred on x. `bay = ⌊(W − 3t) / 2⌋` is each bay's inside width (rounded down to whole mm), and `hd = H − P − 2t` is the height between the Base and the Tapa.

| id | label | size (length × width) | qty | banded | placement |
|---|---|---|---|---|---|
| `side` | Lateral | H × Dc | 2 | L1, A1 | full height at x = ±(W − t)/2 |
| `top` | Tapa | (W − 2t) × Dc | 1 | L1 | y H − t … H |
| `bottom` | Base | (W − 2t) × Dc | 1 | L1 | y P … P + t |
| `plinth` | Zoclo | (W − 2t) × P | 1 | L1 | y 0 … P, flush with the front |
| `divider` | Divisor | hd × Dc | 1 | L1 | x = 0, y P + t … H − t |
| `shelf` | Entrepaño | bay × Dc | Entrepaño bays | L1 | halfway up its bay: bottom face at `P + t + (hd − t)/2`, staggered ±25 mm (`SHELF_STAGGER`) when both bays hold a shelf, so the divider screws of one clear the other's end |
| `back` | Fondo | W × (H − 100), Fibracel | 1 | none | y 0 … H − 100 (100 mm cable slot at the top), z = −D/2 + 1.5 |

- Sides and divider keep `length` as their height, the grain direction, even when that is shorter than their depth.
- **Drawers:** one `drawerSet` call with `count = drawersPerBay` covering `P` to `H`, with one stack per Cajones bay:
  - left: `{ frontLeft: −W/2 + 2, frontRight: −2, openingLeft: −W/2 + t, openingRight: −t/2 }`;
  - right: `{ frontLeft: 2, frontRight: W/2 − 2, openingLeft: t/2, openingRight: W/2 − t }`.

**Validation:**

| Condition | paramKey | Message |
|---|---|---|
| Range violations | the param | existing `paramIssues` |
| `bay` exceeds the stock's `maxSpan` | `width` | existing `spanIssue(bay, stock)` |
| A Cajones bay and `drawerFrontHeight(n, P, H) < 120` | `drawersPerBay` | `Con {n} cajones por bahía cada frente quedaría de {h} mm y el mínimo es 120 mm. Usa menos cajones o aumenta el alto.` |

The shallowest depth (350) still fits 12" slides, so there is no depth rule.

**Hardware:**
- `confirmat 5x50`: 4 each for the Tapa, Base, divider and each bay shelf, plus 2 for the zoclo.
- `screw 3.5x16` for the back: `⌈(W + 2(H − 100)) / 200⌉` (the back's top edge is free, 100 mm below the Tapa, so only the bottom and the two sides take screws) + `⌈(H − 100) / 200⌉` (up the divider) + `⌈bay / 200⌉` per bay shelf.
- The drawer hardware, then everything through `mergeHardware`.

**Steps:**

1. **Prepara y marca.**
   - `prepSentence(stock, mode)`.
   - Mark the Base (`70 mm`) on the sides; with one shelf, `entrepaño a {underside} mm`, with both, `entrepaño izquierdo a {underside} mm, entrepaño derecho a {underside} mm` (staggered).
   - In the divider, mark each shelf again, measured from the divider's own bottom edge (`shelf underside − (P + t)`).
   - Mark the centre of the Tapa and the Base for the divider.
2. The iron-on banding step (`ironStep`), only when Cubrecanto is set to iron-on; it lists only panels that actually carry a banded edge (same filter as the closet).
3. **Arma la caja.**
   - Screw the Base and the Tapa between the sides with confirmat, 2 per side.
   - Screw the divider at their centre marks, 2 confirmat through each, before the zoclo, while the underside is still reachable; cover the heads with tapones.
   - Then fix the zoclo under the Base, at the front, with 1 per side.
4. **Instala el entrepaño** (**Instala los entrepaños** when both bays are Entrepaño), only when a bay is Entrepaño, with 2 confirmat per end, heads flush.
5. **Verifica la escuadra y coloca el fondo.**
   - With the stand face down, check that the diagonals are equal.
   - Screw the Fibracel back, smooth face toward the front, every 20 cm, starting from the bottom edge: to the sides, the Base (`a {P + t/2} mm del borde de abajo`), the divider and the shelf.
   - `Deja libres los 10 cm de arriba para pasar los cables.`
6. The `drawerSet` steps.

Default (plywood 18, 1400 × 500 × 400, left bay Cajones, right bay Entrepaño, 2 per bay):

| Part | Value |
|---|---|
| Bay | 673 wide |
| Divider | 394 × 397 |
| Shelf | 276–294 |
| Fronts | 696 × 211, spanning 72–283 and 286–497, centres 178 · 392 (rounded from 177.5 · 391.5) |
| Slides | 14" (356), heights 92 · 306 above the Base |
| Boxes | 647 wide, 156 tall, pulled out 119 |
| Bottom screws | 14 per drawer |
| Back | 1400 × 400 |

Merged hardware:

| Item | Qty |
|---|---|
| confirmat 5x50 | 34 |
| screw 3.5x16 | 45 (17 back + 28 drawer bottoms) |
| screw 3.5x25 | 8 |
| screw M4x45 | 4 |
| slide `14" (356 mm)` | 2 |
| handle 128 mm | 2 |

Width limits: plywood 18 allows up to 1650 wide, melamine 16 up to 1140. Three drawers per bay at 400 tall would be 106 mm each, which fails.

## Clients

- **Web:** no component changes. Drawers are panels, placements and fittings the viewer already draws. Their steps use `refLabels`, and their hardware goes through `hardwareText`. Fibracel drawer bottoms join the back's Fibracel group in Pedido and on the PDF.
- **iOS:** `mobile/src/app/templates.tsx` gains `KIND['tv-stand'] = 'mueble'`.
- **Templates:** `src/engine/index.ts` exports `tvStand`, `generateTvStand` and `drawer.ts`, and `templates` becomes `[bookshelf, sideTable, closet, tvStand]`.

## Tests (Vitest)

- **`parts/drawer.test.ts`:**
  - `drawerFrontHeight` for n = 1, 2, 3;
  - `slideFor` edges: 264 gives 10", 263 gives null, 567 gives 20", 569 gives 22";
  - one closet stack: the panel table, box width, height and depth, and front spans;
  - two stacks: quantities doubled, placements in both columns;
  - pulled out by `round(L/3)`;
  - handles, per-drawer hardware and totals, step heights, and `count = 0` returning empty lists.
- **`parts/merge.test.ts` (or with the drawer tests):** `mergeHardware` sums equal items, keeps first-seen order, and keeps items with a different `cutTo` apart.
- **Closet:**
  - `drawers = 0` gives the same design as before, so the existing tests pass unchanged;
  - the 2-drawer example above: Z, drawer shelf, fronts, slides, door height and hinge plates;
  - Mixto plus 2 drawers at 2000 fails under `height`; Colgar plus 2 drawers passes;
  - merged hardware, and the step order and text;
  - the sweep adds `drawers` 0 and 3, and keeps checking fit on the sheets, hinge-plate clearance and no overlapping boxes.
- **TV stand:**
  - the default panel table and placements, the back at H − 100, and hardware as above;
  - both bays Cajones (quantities doubled) and both Entrepaño (no drawers);
  - the span message at 1700 on plywood 18, and the 3-per-bay message at 400;
  - steps;
  - a sweep over material × width × height × depth × bays × drawers per bay: fit on the sheets and no overlapping boxes.
- **Shared template invariants:** `tvStand` joins the loop.
- **Order:** the TV stand text contains `Corredera telescópica (par) 14" (356 mm) × 2`.

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm demo` (bookshelf output unchanged).
- `mobile/`: `npx tsc --noEmit`, `npx expo export --platform ios`.
- Web preview:
  - the closet with 2 drawers: fronts below the doors, boxes pulled out, the drawer steps highlighting;
  - the TV stand default and both-Cajones: two stacks, no overlap, cable slot visible behind the top;
  - Pedido and the PDF list the drawer pieces, slides and merged hardware once each;
  - no console errors.

## Delivery

Local branch `feat/drawers`. Nothing is pushed until the user asks.
