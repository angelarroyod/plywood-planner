# Plywood Furniture Planner

Beginner-friendly web app for designing plywood furniture. Users pick a template, customize dimensions within safe limits, and get three synchronized views: 3D preview, optimized cut diagram, and step-by-step build instructions. Everything exports to PDF.

## Core architecture principle (non-negotiable)

A furniture template is NOT a static 3D model. It is a pure function:

```
(params: TemplateParams) => Design
```

`Design` contains the full panel list (dimensions, grain, qty), hardware list, per-instance 3D placements, and assembly steps referencing panel IDs. All views (3D, cut diagram, instructions) derive from this single source of truth. Nothing is hand-drawn or duplicated per view.

## Repo rules

- `src/engine/` is pure TypeScript: ZERO imports from React, DOM APIs, or three.js. It must port to React Native (Expo) unchanged. Node-specific entry points (demo script) live in `scripts/`.
- UI copy in Spanish (es-MX); code, comments, and commit messages in English.
- Conventional commits.
- Ask before adding any dependency not already approved (approved: Vite, React 18, TypeScript, Tailwind, @react-three/fiber, @react-three/drei, Zustand, Vitest, pnpm).
- All internal units are millimeters. Display will support cm and mm.
- Supabase only in Phase 6 — no auth/backend scaffolding before then.

## Engine conventions

- `generate()` returns a `GenerateResult` envelope (`ok`/`issues`), never throws for validation. Issue messages are Spanish, human-readable, with `paramKey` when tied to one input.
- Stock: every `Panel` carries a `Stock` (material + thickness + sheet size + grain + max span) from the catalog in `src/engine/stock.ts`. Stock ids are stored in the numeric `material` param, so never renumber them — append new stocks. Every current stock is a 1220 × 2440 sheet; grain runs along the sheet's length. Sheet coords: origin top-left, x along width, y along length.
- Grain: `'length'` → panel length ∥ sheet grain; `'width'` → panel width ∥ sheet grain; `'any'` → free rotation. A panel whose stock has `hasGrain: false` always nests as `'any'`.
- Select params carry `{ value, label }` options; the label is shown, the numeric value is stored.
- Kerf (default 3 mm) applies between adjacent pieces, not at sheet edges. Kerf counts as waste.
- Panels of different stock never share a sheet. `NestingResult.byStock` reports sheets and waste per stock, thickest first — there is no single overall waste figure.
- Nesting is FFDH shelf packing — guillotine-cuttable by construction. Upgrade to a free-rectangle guillotine packer only if waste % becomes a problem.
- Assembly space: x = width, y = height (up), z = depth; floor at y = 0. +z is the front (camera side), so rear-mounted parts such as the bookshelf's back sit at −z. `Placement` = axis-aligned box (center + size), maps directly to `<boxGeometry>` in Phase 2.
- Span limits (max unsupported shelf span) live on each stock as `maxSpan`: plywood 12 → 500, 15 → 650, 18 → 800, white melamine 16 → 550; `null` (Fibracel) means never a shelf.
- `orderCost` prices an `Order` line by line — sheets, cutting (per meter or per cut), hinge drilling per hole, bands per meter, hardware per piece; `total` sums the priced lines and `missing` counts unpriced ones. Prices come only from the user; the web saves them (and nothing else) to `localStorage` under `planificador.prices`. `spanIssue` throws for a stock with `maxSpan: null` (templates only offer shelf-capable stocks, so it is unreachable from valid params).
- Cuts come from `sheetCuts`, in saw order and numbered per sheet: row by row from the top, a crosscut under the row (measured from the top) unless the row reaches the sheet bottom, then per run of equal-length pieces either rips piece by piece (full-height runs) or one rip at the run's end, one shared trim and short rips between its pieces (short runs) — rips are only made where a piece or run stops short of the sheet's right edge — each measured from the left or top edge of the board at that moment. `cutTotals` sums that sequence (meters round up to 0.1), so the order, the cost and the saw steps always agree. `cutText`, `CUT_TIP` and `cutBadge` give both clients the same copy and badge placement. A cut that leaves less than the kerf past its line carries `sliver`, which `cutText` spells out ("solo rebaja 2 mm"); `cutBadge` keeps each badge inside the sheet for the radius the client draws (web `BADGE_RADIUS` 34 mm, iOS 9 pt on screen). `orderText` is the order sent to the lumber yard and never contains prices.
- Edge banding: `Panel.edges` flags `L1/L2` (along the length) and `A1/A2` (along the width), the columns of a Mexican parts list. Templates set them for visible edges via `bandEdges(mode, …)`, with L1 the most visible long edge. Banding is 0.45 mm and never changes cut size or nesting. `edgeBandTotals` adds `EDGE_TRIM` (30 mm) per banded edge and rounds up to 0.1 m; stocks with `edgeBand: null` are never banded. Drawing banded edges goes through `bandSegments`, so both clients map rotation the same way.
- Building blocks live in `src/engine/parts/`. A block (`doorSet`, `drawerSet`) returns a `PartSet` — `{ panels, placements, hardware, fittings, boring, steps }` — that a template merges with its own parts, passing all hardware through `mergeHardware` so equal items become one line. Blocks never validate; templates do, using the block's helpers (e.g. `doorWidth`, `drawerFrontHeight`, `MIN_DRAWER_FRONT`). Doors are full overlay:
  - 2 mm gaps, 3 mm between a pair;
  - 35 mm cup hinges counted by door height (≤900: 2, ≤1600: 3, ≤2000: 4, else 5), cups 100 mm from each end and evenly spaced;
  - drawn swung open 90° so the interior stays visible.
  - hinge cups move off fixed shelves: `doorSet` takes the floor ranges of the case's horizontal panels (`avoid`) and moves a cup whose plate (±25 mm) would hit one to the nearest clear height, so a pattern may be asymmetric — `BORING_NOTE` tells the yard to drill a pair in mirror and mark ARRIBA;
  - doors need a board of at least `MIN_DOOR_THICKNESS` (15 mm) behind the 12 mm cup; templates validate it.
  - a case with two rows of doors (the pantry) passes `row: 'upper' | 'lower'`, which renames the panel (`door-upper` "Puerta alta"), its handle (`handle-upper`) and the step titles; a single row omits it and keeps `door` / `handle`.
