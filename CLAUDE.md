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
- Supabase only in Phase 4 — no auth/backend scaffolding before then.

## Engine conventions

- `generate()` returns a `GenerateResult` envelope (`ok`/`issues`), never throws for validation. Issue messages are Spanish, human-readable, with `paramKey` when tied to one input.
- Sheet: 1220 × 2440 mm; grain runs along the 2440 axis. Sheet coords: origin top-left, x along width, y along length.
- Grain: `'length'` → panel length ∥ sheet grain; `'width'` → panel width ∥ sheet grain; `'any'` → free rotation.
- Kerf (default 3 mm) applies between adjacent pieces, not at sheet edges. Kerf counts as waste.
- Panels of different thickness never share a sheet.
- Nesting is FFDH shelf packing — guillotine-cuttable by construction. Upgrade to a free-rectangle guillotine packer only if waste % becomes a problem.
- Assembly space: x = width, y = height (up), z = depth; floor at y = 0. `Placement` = axis-aligned box (center + size), maps directly to `<boxGeometry>` in Phase 2.
- Span limits (max unsupported shelf span): 12 mm → 500, 15 mm → 650, 18 mm → 800 (configurable in `DEFAULT_CONFIG`).
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
- Not real yet, by design: saved projects and the account footer are fixtures (needs Phase 4), and the camera screen's distance is simulated and labelled as such — LiDAR needs a custom ARKit native module.
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
- [x] **Phase 3 — Outputs**: SVG cut diagram (`SheetSvg`, 1 unit = 1 mm), steps view with 3D highlighting (step explode offsets + dimmed non-referenced panels), PDF export via print stylesheet (`PrintReport` is `hidden print:block`; app shell is `print:hidden`; "Exportar PDF" = `window.print()`). *Implemented; awaiting user approval. Vercel deploy pending: the connected Vercel integration returns 403 "You don't have permission to create a project" — create the project on vercel.com or re-connect the integration with project-create access, then retry.*
- [ ] **Phase 3 — Outputs**: SVG cut diagram, instructions view with 3D highlighting, PDF export, deploy to Vercel.
- [ ] **Phase 4 — Community (do not start)**: Supabase auth, save/share/remix designs.

Out of scope for MVP: free-form CAD, curved/angled cuts, edge banding, native app, price databases.
