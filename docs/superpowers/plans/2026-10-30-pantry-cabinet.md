# Kitchen Pantry Cabinet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Alacena" template: a tall kitchen pantry with a fixed counter-height shelf, upper doors, and lower doors or drawers, plus an anti-tip step.

**Architecture:** A pure `generatePantry(params) => GenerateResult` in `src/engine/templates/pantry.ts`, merging its case with `doorSet` (twice, with the new `row` option) and `drawerSet`. Every view derives from the `Design`; the web only gains a thumbnail.

**Tech Stack:** TypeScript (strict), Vitest, React 18 (thumbnail only).

**Spec:** `docs/superpowers/specs/2026-10-30-pantry-cabinet-design.md`

## Global Constraints

- `src/engine/` imports nothing from React, the DOM or three.js.
- UI copy is Spanish (es-MX); code, comments and commits are English, as conventional commits.
- No new dependencies.
- Units are millimetres; every panel fits a 1220 × 2440 sheet across the param range.
- Issue messages are Spanish and carry `paramKey`.
- Hardware always passes through `mergeHardware`.

## Review Focus

- `doors = 2` at `width = 400` with lower doors: both rows must report a single `doors` issue, not two. Pin it with `issuesOf({ doors: 2, width: 400 })` → one issue.
- With drawers, the upper door row keeps the plain ids `door` / `handle`, so the closet-style tests and `refLabels` still work. Pin it in the Cajones test.
- Hinge plates near the fixed shelf (900 mm) at extreme heights: the sweep's `expectBuildable` checks every row's boring, not only `boring[0]`.
- A 12 mm board with no doors (allowed): the bracket screws stay `3.5x13`. Pin it in the hardware test.
- Melamine 16 at the default 600 width spans 568 > 550: the default material stays plywood 18. The span message covers it, and the shared loop's melamine case uses width 500.

---

### Task 1: `doorSet` rows

**Files:**
- Modify: `src/engine/parts/door.ts`
- Test: `src/engine/parts/door.test.ts`

**Interfaces:**
- Produces: `DoorSetOptions.row?: 'upper' | 'lower'`. Ids: `door-upper` / `handle-upper`, labelled "Puerta alta"; `door-lower` / `handle-lower`, labelled "Puerta baja". Omitting `row` changes nothing.

- [ ] **Step 1: Failing test** `names a second row of doors`. Call `doorSet({ ...opts, count: 2, row: 'upper' })` and expect:
  - `panels[0]` to be `{ id: 'door-upper', label: 'Puerta alta' }`;
  - the fitting ids to be `['handle-upper', 'handle-upper']`;
  - `boring[0].panelId` to be `'door-upper'`;
  - the titles to be `['Monta las placas de las puertas altas', 'Cuelga las puertas altas', 'Pon las jaladeras de las puertas altas']`;
  - every step's `panelRefs` to use the row ids.

  With `count: 1, row: 'lower'`, expect the titles `['Monta las placas de la puerta baja', 'Cuelga la puerta baja', 'Pon la jaladera de la puerta baja']`.
- [ ] **Step 2:** Run `pnpm vitest run src/engine/parts/door.test.ts`. It should fail.
- [ ] **Step 3:** Implement with a `ROWS` lookup keyed by `row ?? 'single'`, holding `{ id, handle, label, adjective }`. The step noun is `la puerta[ adj]` / `las puertas[ adjs]`.
- [ ] **Step 4:** Run the door and closet tests. Both should pass, and the closet's should be unchanged.

### Task 2: Pantry template

**Files:**
- Create: `src/engine/templates/pantry.ts`, `src/engine/templates/pantry.test.ts`
- Modify:
  - `src/engine/types.ts` (`Hardware.type` gains `'bracket' | 'wall-anchor'`);
  - `src/engine/labels.ts` (`bracket: 'Escuadra metálica'`, `'wall-anchor': 'Taquete con pija para muro'`);
  - `src/engine/index.ts` (export and register `pantry` last);
  - `src/engine/templates/testing.ts` (`drawerBoxClearance` flats gain `'fixed-shelf'`);
  - `src/engine/templates/templates.test.ts` (add `pantry` to the shared loop).

**Interfaces:**
- Consumes: Task 1's `row`; `drawerSet`, `mergeHardware`, `bandEdges`, `spanIssue`, `doorWidth`, `MIN_DOOR_THICKNESS`.
- Produces: `export const pantry: Template` (id `'pantry'`) and `export function generatePantry(raw: TemplateParams): GenerateResult`.

