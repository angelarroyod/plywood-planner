# Plywood Furniture Planner

Design a piece of plywood furniture, get back everything you need to build it: a 3D preview, an optimized cut diagram for the sheet, and numbered assembly steps — all from the same set of dimensions, all exportable to PDF.

Aimed at beginners. Pick a template, drag the sliders, and the app refuses to let you design something that will sag.

**Spanish UI (es-MX). Millimeters throughout.**

## The one idea the whole app rests on

A furniture template is **not** a 3D model. It is a pure function:

```ts
(params: TemplateParams) => Design
```

`Design` holds the complete panel list (dimensions, grain direction, quantity), the hardware list, the 3D placements, and the assembly steps. Every view derives from that one value — the 3D scene, the cut sheet, and the instructions are three renderings of the same object, never three hand-maintained copies.

Change a slider and all three update, because there is nothing else to update.

## What it knows about plywood

The engine encodes the constraints that actually bite when you cut a real sheet:

- **Grain direction matters.** A panel marked `'length'` must run along the sheet's 2440 mm axis; the nester will not rotate it to save space. `'any'` panels rotate freely.
- **Kerf is waste.** The 3 mm the blade removes is counted between adjacent pieces (not at sheet edges) and shows up in the waste percentage.
- **Shelves sag.** Maximum unsupported span is capped by thickness — 500 mm at 12 mm, 650 at 15, 800 at 18. Exceed it and you get a Spanish-language issue under the offending field, not a silently bad design.
- **Mixed thicknesses never share a sheet.** You cannot cut 12 mm and 18 mm from the same board.
- **Cuts must be makeable.** Nesting is FFDH shelf packing, which is guillotine-cuttable by construction — every cut runs edge to edge, which is the only kind a track saw or table saw can do.

Standard sheet: 1220 × 2440 mm, grain along the long axis.

## Two themes, one palette per medium

The app ships a dark shop view and a paper view, switched from the nav bar and remembered across reloads.

They are not two stylesheets. The paper palette is the base set of `@theme` tokens; the dark shop is a screen-only override, so **print inherits paper for free** and only re-binds the page stock to true white. Components never branch on theme or on medium — they read tokens, which is why the cut diagram fills are `var(--color-piece)` rather than hex, and why one SVG component serves the screen and the PDF.

The 3D viewer is the sole exception: WebGL materials take hex strings, not CSS variables, so `Viewer3D` mirrors the palette in one `PALETTE` record.

## Status

| Phase | State |
|---|---|
| 1 — Engine (templates, nesting, validation) | ✅ 39 tests passing |
| 2 — 3D viewer + param form | ✅ |
| 3 — Cut diagram, assembly steps, PDF export | ✅ |
| 4 — Supabase (save designs, accounts) | not started |

Templates so far: **bookshelf** (librero) and **side-table** (mesa auxiliar).

## Run it

```bash
pnpm install
pnpm dev
```

```bash
pnpm test        # 39 engine tests
pnpm typecheck
pnpm build
pnpm demo        # prints an ASCII cut diagram to the terminal, no browser needed
```

`pnpm demo` is the fastest way to see the engine work — it nests a bookshelf and draws the sheet layout as text.

## Layout

```
src/engine/     pure TypeScript — templates, nesting, validation, ASCII renderer
                zero imports from React, DOM, or three.js (it must port to React Native as-is)
src/components/ 3D viewer, param form, cut diagram, steps panel, print report
src/index.css   Tailwind v4 @theme tokens — the entire design system, both themes
                and the print palette live here (there is no tailwind.config.js)
scripts/        Node-only entry points (the demo)
mobile/         Expo iOS client — imports the same src/engine/, never a copy
```

The engine boundary is enforced by convention and worth keeping: it is what already lets the Expo client in `mobile/` run the same planner with no rewrite and no forked copy.

## Stack

Vite · React 18 · TypeScript · Tailwind v4 · @react-three/fiber + drei · Zustand · Vitest · pnpm

## License

MIT — see [LICENSE](LICENSE).