- Drawers (`drawerSet`) stack in 1–2 side-by-side columns (`stacks`), with 3 mm between fronts and 2 mm at the ends. Each drawer is:
  - a screwed box: 2 sides, 2 ends, and a Fibracel bottom screwed underneath;
  - running on telescopic slides: `slideFor` picks the longest 10"–22" pair that leaves 10 mm behind it;
  - sized from the slide: the box is the slide's length, 26 mm narrower than its opening and 55 mm lower than its front (it starts 30 mm above the front's bottom edge, so it clears the Base);
  - finished with a separate front banded all round, fixed last so the fronts line up after the boxes run.
  - screwed on from inside with 3.5×25 (3.5×19 on 12 mm boards); its handle bolts through front and box with M4 screws sized by thickness (45 / 40 / 35 mm), since the handle's own screws don't reach.

  Drawers are drawn pulled out a third of their slide. Every front keeps 2 mm to the edge of the area it covers, so neighbouring blocks (closet drawers and doors, TV stand bays) sit 4 mm apart. `spanishList` in `labels.ts` builds every "a, b y c" in step copy.
- Fittings, boring and hardware text:
  - `Design.fittings` are non-cut parts drawn in steel in 3D (rod, handles), and `Step.panelRefs` may name a fitting id.
  - `Design.boring` lists the holes the lumber yard drills (hinge cups). `Order.boring` points at the drilled piece's order line, and `Prices.boring` prices each hole.
  - `hardwareText` is the only hardware-line format, including `cutTo` for items cut to size (the closet rod). Hardware headings read "Herrajes".