- [ ] **Step 1: Failing tests** in `pantry.test.ts`, using the spec's example values:
  - **Defaults:** `[id, label, length, width, qty]` is `side 2100×397×2`, `top`, `bottom`, `plinth 564×70`, `fixed-shelf 564×397`, `shelf 564×397×5`, `door-upper 'Puerta alta' 1196×596×1`, `door-lower 'Puerta baja' 826×596×1`, `back 2100×600`.
  - **Positions:** the fixed shelf is centred at y 900; the shelf centres are `[489.5, 1138.2, 1376.4, 1614.6, 1852.8]` (`toBeCloseTo`).
  - **Hardware equals:**
    - `confirmat 5x50` 34, `screw 3.5x16` 45, `screw 3.5x13` 4;
    - `bracket 2" (50 mm)` 2, `wall-anchor 1/4"` 4;
    - `hinge 35 mm recta` 5, `handle 128 mm` 2.
  - **Hinges:**
    - `boring` alongs `[100, 598, 1096]` (door-upper) and `[100, 726]` (door-lower);
    - `doors: 2` gives 10 hinges and 4 handles;
    - `{ height: 1500 }` gives door-upper 596 tall with 2 cups, and `{ height: 2400 }` gives 1496 tall with 3.
  - **Cajones `{ lower: 2 }`:**
    - no `door-lower` and no lower shelf (shelf qty 4);
    - upper door id `door`;
    - `drawer-front` `596×273×3`, slide `14" (356 mm)`.
  - **Steps:**
    - titles in order, including `'Instala el entrepaño fijo y los entrepaños'` and `'Fija la alacena al muro'` (`panelRefs: ['top']`), then the upper-row door steps and then the lower-row ones;
    - the marks sentence `base a 70 mm, entrepaño de abajo a 481 mm, entrepaño fijo a 891 mm, entrepaños a 1129 · 1367 · 1606 · 1844 mm.`;
    - the back step contains `2138 mm`.
  - **Validation:**
    - `{ width: 900, doors: 2 }` → span issue on `width` (one door would also break the 600 mm limit);
    - `{ shelfCount: 6, height: 1600 }` → the `shelfCount` message;
    - `{ doors: 1, width: 700 }` and `{ doors: 2, width: 400 }` → one `doors` issue each;
    - `{ material: 1, width: 500 }` → the `material` issue; with `doors: 0` the same input is ok.
  - **Sweep:**
    - materials × width `[400, 500, 600, 900]` × height `[1500, 2100, 2400]` × depth `[300, 600]` × shelfCount `[1, 6]` × lower `[1, 2]` × drawers `[2, 4]` × doors `[0, 1, 2]`;
    - every valid design nests and passes `expectBuildable`: all rows' hinge plates clear the flats, `drawerBoxClearance ≥ 5`, no `overlappingBoxes`, and drawer front height ≥ `MIN_DRAWER_FRONT`;
    - more than 150 designs are valid.
- [ ] **Step 2:** Run `pnpm vitest run src/engine/templates/pantry.test.ts`. It should fail (no module).
- [ ] **Step 3:** Implement `pantry.ts` following the closet's structure and the spec's tables. Constants: `PLINTH = 70`, `SPLIT = 900`, `MIN_SHELF_GAP = 150`, `MAX_SINGLE_DOOR = 600`, `MIN_DOOR = 200`, `BACK_SCREW_SPACING = 200`, `BRACKET_INSET = 50`. Then add the types, labels, registration, the testing helper and the shared loop.
- [ ] **Step 4:** Run `pnpm test`. It should pass.

### Task 3: Thumbnail, iOS label, docs, verification

**Files:**
- Modify:
  - `src/components/TemplatePicker.tsx` (`THUMBS.pantry`);
  - `mobile/src/app/templates.tsx` (`KIND.pantry = 'cocina'`);
  - `CLAUDE.md` (the 5.3 line plus a `doorSet` row note).

- [ ] **Step 1:** Add the thumbnail: a tall case split at counter height, with a zoclo line and one handle tick per door, in the same 1.5 px / 40 px style: `M12 4h16v32H12zM12 22h16M12 33h16M25 17v3M25 24v3`.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm test && pnpm build`. All three should pass.
- [ ] **Step 3:** In the browser (`pnpm dev`), pick Alacena and check 3D, Cortes, Pasos and Pedido in both the light and night themes. Also check Parte baja = Cajones.
- [ ] **Step 4:** Commit only when the user asks, then open a PR against `main` that says it stacks on #16.
