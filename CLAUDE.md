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
- `estimateCost` returns `null` until every stock in the layout has a positive price; `spanIssue` throws for a stock with `maxSpan: null` (templates only offer shelf-capable stocks, so it is unreachable from valid params).
- Edge banding: `Panel.edges` flags `L1/L2` (along the length) and `A1/A2` (along the width), the columns of a Mexican parts list. Templates set them for visible edges via `bandEdges(mode, …)`, with L1 the most visible long edge. Banding is 0.45 mm and never changes cut size or nesting. `edgeBandTotals` adds `EDGE_TRIM` (30 mm) per banded edge and rounds up to 0.1 m; stocks with `edgeBand: null` are never banded. Drawing banded edges goes through `bandSegments`, so both clients map rotation the same way.
- Templates must produce panels that always fit a sheet within their param limits; `nest()` throws otherwise.

## UI conventions

- Zustand stores raw state only (template id, user-touched params, exploded flag). Designs are derived per render via `template.generate()` — never stored.
- While params are invalid, the viewer keeps the last valid design dimmed with an overlay message; issues render under their field via `paramKey`.
- Sliders are clamped to param ranges, so only cross-param issues (span, shelf fit) surface in the UI — that is intended.
- Visual language is "taller nocturno" (dark industrial shop drawing): graphite grounds, plywood amber, one signal-red `cut` accent that marks every selected/active/invalid state. All tokens live in `@theme` in `src/index.css` (Tailwind v4 — there is no config file), so use `bg-paper`/`bg-panel`/`bg-raised`/`text-ink-soft`/`text-ink-faint`/`border-rule`/`text-ply`, never raw `neutral-*` or `amber-*`.
- Screen is dark, paper is not. `@media print` re-binds the same `:root` tokens to ink-on-white, so components never branch on medium — that is why `SheetSvg` fills use `var(--color-piece)` etc. rather than hex. Add a print counterpart whenever you add a color token.
- Fonts: Barlow Condensed (`font-display`, always uppercase — use the `.display` class, which bundles family + uppercase + tracking), Archivo (body), Roboto Mono (`font-mono` — every number, measurement, and small-caps label). Loaded from Google Fonts in `index.html`.
- Reusable bits in `@layer components`: `.display` (condensed caps), `.rule-label` (section heading + hairline), `.ruler` (tick strip), `.rise` (view-change entry animation). Selected states are `border-cut bg-raised` with a 2px hard offset red shadow.
- `@types/react` is pinned to v18 via `overrides` in `pnpm-workspace.yaml`; without it, transitive deps pull v19 types and JSX breaks. `three` is installed as a required peer of @react-three/fiber.

## Native app (`mobile/`)

- Expo SDK 57 + Expo Router, npm (not pnpm — Expo's tooling assumes it, and `.npmrc` sets `legacy-peer-deps`). It is a separate install; the web app's pnpm workspace does not cover it.
- **It imports the same `src/engine/`, never a copy.** `mobile/src/lib/engine.ts` is the single re-export, `metro.config.js` adds `../src/engine` to `watchFolders`, and `tsconfig.json` maps `@engine/*`. Editing the engine changes both clients — that is the point, so do not fork it.
- Anything user-facing that both clients need (validation copy, `HARDWARE_LABELS`, template names) belongs in the engine, not in a client's components. The engine stays free of React/DOM/three, but it does own Spanish copy.
- 3D is `expo-gl` + plain `three` driven imperatively (`components/viewer-3d.tsx`), not react-three-fiber — same visual spec as the web viewer without coupling to a renderer's React version. Cut diagrams are `react-native-svg`, mirroring `SheetSvg`.
- Screens live in `src/app` (routes only) and `src/screens` (bodies), per Expo's project-structure guidance.
- Not real yet, by design: saved projects and the account footer are fixtures (needs Phase 6), and the camera screen's distance is simulated and labelled as such — LiDAR needs a custom ARKit native module.
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
  - **4.1 Materials** — spec: `docs/superpowers/specs/2026-09-24-materials-design.md`. Stock catalog (pine plywood 12/15/18, white melamine 16, Fibracel 3 back) replaces `PlywoodThickness`; stock per panel; one "Material" select; bookshelf gets an always-on Fibracel back; one price per material. MDF, wood-look melamine and Arauco Vesto 1830×2500 / 1830×2440 sheets come later as catalog entries only. *Implemented; awaiting user approval.*
  - **4.2 Edge banding** — spec: `docs/superpowers/specs/2026-09-24-edge-banding-design.md`. Per-edge flags on `Panel` (L1/L2/A1/A2, the notation Mexican optimizers use) set by each template for visible edges; one "Cubrecanto" select (none / lumber yard / iron-on); band type per stock; meters per band; material-aware first step (no sanding advice on melamine). Thin 0.45 mm band only — cut size never changes. *Implemented; awaiting user approval.*
  - **4.3 Order + cost** — "Pedido para maderería": numbered pieces L × A × qty, grain, banded edges, total cut and banding meters. Prints through the `PrintReport` path; shares via the Web Share API (no dep). Mobile sharing needs `expo-sharing` — ask first.
    Full cost: sheets + cutting ($/m) + edge banding ($/m + $/piece) + hardware, from user-entered prices (extends 4.1's per-material prices), never a price database.
  - **4.4 Cut sequence**: numbered cut sequence for circular-saw DIY. FFDH is already guillotine; only the order is new.
- [ ] **Phase 5 — Templates for small homes** (no backend).
  - Door (35 mm cup hinge) and drawer (slides) as reusable engine building blocks that templates compose; new `Hardware` types (hinge, slide, handle).
  - Templates, in priority order: modular closet, kitchen pantry cabinet, home-office desk, TV stand, bed base with drawers, shoe rack, floating shelves.
  - "Fit this space": enter a niche W × H × D (the mobile measure screen feeds it) and the template sizes itself with clearance.
  - Tool-aware steps: ask what tools the user owns; with only a screwdriver, every cut goes to the lumber yard, holes are pre-drilled, joinery switches to confirmat.
  - Offcut suggestions: small projects that fit a layout's leftover rectangles.
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
