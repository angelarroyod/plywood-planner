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
- `@types/react` is pinned to v18 via `overrides` in `pnpm-workspace.yaml`; without it, transitive deps pull v19 types and JSX breaks. `three` is installed as a required peer of @react-three/fiber.

## Commands

- `pnpm dev` — Vite dev server
- `pnpm test` — full Vitest suite
- `pnpm typecheck` — tsc strict, no emit
- `pnpm demo` — print default bookshelf cut layout (ASCII + JSON)

## Phase plan and status

- [x] **Phase 1 — Engine + tests (no UI)**: types, validation, nesting, bookshelf + side table templates, ASCII demo. *Approved.*
- [x] **Phase 2 — Core UI**: template picker, param form with live validation, 3D view (box geometry per placement, exploded toggle, orbit controls). *Approved.*
- [x] **Phase 3 — Outputs**: SVG cut diagram (`SheetSvg`, 1 unit = 1 mm), steps view with 3D highlighting (step explode offsets + dimmed non-referenced panels), PDF export via print stylesheet (`PrintReport` is `hidden print:block`; app shell is `print:hidden`; "Exportar PDF" = `window.print()`), Vercel deploy. *Implemented; awaiting user approval.*
- [ ] **Phase 3 — Outputs**: SVG cut diagram, instructions view with 3D highlighting, PDF export, deploy to Vercel.
- [ ] **Phase 4 — Community (do not start)**: Supabase auth, save/share/remix designs.

Out of scope for MVP: free-form CAD, curved/angled cuts, edge banding, native app, price databases.