- Anti-tip: tall cases are fixed to the wall with `WALL_HARDWARE` (2 brackets on the Tapa, 3.5×13 screws, 1/4" anchors, through `mergeHardware`) and `wallStep(name, feminine)` ("Fija la alacena / el clóset / el librero al muro"), right after the back goes on — `parts/wall.ts`. The pantry and closet always get it; the bookshelf from 1200 mm tall.
- Templates must produce panels that always fit a sheet within their param limits; `nest()` throws otherwise.
- Welding (`src/engine/welding/`) is a parallel domain, not more `Panel`s:
  - `WeldTemplate.generate` returns a `WeldDesign` of `Member`s (cut lengths of one `Tube`), with `Placement.panelId` = member id so `Viewer3D` draws it.
  - The 3D is the shop truth, not an illustration:
    - each `TubePlacement` box is exactly its member's cut length, with `axis`, `ends` and, for miters, the `outer` face carrying the long points;
    - `endPlane` is the one source of every cut plane, so mitered partners share a plane;
    - `welds` lists each tube end that gets a bead (`joints` = its length, `weldLength` sums their perimeters), and `caps` lists every open end, which becomes plastic plugs in the shopping list;
    - `Tube.radius` (2 × wall) rounds the profile.

    The web draws hollow tube from these in `components/weld/tubeMesh.ts`; beads show from the weld step and plugs from the paint step, and `WELD_REF` in `panelRefs` lights the beads.
  - `planBars` packs members into 6.10 m bars (first-fit decreasing, `END_TRIM` + `CUT_KERF`).
  - `weldSettings` is the only source of amps, consumable, polarity and gas.
  - `WeldStep` extends `Step` with `tools` and an optional `ToolAction`, which only the client animates.
  - Catalog ids (tube sizes, gauges, processes, finishes) are stored in params, so never renumber them.
  - Copy both clients show around the bar plan and the amps lives in `plan.ts`: `END_ANGLE`, `SQUARE_END_STEP`, `barCutTip`, `settingsNote`, plus `shoppingText` for sharing.

## UI conventions

- Zustand stores raw state only (template id, user-touched params, exploded flag, view, active step, prices). Designs, orders and costs are derived per render — never stored. Only `prices` persists through Zustand `persist` (`localStorage` key `planificador.prices`, `partialize`d to prices alone); the theme persists separately under `planificador.theme` because it must be readable before React mounts. Everything else resets per session.
- While params are invalid, the viewer keeps the last valid design dimmed with an overlay message; issues render under their field via `paramKey`.
- Sliders are clamped to param ranges, so only cross-param issues (span, shelf fit) surface in the UI — that is intended.
- Visual language is "Cuaderno de cuadro", a maker's grid notebook; DESIGN.md records it in full.
  - Ballpoint blue `accent` marks selected, active and primary.
  - Highlighter `hi` marks the active step or piece, and in 3D the step's parts.
  - Margin red `cut` is kept for cut lines, errors and invalid states.
  - The cuadrícula (`.stage-grid`, `--color-grid*`) appears only on work stages.
- Tokens:
  - All tokens live in `@theme` in `src/index.css` (Tailwind v4 has no config file). Use `bg-paper`/`bg-panel`/`bg-raised`/`text-ink-soft`/`text-ink-faint`/`border-rule`/`bg-accent`/`text-accent-ink`, never raw palette classes.
  - Coloured text uses the `-ink` token (`text-accent-ink`, `text-cut-ink`), which is lighter at night so it clears 4.5:1. `accent` and `cut` are for fills and borders.
  - Screen text is never below 11 px.
  - No hard offset shadows and no coloured side stripes on callouts.
- Two themes, one palette per medium. The **paper** palette is the base in `@theme`; the night notebook is a screen-only override (`@media screen { :root:not([data-theme="light"]) }`, unlayered so it beats `@theme`). Print inherits paper for free and only re-binds `--color-paper`/`--color-panel` to true white. Add a new colour token to **both** the `@theme` block and the night override, never to the print block.
- Theme switching:
  - `src/main.tsx` writes `data-theme` to `<html>` (initial value plus a `useAppStore.subscribe`), so there is no first-paint flash. A saved choice in `localStorage` (`planificador.theme`) wins; otherwise the system preference applies.
  - Components never read the theme, only tokens, with one exception: `Viewer3D` mirrors the palette in a `PALETTE` record because WebGL cannot read CSS variables. In a step, parts it names turn highlighter, the rest become translucent pencil ghosts, and a rim light separates dark tube from the night page.
- Components never branch on medium; that is why `SheetSvg` fills use `var(--color-piece)` etc. rather than hex.
- Fonts come from Google Fonts in `index.html`:
  - Atkinson Hyperlegible Next for all UI and display. `.display` is the heavy sentence-case voice; there is no uppercase tracked labelling.
  - Atkinson Hyperlegible Mono (`font-mono`) for every number and measurement only, with tabular figures. Its slashed zero is the face's own legibility glyph.
- Layout:
  - Desktop: a 64 px top bar (mode switch, view tabs, theme, Exportar PDF), a 340 px rail and the stage.
  - Below `lg`: the stage first, the rail under it (Diseño only), and the view tabs as a bottom bar. It is the same `role="tablist"` element, repositioned.
- Reusable bits in `@layer components`:
  - `.display`: heading voice.
  - `.rule-label`: section heading followed by a hairline.
  - `.stage-grid`: the cuadrícula.
  - `.hi`: highlighter stroke behind text.
  - `.card`.
  - `.rise`: view-change entry, off under reduced motion.

  Selected states are `border-accent bg-accent-tint`. While a slider drags, `store.readout` shows its value large over the stage.
- `@types/react` is pinned to v18 via `overrides` in `pnpm-workspace.yaml`; without it, transitive deps pull v19 types and JSX breaks. `three` is installed as a required peer of @react-three/fiber.

## Native app (`mobile/`)

- Expo SDK 57 + Expo Router, npm (not pnpm — Expo's tooling assumes it, and `.npmrc` sets `legacy-peer-deps`). It is a separate install; the web app's pnpm workspace does not cover it.
- **It imports the same `src/engine/`, never a copy.** `mobile/src/lib/engine.ts` is the single re-export, `metro.config.js` adds `../src/engine` to `watchFolders`, and `tsconfig.json` maps `@engine/*`. Editing the engine changes both clients — that is the point, so do not fork it.
- Anything user-facing that both clients need (validation copy, `HARDWARE_LABELS`, template names) belongs in the engine, not in a client's components. The engine stays free of React/DOM/three, but it does own Spanish copy.
- 3D is `expo-gl` + plain `three` driven imperatively (`components/viewer-3d.tsx`), not react-three-fiber — same visual spec as the web viewer without coupling to a renderer's React version. Cut diagrams are `react-native-svg`, mirroring `SheetSvg`.
- The iOS app wears the same "Cuaderno de cuadro" world as the web (DESIGN.md):
  - `src/theme.ts` mirrors the tokens as a `day` and a `night` palette under camelCase names. `PaletteProvider` in the root layout reads the system appearance once and passes the palette down by context (`usePalette`, `useScheme`), so a live light/dark flip repaints every screen in one pass. There is no in-app toggle.
  - Screens build styles with `makeStyles((c) => ({…}))`, which caches one StyleSheet per palette, and read colours only from the palette. Like the web, `Viewer3D` is the one component that knows the scheme: its `PALETTE` mirrors the web viewer's, and the stage gradient is a small `DataTexture`.
  - Fonts are `@expo-google-fonts/atkinson-hyperlegible-next` and `-mono`, loaded in `src/app/_layout.tsx`. `Mono` sets `tabular-nums`.
  - `components/ui.tsx` holds the kit: `Display`, `Title`, `RuleLabel`, `Body`, `Caption`, `Mono`, `Hi` (the highlighter), `Chip`, `PrimaryButton` (ballpoint fill), `SecondaryButton` (quiet), `IssueNote` (red wash and line icon), `StalePill`, `ScaleChip`, `GridBackdrop` (the cuadrícula, on work stages only), `Thumb` and `Mark`.
  - Two night tokens differ from DESIGN.md so every text pair holds AA: `pieceDims` is dark ink on the night piece, and cut-badge numerals use `onMark`, which is dark ink at night.
  - Preview without a Mac: `npm run web` in `mobile/` (react-native-web) at phone size.
- Madera | Metal: `AppState.mode` picks the workshop, switched on the templates screen. Wood and metal template ids share `paramsByTemplate`, and `setParams` applies a suggestion's fix in one step.
  - Metal screens live in `src/screens/result/weld.tsx`: Diseño (model in its finish plus the amps card), Cortes (bar plan, saw list, tappable piece list), Pasos (the shared `StepList` with each step's tools) and Compras (`shoppingList`, shared as `shoppingText` through React Native's `Share`).
  - Suggestions and their one-click fixes sit under the params on the measure screen.
  - The 3D tool demo is web only.
- Screens live in `src/app` (routes only) and `src/screens` (bodies), per Expo's project-structure guidance.
- Not real yet, by design: saved projects and the account footer are fixtures (needs Phase 6), and the camera screen's distance is simulated and labelled as such — LiDAR needs a custom ARKit native module.
- `patch-package` (approved, dev-only) runs on `postinstall` and applies `mobile/patches/`. Its one patch makes `query-string@7` (pinned by expo-router 57) read `.default` from `decode-uri-component`, which `overrides` forces to the ESM-only 0.5.0 for GHSA-vcc3-ghjq-m6fr. Drop the patch, that override, and patch-package once expo-router stops depending on `query-string@7`; if `npm ci` reports the patch failed to apply, that is the signal to check.
- Verify with `npx tsc --noEmit` and `npx expo export --platform ios`; a device build needs EAS, since there is no Mac here.

## Commands

- `pnpm dev` — Vite dev server
- `pnpm test` — full Vitest suite
- `pnpm typecheck` — tsc strict, no emit
- `pnpm demo` — print default bookshelf cut layout (ASCII + JSON)

## Phase plan and status

- [x] **Phase 1 — Engine + tests (no UI)**: types, validation, nesting, bookshelf + side table templates, ASCII demo. *Approved.*
- [x] **Phase 2 — Core UI**: template picker, param form with live validation, 3D view (box geometry per placement, exploded toggle, orbit controls). *Approved.*
- [x] **Phase 3 — Outputs**: SVG cut diagram (`SheetSvg`, 1 unit = 1 mm), steps view with 3D highlighting (step explode offsets + dimmed non-referenced panels), PDF export via print stylesheet (`PrintReport` is `hidden print:block`; app shell is `print:hidden`; "Exportar PDF" = `window.print()`). *Approved. Vercel deploy pending: the connected Vercel integration returns 403 "You don't have permission to create a project" — create the project on vercel.com or re-connect the integration with project-create access, then retry.*
- [ ] **Phase 4 — Materials + lumber-yard order** (in progress; no backend). Goal: an output a beginner hands over the counter of a maderería, which cuts and edge-bands to order. Split into sub-projects 4.1–4.4, each spec → plan → PR.
  - **4.1 Materials** — spec: `docs/superpowers/specs/2026-09-24-materials-design.md`. Stock catalog (pine plywood 12/15/18, white melamine 16, Fibracel 3 back) replaces `PlywoodThickness`; stock per panel; one "Material" select; bookshelf gets an always-on Fibracel back (and, from 1200 mm tall, anti-tip brackets); one price per material. MDF, wood-look melamine and Arauco Vesto 1830×2500 / 1830×2440 sheets come later as catalog entries only. *Implemented; awaiting user approval.*
  - **4.2 Edge banding** — spec: `docs/superpowers/specs/2026-09-24-edge-banding-design.md`. Per-edge flags on `Panel` (L1/L2/A1/A2, the notation Mexican optimizers use) set by each template for visible edges; one "Cubrecanto" select (none / lumber yard / iron-on); band type per stock; meters per band; material-aware first step (no sanding advice on melamine). Thin 0.45 mm band only — cut size never changes. *Implemented; awaiting user approval.*
  - **4.3 Order + cost** — spec: `docs/superpowers/specs/2026-09-24-order-cost-design.md`. Engine `Order` (numbered pieces L × A × qty, grain, banded edges, sheets per material, guillotine cut count + meters, band meters, hardware) shared as plain text with no prices — web "Pedido" tab via Web Share / clipboard, iOS via React Native's built-in `Share` (no `expo-sharing` needed). Full cost on web only: sheets + cutting (per meter or per cut) + bands per meter + hardware per piece, from user-entered prices saved in `localStorage`; the total sums priced lines and counts missing ones. *Implemented; awaiting user approval.*
  - **4.4 Cut sequence** — spec: `docs/superpowers/specs/2026-09-24-cut-sequence-design.md`. `sheetCuts` becomes the numbered saw sequence per sheet (row by row; equal-length short pieces trimmed in one pass; each cut measured from the top or left edge of the board at that moment), and `cutTotals` sums it, so order, cost and saw steps agree. Numbered badges on the sheet diagrams and a numbered list per sheet (web Cortes + PDF); the iOS checklist ticks saw cuts, with piece sizes moved to a read-only "Piezas" list. *Implemented; awaiting user approval.*
- [ ] **Phase 5 — Templates for small homes** (in progress; no backend). Split into sub-projects 5.1–5.6, each spec → plan → PR.
  - **5.1 Doors + modular closet** — spec: `docs/superpowers/specs/2026-09-24-closet-doors-design.md`.
    - `doorSet` building block: full overlay, 35 mm cup hinges drilled by the lumber yard, handles, doors drawn open 90°.
    - "Clóset modular" template: one module with Colgar / Entrepaños / Mixto interiors, a zoclo, a Fibracel back and 0–2 doors, fixed to the wall ("Fija el clóset al muro").
    - `Design.fittings` draws the rod and handles in 3D; `Design.boring` becomes Barrenado in the order and cost.
    - "Herrajes" replaces "Tornillería".
    - *Implemented; awaiting user approval.*
  - **5.2 Drawers + TV stand** — spec: `docs/superpowers/specs/2026-09-25-drawers-tv-stand-design.md`.
    - `drawerSet` building block: telescopic slides, a screwed box plus a separate front, drawn pulled out. `mergeHardware` keeps one line per hardware item.
    - Closet "Cajones" 0–3 under a drawer shelf, with the doors above it.
    - "Mueble para TV": two bays split by a divider, each Cajones or Entrepaño; the back stops 100 mm short of the top as a cable slot.
    - *Implemented; awaiting user approval.*
  - **5.3 More templates**, in priority order: kitchen pantry cabinet, home-office desk, bed base with drawers, shoe rack, floating shelves.
    - **Alacena** (kitchen pantry) — spec: `docs/superpowers/specs/2026-10-30-pantry-cabinet-design.md`. Tall and shallow (300–600 mm); a fixed shelf at counter height (900 mm) splits it into shelves behind upper doors and, below, either lower doors over one shelf or 2–4 drawers. Shelves are fixed and stay 150 mm apart (a can). Two anti-tip brackets and a "Fija la alacena al muro" step (`bracket`, `wall-anchor` hardware, shared with the closet and bookshelf via `parts/wall.ts`). *Implemented; awaiting user approval.*
  - **5.4 Fit this space**: enter a niche W × H × D (the mobile measure screen feeds it) and the template sizes itself with clearance.
  - **5.5 Tool-aware steps**: ask what tools the user owns. With only a screwdriver, every cut goes to the lumber yard, holes are pre-drilled (the yard/me drilling choice lives here), and joinery switches to confirmat.
  - **5.6 Offcut suggestions**: small projects that fit a layout's leftover rectangles.
- [ ] **Welding projects (Metal mode)** — spec: `docs/superpowers/specs/2026-10-30-welding-projects-design.md`. Madera | Metal switch; `src/engine/welding/` (PTR templates: mesa, banco alto, estante; bar cut plan; `weldSettings` amps per process and wall; shopping list; suggestions with one-click fixes; `ToolAction` per step for the 3D tool demo). Web and iOS; the tool demo is web only. *Implemented; awaiting user approval.*
- [ ] **Phase 6 — Community (do not start)**: Supabase auth, save/share/remix designs.
- [ ] **Phase 7 — Pro + partners** (needs Phase 6 backend).
  - Carpenter mode (paid tier): quote with labor + margin, branded client PDF, shareable 3D link.
  - Lumber-yard partners: send the order straight to a local yard for cutting; yards pay per lead.
  - AR room preview and real LiDAR measuring — both need a custom ARKit native module.

Market context behind Phases 4–7 (researched 2026-09-24):

- Melamine dominates Mexican furniture; pine plywood is the DIY/budget option. Sheets: Arauco 1220×2440; Arauco Vesto 1830×2500 (particleboard) and 1830×2440 (MDF). Masisa's 1830×2600 is the Chilean format, not Mexico's.
- Most users own no table saw. Lumber yards cut (~$3.9 MXN/m) and edge-band ($8–25 MXN/m + ~$10/piece) to order.
- Competitors are cut optimizers (CutList Optimizer, Opticorte, Arauco TABLERED — which already takes cut orders online) or pro suites for carpenters (Corte Cloud, MuebleMIO, Polyboard). None goes furniture → pieces → yard order → build steps for a beginner; that is our position. Threat: board makers and distributors fund free tools.
- ~48k carpentry workshops in Mexico (DENUE) — the Phase 7 paid segment.

Out of scope for MVP: free-form CAD, curved/angled cuts, price databases (costs come from user-entered prices).
